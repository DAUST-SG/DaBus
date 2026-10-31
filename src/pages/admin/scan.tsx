import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import jsQR from 'jsqr'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Trip } from '@/types'
import { formatTripDate } from '@/lib/time'

type Passenger = {
  booking_id: string
  ref: string
  full_name?: string
  pickup_location?: string
  dropoff_location?: string
  boarded_at: number | null
}
type Summary = { boarded: number; expected: number; passengers: Passenger[] }
type CheckResult = Partial<Passenger> & {
  result: 'ok' | 'already' | 'not_paid' | 'cancelled' | 'wrong_trip' | 'not_found'
  trip_label?: string | null
}

const RESULT_TEXT: Record<CheckResult['result'], { title: string; good: boolean }> = {
  ok: { title: 'Valid ticket: boarded', good: true },
  already: { title: 'Already boarded', good: false },
  not_paid: { title: 'Not paid', good: false },
  cancelled: { title: 'Cancelled ticket', good: false },
  wrong_trip: { title: 'Wrong trip', good: false },
  not_found: { title: 'Ticket not found', good: false },
}

// The same QR stays in view for a while; ignore repeats of it for this long
const SAME_CODE_MS = 4000
// A trip is offered here from 12 hours before to 12 hours after its departure, or later if upcoming
const departureMs = (t: Trip) => Date.parse(`${t.departure_date}T${t.departure_time}:00Z`)
const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })

export default function ScanPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripId, setTripId] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualRef, setManualRef] = useState('')
  const [checking, setChecking] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastCode = useRef({ code: '', at: 0 })
  const busy = useRef(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role !== 'admin' || !router.isReady) return
    api.get<{ success: boolean; data: Trip[] }>('/admin/trips').then((response) => {
      const soon = (response.data.data || [])
        .filter((t) => (t.status === 'scheduled' || t.status === 'full' || t.status === 'completed') && departureMs(t) > Date.now() - 12 * 3_600_000)
        .sort((a, b) => departureMs(a) - departureMs(b))
      setTrips(soon)
      const wanted = typeof router.query.trip === 'string' ? router.query.trip : ''
      setTripId(soon.some((t) => t.id === wanted) ? wanted : soon[0]?.id || '')
    })
  }, [user, router.isReady])

  const loadSummary = useCallback(async () => {
    if (!tripId) return setSummary(null)
    const response = await api.get<{ success: boolean; data: Summary }>(`/admin/boarding?trip_id=${tripId}`)
    setSummary(response.data.data)
  }, [tripId])

  useEffect(() => {
    setResult(null)
    loadSummary().catch(() => setSummary(null))
  }, [loadSummary])

  const checkIn = useCallback(async (code: string) => {
    if (!tripId || busy.current) return
    busy.current = true
    setChecking(true)
    try {
      const response = await api.post<{ success: boolean; data: CheckResult }>('/admin/boarding', { trip_id: tripId, code })
      const data = response.data.data
      setResult(data)
      navigator.vibrate?.(data.result === 'ok' ? 80 : [80, 60, 80])
      if (data.result === 'ok') loadSummary()
    } catch {
      setResult({ result: 'not_found' })
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [tripId, loadSummary])

  // Camera loop: read a frame, look for a QR code, check it in
  useEffect(() => {
    if (!cameraOn) return
    let stream: MediaStream | null = null
    let frame = 0
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const tick = () => {
      const video = videoRef.current
      if (video && context && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)
        const qr = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
        const at = Date.now()
        if (qr?.data && !(qr.data === lastCode.current.code && at - lastCode.current.at < SAME_CODE_MS)) {
          lastCode.current = { code: qr.data, at }
          checkIn(qr.data)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
        frame = requestAnimationFrame(tick)
      })
      .catch(() => {
        setCameraError('Camera not available. Allow camera access, or type the ticket code below.')
        setCameraOn(false)
      })
    return () => {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [cameraOn, checkIn])

  const undo = async (bookingId: string) => {
    if (!confirm('Mark this passenger as NOT boarded?')) return
    await api.delete(`/admin/boarding?booking_id=${bookingId}`)
    setResult(null)
    loadSummary()
  }

  const trip = trips.find((t) => t.id === tripId)
  const waiting = summary?.passengers.filter((p) => !p.boarded_at) || []
  const boarded = summary?.passengers.filter((p) => p.boarded_at).sort((a, b) => b.boarded_at! - a.boarded_at!) || []
  const shown = result && RESULT_TEXT[result.result]

  return (
    <>
      <Head>
        <title>Boarding - DaBus</title>
      </Head>
      <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-txt-primary">Boarding</h1>
          <Link href="/admin" className="text-sm text-txt-muted hover:text-txt-secondary">Dashboard</Link>
        </div>

        <select className="input-dark" value={tripId} onChange={(e) => setTripId(e.target.value)}>
          {trips.length === 0 && <option value="">No trips departing soon</option>}
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.origin} → {t.destination} · {formatTripDate(t.departure_date, { day: 'numeric', month: 'short' })} {t.departure_time}
            </option>
          ))}
        </select>

        {summary && (
          <div className="glass rounded-2xl p-4 flex items-baseline justify-between">
            <span className="text-sm text-txt-secondary">Boarded</span>
            <span className="font-display text-3xl font-extrabold text-txt-primary">
              {summary.boarded}<span className="text-txt-muted text-xl"> / {summary.expected}</span>
            </span>
          </div>
        )}

        {trip && (
          <div className="glass rounded-2xl overflow-hidden">
            {cameraOn ? (
              <div className="relative bg-black">
                <video ref={videoRef} className="w-full aspect-square object-cover" playsInline muted />
                <div className="absolute inset-[18%] border-2 border-white/70 rounded-2xl pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setCameraOn(false)}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs"
                >
                  Stop camera
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCameraError(null); setCameraOn(true) }}
                className="w-full py-10 flex flex-col items-center gap-2 text-accent hover:bg-[rgba(var(--overlay),0.03)]"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4M7 12h10" />
                </svg>
                <span className="font-medium">Scan tickets</span>
              </button>
            )}
            {cameraError && <p className="px-4 py-3 text-sm text-[rgb(var(--danger))]">{cameraError}</p>}
          </div>
        )}

        {shown && (
          <div
            className={`rounded-2xl p-4 border ${
              shown.good
                ? 'bg-[rgba(var(--success),0.12)] border-[rgba(var(--success),0.3)]'
                : 'bg-[rgba(var(--danger),0.1)] border-[rgba(var(--danger),0.3)]'
            }`}
          >
            <p className={`font-display text-xl font-bold ${shown.good ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--danger))]'}`}>
              {shown.title}
            </p>
            {result.result !== 'not_found' && (
              <p className="text-sm text-txt-primary mt-1">
                {result.full_name || 'Passenger'} · {result.ref}
                {result.pickup_location && <span className="text-txt-secondary"> · {result.pickup_location}</span>}
              </p>
            )}
            {result.result === 'already' && result.boarded_at && (
              <p className="text-xs text-txt-secondary mt-1">Scanned at {timeOf(result.boarded_at)}</p>
            )}
            {result.result === 'wrong_trip' && result.trip_label && (
              <p className="text-xs text-txt-secondary mt-1">This ticket is for {result.trip_label}</p>
            )}
            {result.result === 'ok' && result.booking_id && (
              <button type="button" className="text-xs text-txt-muted underline mt-2" onClick={() => undo(result.booking_id!)}>
                Undo
              </button>
            )}
          </div>
        )}

        {trip && (
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (manualRef.trim()) checkIn(manualRef).then(() => setManualRef('')) }}
          >
            <input
              className="input-dark font-mono uppercase"
              placeholder="Ticket code"
              value={manualRef}
              onChange={(e) => setManualRef(e.target.value)}
              maxLength={8}
            />
            <button type="submit" disabled={checking} className="px-4 rounded-xl bg-accent text-surface-primary text-sm font-medium disabled:opacity-50">
              Check
            </button>
          </form>
        )}

        {summary && summary.expected > 0 && (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-2">Not boarded yet ({waiting.length})</p>
              {waiting.length === 0 ? (
                <p className="text-sm text-txt-muted">Everyone is on board.</p>
              ) : (
                <ul className="divide-y divide-subtle">
                  {waiting
                    .sort((a, b) => (a.pickup_location || '').localeCompare(b.pickup_location || ''))
                    .map((p) => (
                      <li key={p.booking_id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-txt-primary truncate">{p.full_name || 'Passenger'}</p>
                          <p className="text-xs text-txt-muted">{p.pickup_location || 'No stop'} · <span className="font-mono">{p.ref}</span></p>
                        </div>
                        <button type="button" className="text-xs text-accent hover:underline flex-shrink-0" onClick={() => checkIn(p.ref)}>
                          Board
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            {boarded.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-2">Boarded ({boarded.length})</p>
                <ul className="divide-y divide-subtle">
                  {boarded.map((p) => (
                    <li key={p.booking_id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-txt-secondary truncate">{p.full_name || 'Passenger'}</p>
                        <p className="text-xs text-txt-muted">{timeOf(p.boarded_at!)} · {p.pickup_location || 'No stop'}</p>
                      </div>
                      <button type="button" className="text-xs text-txt-muted hover:underline flex-shrink-0" onClick={() => undo(p.booking_id)}>
                        Undo
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

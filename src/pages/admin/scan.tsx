import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Trip } from '@/types'
import { formatTripDate } from '@/lib/time'
import BoardingScanner, { ScanSummary } from '@/components/BoardingScanner'

// A trip is offered here from 12 hours after its departure onward
const departureMs = (t: Trip) => Date.parse(`${t.departure_date}T${t.departure_time}:00Z`)

export default function ScanPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripId, setTripId] = useState('')
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [chosen, setChosen] = useState('')
  const [savingScanner, setSavingScanner] = useState(false)
  const [scannerMessage, setScannerMessage] = useState<string | null>(null)

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

  useEffect(() => {
    setChosen('')
    setScannerMessage(null)
  }, [tripId])

  const scanLink = summary?.scanner?.token ? `${window.location.origin}/scan/${summary.scanner.token}` : null

  const setScanner = async (bookingId: string | null) => {
    setSavingScanner(true)
    setScannerMessage(null)
    try {
      const response = await api.put<{ success: boolean; data: { token: string | null; emailed: boolean } }>('/admin/boarding', {
        trip_id: tripId,
        booking_id: bookingId,
      })
      const { token, emailed } = response.data.data
      setScannerMessage(
        !token ? 'Scanner removed: the old link no longer works.'
          : emailed ? 'Scan link emailed. You can also copy it below.'
          : 'This passenger has no email: copy the link below and send it to them.',
      )
      setChosen('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setScannerMessage((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not save the scanner')
    } finally {
      setSavingScanner(false)
    }
  }

  const copyLink = async () => {
    if (!scanLink) return
    try {
      await navigator.clipboard.writeText(scanLink)
      setScannerMessage('Link copied.')
    } catch {
      setScannerMessage(scanLink)
    }
  }

  const trip = trips.find((t) => t.id === tripId)

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

        {trip && summary && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Ticket scanner</p>
              <p className="text-xs text-txt-muted mt-1">
                A passenger of this trip who checks tickets at the door. They get a private link, for this trip only,
                that works until the trip is completed.
              </p>
            </div>
            {summary.scanner && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-txt-primary">{summary.scanner.full_name || 'Passenger'}</p>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-accent hover:underline" onClick={copyLink}>Copy link</button>
                  <button type="button" className="text-txt-muted hover:underline" disabled={savingScanner} onClick={() => setScanner(null)}>Remove</button>
                </div>
              </div>
            )}
            {summary.passengers.length > 0 && (
              <div className="flex gap-2">
                <select className="input-dark" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                  <option value="">{summary.scanner ? 'Choose someone else…' : 'Choose a passenger…'}</option>
                  {summary.passengers
                    .filter((p) => p.booking_id !== summary.scanner?.booking_id)
                    .map((p) => (
                      <option key={p.booking_id} value={p.booking_id}>
                        {p.full_name || 'Passenger'}{p.pickup_location ? ` · ${p.pickup_location}` : ''}
                        {summary.with_email.includes(p.booking_id) ? '' : ' (no email)'}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!chosen || savingScanner}
                  onClick={() => setScanner(chosen)}
                  className="px-4 rounded-xl bg-accent text-surface-primary text-sm font-medium whitespace-nowrap disabled:opacity-50"
                >
                  Send link
                </button>
              </div>
            )}
            {scannerMessage && <p className="text-xs text-txt-secondary break-all">{scannerMessage}</p>}
          </div>
        )}

        {tripId && <BoardingScanner endpoint="/admin/boarding" tripId={tripId} reloadKey={reloadKey} onSummary={setSummary} />}
      </div>
    </>
  )
}

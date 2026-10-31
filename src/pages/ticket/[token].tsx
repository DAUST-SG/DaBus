import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import QRCode from 'qrcode'
import api from '@/lib/api'
import { formatTripDate } from '@/lib/time'

type Ticket = {
  ref: string
  full_name?: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  payment_status: 'pending' | 'paid' | 'refunded'
  has_payment: boolean
  amount?: number
  pickup_location?: string
  dropoff_location?: string
  trip: { origin: string; destination: string; departure_date: string; departure_time: string; status: string } | null
}

// How long to keep asking Naboopay before telling the student to check back later
const CHECK_EVERY_MS = 4000
const MAX_CHECKS = 30

export default function TicketPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [checks, setChecks] = useState(0)
  const [qr, setQr] = useState<string | null>(null)

  const paid = ticket?.payment_status === 'paid' && ticket.status !== 'cancelled'
  const waiting = ticket?.status === 'pending' && ticket.payment_status === 'pending' && ticket.has_payment

  useEffect(() => {
    if (!token) return
    let stopped = false
    let count = 0
    const load = async (check: boolean) => {
      try {
        const response = await api.get<{ success: boolean; data: Ticket }>(`/tickets/${token}${check ? '?check=1' : ''}`)
        if (stopped) return
        const next = response.data.data
        setTicket(next)
        const stillWaiting = next.status === 'pending' && next.payment_status === 'pending' && next.has_payment
        if (stillWaiting && count < MAX_CHECKS) {
          count += 1
          setChecks(count)
          setTimeout(() => load(true), CHECK_EVERY_MS)
        }
      } catch {
        if (!stopped) setNotFound(true)
      }
    }
    load(true)
    return () => {
      stopped = true
    }
  }, [token])

  useEffect(() => {
    if (!paid || !token) return
    QRCode.toDataURL(`${window.location.origin}/ticket/${token}`, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null))
  }, [paid, token])

  if (notFound) {
    return (
      <div className="text-center py-20 glass rounded-2xl max-w-lg mx-auto">
        <p className="font-display text-xl font-bold text-txt-primary mb-2">Ticket not found</p>
        <p className="text-sm text-txt-muted mb-6">Check the link in your email, or open your ticket from My Bookings.</p>
        <Link href="/" className="text-accent text-sm">Back to trips</Link>
      </div>
    )
  }

  if (!ticket || !ticket.trip) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin" />
        <p className="text-txt-muted text-sm mt-4">Loading your ticket...</p>
      </div>
    )
  }

  const { trip } = ticket
  const expired = ticket.status === 'cancelled' && ticket.payment_status === 'pending'
  const refunded = ticket.payment_status === 'refunded'

  return (
    <>
      <Head>
        <title>DaBus ticket {ticket.ref}</title>
      </Head>
      <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
        {paid && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm font-medium">
            Your seat is confirmed. Show this ticket to the driver when you board.
          </div>
        )}
        {waiting && checks < MAX_CHECKS && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--info),0.08)] border border-[rgba(var(--info),0.2)] text-[rgb(var(--info))] text-sm flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-[rgba(var(--info),0.3)] border-t-[rgb(var(--info))] animate-spin flex-shrink-0" />
            Confirming your payment with Naboopay...
          </div>
        )}
        {waiting && checks >= MAX_CHECKS && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--warning),0.08)] border border-[rgba(var(--warning),0.2)] text-[rgb(var(--warning))] text-sm">
            We haven&apos;t received the payment confirmation yet. If you paid, reload this page in a few minutes, or contact the DaBus team.
          </div>
        )}
        {expired && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--overlay),0.04)] border border-subtle text-txt-secondary text-sm">
            This booking expired before payment. <Link href="/" className="text-accent">Book again</Link>
          </div>
        )}
        {ticket.status === 'cancelled' && !expired && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.08)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
            This ticket was cancelled{refunded ? ' and refunded' : ''}. It is no longer valid.
          </div>
        )}

        <div className={`glass rounded-3xl overflow-hidden ${paid ? '' : 'opacity-70'}`}>
          <div className="p-6 border-b border-subtle">
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">DaBus ticket</p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-txt-primary break-words">
              {trip.origin} <span className="text-accent">&rarr;</span> {trip.destination}
            </h1>
            <p className="text-sm text-txt-secondary mt-1">
              {formatTripDate(trip.departure_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at {trip.departure_time}
              <span className="text-txt-muted"> (Dakar time)</span>
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6">
            <dl className="space-y-3 text-sm">
              {[
                ['Passenger', ticket.full_name || '-'],
                ['Pickup', ticket.pickup_location],
                ['Drop-off', ticket.dropoff_location],
                [paid ? 'Paid' : 'Price', ticket.amount ? `${ticket.amount.toLocaleString()} CFA` : undefined],
                ['Ticket', ticket.ref],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-widest text-txt-muted">{label}</dt>
                    <dd className={`font-semibold text-txt-primary ${label === 'Ticket' ? 'font-mono text-lg' : ''}`}>{value}</dd>
                  </div>
                ))}
            </dl>
            {paid && qr && (
              <div className="flex flex-col items-center gap-2">
                <img src={qr} alt={`QR code for ticket ${ticket.ref}`} className="w-40 h-40 rounded-xl bg-white p-2" />
                <span className="text-xs text-txt-muted">Show this to the driver</span>
              </div>
            )}
          </div>
        </div>

        {paid && (
          <a
            href={`/api/tickets/${token}/pdf`}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-medium bg-gradient-to-r from-accent to-accent-hover text-surface-primary hover:shadow-glow transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download ticket (PDF)
          </a>
        )}
        {paid && (
          <p className="text-center text-xs text-txt-muted">
            Keep this page&apos;s link: it&apos;s your ticket. If you gave an email address, we&apos;ve sent it to you too.
          </p>
        )}
      </div>
    </>
  )
}

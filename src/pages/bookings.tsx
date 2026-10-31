import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'
import { Booking } from '@/types'

export default function BookingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchBookings()
    }
  }, [user])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await api.get<{ success: boolean; data: Booking[] }>('/bookings')
      if (response.data.success) {
        setBookings(response.data.data || [])
      }
    } catch (err) {
      setError('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (booking: Booking) => {
    const paid = booking.payment_status === 'paid'
    const question = paid
      ? 'Cancel this booking? Your payment will be refunded through Naboopay (Wave / Orange Money).'
      : 'Cancel this booking?'
    if (!confirm(question)) return

    try {
      const response = await api.post<{ success: boolean; message?: string }>(`/bookings/${booking.id}/cancel`)
      if (response.data.success) {
        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: 'cancelled', payment_status: paid ? 'refunded' : b.payment_status } : b
        ))
        if (response.data.message) alert(response.data.message)
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Cancellation failed'
      alert(errorMessage)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return 'badge-success'
      case 'pending': return 'badge-warning'
      case 'cancelled': return 'badge-danger'
      case 'completed': return 'badge-neutral'
      default: return 'badge-neutral'
    }
  }

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'badge-success'
      case 'pending': return 'badge-warning'
      case 'refunded': return 'badge-info'
      default: return 'badge-neutral'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin" />
        <p className="text-txt-muted text-sm mt-4">Loading bookings...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>My Bookings - DaBus</title>
      </Head>

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-txt-primary">My Bookings</h1>
          {bookings.length > 0 && (
            <span className="text-sm text-txt-muted">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
            {error}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(var(--accent),0.08)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <p className="text-txt-secondary text-lg mb-1">No bookings yet</p>
            <button
              onClick={() => router.push('/')}
              className="text-accent text-sm hover:underline mt-2"
            >
              Browse available trips
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking, i) => (
              <div
                key={booking.id}
                className="glass rounded-2xl p-5 animate-slide-up"
                style={{ animationDelay: `${i * 0.06}s`, opacity: 0 }}
              >
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {booking.trip && (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-txt-primary">{booking.trip.origin}</span>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                            <div className="w-6 h-px bg-accent" />
                            <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="font-semibold text-txt-primary">{booking.trip.destination}</span>
                        </div>
                        <p className="text-xs text-txt-muted flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(booking.trip.departure_date).toLocaleDateString()} at {booking.trip.departure_time}
                        </p>
                      </>
                    )}
                    {booking.pickup_location && (
                      <p className="text-xs text-txt-secondary mt-1.5 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Pickup: <span className="font-medium text-txt-primary">{booking.pickup_location}</span>
                      </p>
                    )}
                    {booking.dropoff_location && (
                      <p className="text-xs text-txt-secondary mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Drop-off: <span className="font-medium text-txt-primary">{booking.dropoff_location}</span>
                      </p>
                    )}
                    <p className="text-xs text-txt-muted mt-2 font-mono">
                      ID: {booking.id.slice(0, 12)}...
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <span className={`badge ${getStatusBadge(booking.status)}`}>
                      {booking.status}
                    </span>
                    <span className={`badge ${getPaymentBadge(booking.payment_status)}`}>
                      {booking.payment_status === 'paid' ? 'Paid' : booking.payment_status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-subtle flex gap-2">
                  {booking.status === 'confirmed' && booking.trip && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancel(booking)}
                    >
                      Cancel Booking
                    </Button>
                  )}
                  {booking.trip && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/trips/${booking.trip?.id}`)}
                    >
                      View Trip
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import api from '@/lib/api'
import Button from '@/components/Button'
import { useAuth } from '@/context/AuthContext'
import { Trip } from '@/types'

export default function TripDetailsPage() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useAuth()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [customerInfo, setCustomerInfo] = useState({
    full_name: '',
    phone: ''
  })
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTrip()
    }
  }, [id])

  const fetchTrip = async () => {
    try {
      setLoading(true)
      const response = await api.get<{ success: boolean; data: Trip }>(`/trips/${id}`)
      if (response.data.success) {
        setTrip(response.data.data)
      }
    } catch (err) {
      setError('Failed to load trip details')
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = async () => {
    if (!trip) return
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/trips/${String(id || '')}`)}`)
      return
    }

    setBookingLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.post<{ success: boolean; data: { booking: { id: string }; payment?: { checkout_url?: string } } }>('/bookings', {
        trip_id: id,
        full_name: customerInfo.full_name,
        phone: customerInfo.phone
      })

      if (response.data.success) {
        if (response.data.data.payment?.checkout_url) {
          window.location.href = response.data.data.payment.checkout_url
        } else {
          setSuccess('Booking created successfully!')
          setShowForm(false)
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
        (typeof err === 'object' && err && 'response' in err &&
          (err as { response?: { data?: { error?: string } } }).response?.data?.error) || 'Booking failed'
      setError(errorMessage)
    } finally {
      setBookingLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin" />
        <p className="text-txt-muted text-sm mt-4">Loading trip...</p>
      </div>
    )
  }

  if (error && !trip) {
    return (
      <div className="text-center py-20 glass rounded-2xl">
        <p className="text-[rgb(var(--danger))] mb-3">{error}</p>
        <button onClick={fetchTrip} className="text-accent text-sm hover:underline">
          Try again
        </button>
      </div>
    )
  }

  if (!trip) return null

  const fillPercent = ((trip.capacity - trip.available_seats) / trip.capacity) * 100

  return (
    <>
      <Head>
        <title>{trip.origin} to {trip.destination} - DaBus</title>
      </Head>

      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-txt-muted hover:text-txt-secondary transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to trips
        </button>

        <div className="glass rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="relative p-8 sm:p-10 noise-overlay">
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--accent),0.12)] via-transparent to-[rgba(var(--accent),0.04)]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(var(--accent),0.06)] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`badge ${
                    trip.status === 'scheduled' ? 'badge-success' :
                    trip.status === 'full' ? 'badge-warning' : 'badge-neutral'
                  }`}
                >
                  {trip.status === 'scheduled' ? 'Available' : trip.status}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-2">
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-txt-primary">
                  {trip.origin}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <div className="w-12 h-0.5 bg-gradient-to-r from-accent to-accent-hover rounded-full" />
                  <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-txt-primary">
                  {trip.destination}
                </h1>
              </div>

              <p className="text-txt-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(trip.departure_date)} at {trip.departure_time}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-subtle p-5">
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">Price</p>
                <p className="font-display text-2xl font-bold text-gradient">
                  {trip.price.toLocaleString()} <span className="text-sm font-body font-normal text-txt-muted">CFA</span>
                </p>
              </div>
              <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-subtle p-5">
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">Available</p>
                <p className="font-display text-2xl font-bold text-[rgb(var(--success))]">
                  {trip.available_seats} <span className="text-sm font-body font-normal text-txt-muted">/ {trip.capacity}</span>
                </p>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs text-txt-muted mb-2">
                <span>Seats booked</span>
                <span>{trip.capacity - trip.available_seats} / {trip.capacity}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    fillPercent > 80
                      ? 'bg-gradient-to-r from-[rgb(var(--danger))] to-[rgb(var(--warning))]'
                      : 'bg-gradient-to-r from-accent to-accent-hover'
                  }`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            {/* Alerts */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm animate-slide-down">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm animate-slide-down">
                {success}
              </div>
            )}

            {/* Booking Section */}
            {trip.available_seats > 0 && trip.status === 'scheduled' && (
              <div className="pt-4 border-t border-subtle">
                {!showForm ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[rgba(var(--accent),0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-txt-primary">Pay with Wave or Orange Money</p>
                        <p className="text-xs text-txt-muted mt-0.5">
                          You&apos;ll be redirected to complete payment of {trip.price.toLocaleString()} CFA
                        </p>
                      </div>
                    </div>

                    {!user && (
                      <p className="text-xs text-accent">
                        Sign in with your DAUST email to book this trip.
                      </p>
                    )}

                    <Button
                      onClick={() => {
                        if (!user) {
                          router.push(`/login?next=${encodeURIComponent(`/trips/${String(id || '')}`)}`)
                          return
                        }
                        setShowForm(true)
                      }}
                      className="w-full"
                      size="lg"
                    >
                      Book Now &mdash; {trip.price.toLocaleString()} CFA
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[rgba(255,255,255,0.02)] border border-subtle p-6 animate-scale-in">
                    <h3 className="font-display font-bold text-lg text-txt-primary mb-4">Your Information</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleBooking(); }} className="space-y-4">
                      <div>
                        <label htmlFor="full_name" className="block text-xs font-medium text-txt-secondary mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          id="full_name"
                          required
                          className="input-dark"
                          value={customerInfo.full_name}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, full_name: e.target.value })}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-xs font-medium text-txt-secondary mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          required
                          className="input-dark"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                          placeholder="+221 77 123 45 67"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowForm(false)}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          loading={bookingLoading}
                          className="flex-1"
                        >
                          Proceed to Payment
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

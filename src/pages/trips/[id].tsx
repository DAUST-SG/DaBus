import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import api from '@/lib/api'
import Button from '@/components/Button'
import TripUpdates from '@/components/TripUpdates'
import { useAuth } from '@/context/AuthContext'
import { Trip } from '@/types'
import { bookingsOpen, formatDakarTime, formatTripDate, totalPrice } from '@/lib/time'

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
    phone: '',
    email: '',
    pickup_location: '',
    dropoff_location: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [confirmedPickup, setConfirmedPickup] = useState<string | null>(null)

  // Handle payment result query params
  useEffect(() => {
    if (!router.isReady) return
    const { payment } = router.query
    if (payment === 'success') {
      const savedPickup = sessionStorage.getItem(`dabus_pickup_${id}`)
      if (savedPickup) {
        setConfirmedPickup(savedPickup)
        sessionStorage.removeItem(`dabus_pickup_${id}`)
      }
      setSuccess('Payment successful! Your booking is confirmed.')
    } else if (payment === 'error') {
      setError('Payment failed or was cancelled. Please try again.')
    }
  }, [router.isReady, router.query])

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

    setBookingLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.post<{ success: boolean; data: { booking: { id: string }; payment?: { checkout_url?: string } } }>('/bookings', {
        trip_id: id,
        full_name: customerInfo.full_name,
        phone: customerInfo.phone,
        email: customerInfo.email || undefined,
        pickup_location: customerInfo.pickup_location || undefined,
        dropoff_location: customerInfo.dropoff_location || undefined,
      })

      if (response.data.success) {
        if (response.data.data.payment?.checkout_url) {
          if (customerInfo.pickup_location) {
            sessionStorage.setItem(`dabus_pickup_${id}`, customerInfo.pickup_location)
          }
          window.location.href = response.data.data.payment.checkout_url
        } else {
          setConfirmedPickup(customerInfo.pickup_location || null)
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

  // With a single stop the backend picks it, so the picker only shows for 2+
  const pickupOptions = trip?.pickup_checkpoints || []
  const dropoffOptions = trip?.dropoff_checkpoints || []

  const formatDate = (dateStr: string) =>
    formatTripDate(dateStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

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
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-txt-muted hover:text-txt-secondary transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to trips
        </Link>

        <div className="mb-4 empty:hidden"><TripUpdates updates={trip.updates} /></div>

        <div className="glass rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="relative p-8 sm:p-10 noise-overlay">
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--accent),0.12)] via-transparent to-[rgba(var(--accent),0.04)]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(var(--accent),0.06)] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`badge ${
                    !bookingsOpen(trip) ? 'badge-neutral' :
                    trip.status === 'scheduled' ? 'badge-success' :
                    trip.status === 'full' ? 'badge-warning' : 'badge-neutral'
                  }`}
                >
                  {trip.status === 'full' ? 'Full' : !bookingsOpen(trip) ? 'Closed' : 'Available'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-txt-primary break-words">
                  {trip.origin}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <div className="w-12 h-0.5 bg-gradient-to-r from-accent to-accent-hover rounded-full" />
                  <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-txt-primary break-words">
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
              <div className="rounded-2xl bg-[rgba(var(--overlay),0.03)] border border-subtle p-5">
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">Price</p>
                <p className="font-display text-2xl font-bold text-gradient">
                  {totalPrice(trip).toLocaleString()} <span className="text-sm font-body font-normal text-txt-muted">CFA</span>
                </p>
                {!!trip.payment_fee && (
                  <p className="text-xs text-txt-muted mt-1">
                    {trip.price.toLocaleString()} ticket + {trip.payment_fee.toLocaleString()} payment fee ({trip.payment_fee_percent}%).
                    The fee is not refundable.
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-[rgba(var(--overlay),0.03)] border border-subtle p-5">
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">Available</p>
                <p className={`font-display text-2xl font-bold ${bookingsOpen(trip) ? 'text-[rgb(var(--success))]' : 'text-txt-muted'}`}>
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
              <div className="w-full h-2 rounded-full bg-[rgba(var(--overlay),0.06)] overflow-hidden">
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
                <p className="font-medium">{success}</p>
                {confirmedPickup && (
                  <p className="mt-1 text-xs opacity-80 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Pickup point: <span className="font-semibold ml-0.5">{confirmedPickup}</span>
                  </p>
                )}
              </div>
            )}

            {/* Booking Section */}
            {trip.available_seats > 0 && bookingsOpen(trip) && (
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
                          You&apos;ll be redirected to pay {totalPrice(trip).toLocaleString()} CFA
                          {!!trip.payment_fee && <> ({trip.price.toLocaleString()} ticket + {trip.payment_fee.toLocaleString()} Naboopay fee)</>}
                        </p>
                        {!!trip.payment_fee && (
                          <p className="text-xs text-txt-muted mt-0.5">
                            If you cancel, the ticket price is refunded; Naboopay&apos;s {trip.payment_fee.toLocaleString()} CFA fee is not.
                          </p>
                        )}
                        {trip.bookings_close_at && (
                          <p className="text-xs text-txt-muted mt-0.5">
                            Bookings close at {formatDakarTime(trip.bookings_close_at)} (Dakar time)
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => setShowForm(true)}
                      className="w-full"
                      size="lg"
                    >
                      Book Now &mdash; {totalPrice(trip).toLocaleString()} CFA
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[rgba(var(--overlay),0.02)] border border-subtle p-6 animate-scale-in">
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
                      {!user && (
                        <div>
                          <label htmlFor="email" className="block text-xs font-medium text-txt-secondary mb-1.5">
                            Email <span className="text-txt-muted">(optional)</span>
                          </label>
                          <input
                            type="email"
                            id="email"
                            className="input-dark"
                            value={customerInfo.email}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                            placeholder="you@example.com"
                          />
                        </div>
                      )}
                      <StopPicker
                        label="Pickup Location"
                        options={pickupOptions}
                        times={Object.fromEntries((trip.pickup_times || []).map((t) => [t.name, t.time]))}
                        value={customerInfo.pickup_location}
                        onChange={(name) => setCustomerInfo({ ...customerInfo, pickup_location: name })}
                      />
                      <StopPicker
                        label="Drop-off Location"
                        options={dropoffOptions}
                        value={customerInfo.dropoff_location}
                        onChange={(name) => setCustomerInfo({ ...customerInfo, dropoff_location: name })}
                      />
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
                          disabled={(pickupOptions.length > 1 && !customerInfo.pickup_location) || (dropoffOptions.length > 1 && !customerInfo.dropoff_location)}
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

            {trip.available_seats > 0 && !bookingsOpen(trip) && (trip.status === 'scheduled' || trip.status === 'full') && (
              <div className="pt-4 border-t border-subtle">
                <p className="text-sm font-medium text-txt-primary">Bookings are closed for this trip</p>
                <p className="text-xs text-txt-muted mt-1">If you need a seat, contact the DaBus team.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StopPicker({ label, options, times, value, onChange }: {
  label: string
  options: string[]
  times?: Record<string, string>
  value: string
  onChange: (name: string) => void
}) {
  // A single stop needs no choice, but its time is still worth showing
  if (options.length === 1 && times?.[options[0]]) {
    return <p className="text-sm text-txt-secondary">{label}: <strong className="text-txt-primary">{options[0]}</strong> at {times[options[0]]}</p>
  }
  if (options.length < 2) return null
  return (
    <div>
      <label className="block text-xs font-medium text-txt-secondary mb-1.5">
        {label} <span className="text-[rgb(var(--danger))]" aria-hidden>*</span>
      </label>
      <div className="grid grid-cols-1 gap-2">
        {options.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={value === name}
            onClick={() => onChange(name)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
              value === name
                ? 'border-accent bg-[rgba(var(--accent),0.1)] text-txt-primary'
                : 'border-subtle bg-[rgba(var(--overlay),0.02)] text-txt-secondary hover:border-[rgba(var(--accent),0.4)] hover:bg-[rgba(var(--accent),0.04)]'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              value === name ? 'border-accent' : 'border-[rgba(var(--overlay),0.2)]'
            }`}>
              {value === name && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
            <span className="text-sm font-medium flex-1">{name}</span>
            {times?.[name] && <span className="text-sm text-txt-muted tabular-nums">{times[name]}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

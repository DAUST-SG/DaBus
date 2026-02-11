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
  
  // Customer info form state
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
          // Redirect to Naboopay checkout
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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error && !trip) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button onClick={fetchTrip} className="mt-4 text-blue-600 hover:text-blue-700">
          Try Again
        </button>
      </div>
    )
  }

  if (!trip) return null

  return (
    <>
      <Head>
        <title>{trip.origin} to {trip.destination} - DaBus</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
            <h1 className="text-3xl font-bold">
              {trip.origin} → {trip.destination}
            </h1>
            <p className="text-blue-100 mt-2">
              {formatDate(trip.departure_date)} at {trip.departure_time}
            </p>
          </div>

          <div className="p-8 space-y-6">
            {/* Trip Details */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Price</p>
                <p className="text-2xl font-bold text-blue-600">
                  {trip.price.toLocaleString()} CFA
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Available Seats</p>
                <p className="text-2xl font-bold text-green-600">
                  {trip.available_seats} / {trip.capacity}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Seats booked</span>
                <span>{trip.capacity - trip.available_seats} / {trip.capacity}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${((trip.capacity - trip.available_seats) / trip.capacity) * 100}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                trip.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                trip.status === 'full' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trip.status === 'scheduled' ? 'Available' : trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
              </span>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Booking Section */}
            {trip.available_seats > 0 && trip.status === 'scheduled' && (
              <div className="border-t pt-6">
                {!showForm ? (
                  <>
                    <h3 className="font-semibold text-lg mb-4">Pay with Naboopay</h3>
                    <p className="text-gray-600 mb-4">
                      You will be redirected to complete your payment of {trip.price.toLocaleString()} CFA via Wave or Orange Money.
                    </p>
                    {!user && (
                      <p className="text-sm text-blue-700 mb-4">
                        Sign in with your DAUST student email to book this trip.
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
                      disabled={trip.available_seats === 0}
                    >
                      {trip.available_seats === 0 ? 'Sold Out' : `Book Now - ${trip.price.toLocaleString()} CFA`}
                    </Button>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-4">Enter Your Information</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleBooking(); }} className="space-y-4">
                      <div>
                        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          id="full_name"
                          required
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={customerInfo.full_name}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, full_name: e.target.value })}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          required
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                          placeholder="+221 77 123 45 67"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowForm(false)}
                          className="flex-1"
                        >
                          Cancel
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

        <button
          onClick={() => router.back()}
          className="mt-4 text-gray-600 hover:text-gray-900"
        >
          ← Back to trips
        </button>
      </div>
    </>
  )
}

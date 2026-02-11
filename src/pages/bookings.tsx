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

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to request cancellation?')) return

    try {
      const response = await api.post<{ success: boolean; message?: string }>(`/bookings/${bookingId}/cancel`)
      if (response.data.success) {
        setBookings(bookings.map(b => 
          b.id === bookingId ? { ...b, status: 'cancelled' } : b
        ))
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err && 
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Cancellation failed'
      alert(errorMessage)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'refunded': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>My Bookings - DaBus</title>
      </Head>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-lg">No bookings yet</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Browse Trips
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div>
                    {booking.trip && (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {booking.trip.origin} → {booking.trip.destination}
                        </h3>
                        <p className="text-gray-500">
                          {new Date(booking.trip.departure_date).toLocaleDateString()} at {booking.trip.departure_time}
                        </p>
                      </>
                    )}
                    <p className="text-sm text-gray-400 mt-1">
                      Booking ID: {booking.id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(booking.payment_status)}`}>
                      {booking.payment_status === 'paid' ? 'Paid' : booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex gap-3">
                  {booking.status === 'confirmed' && booking.trip && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancel(booking.id)}
                    >
                      Request Cancellation
                    </Button>
                  )}
                  {booking.trip && (
                    <Button
                      variant="outline"
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

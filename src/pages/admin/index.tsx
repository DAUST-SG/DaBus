import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'
import { DashboardStats, Trip, Booking } from '@/types'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [recentTrips, setRecentTrips] = useState<Trip[]>([])
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [selectedTripId, setSelectedTripId] = useState('all')
  const [registrationQuery, setRegistrationQuery] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateTrip, setShowCreateTrip] = useState(false)
  const [newTrip, setNewTrip] = useState({
    origin: '',
    destination: '',
    departure_date: '',
    departure_time: '',
    capacity: 50,
    price: null as number | null,
  })
  const [creatingTrip, setCreatingTrip] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [statsRes, tripsRes, bookingsRes] = await Promise.all([
        api.get<{ success: boolean; data: DashboardStats }>('/admin/stats'),
        api.get<{ success: boolean; data: Trip[] }>('/admin/trips'),
        api.get<{ success: boolean; data: Booking[] }>('/admin/bookings'),
      ])

      if (statsRes.data.success) setStats(statsRes.data.data)
      if (tripsRes.data.success) {
        const trips = tripsRes.data.data || []
        setAllTrips(trips)
        setRecentTrips(trips.slice(0, 5))
      }
      if (bookingsRes.data.success) {
        const bookings = bookingsRes.data.data || []
        setAllBookings(bookings)
        setRecentBookings(bookings.slice(0, 5))
      }
    } catch (err) {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingTrip(true)
    try {
      const response = await api.post<{ success: boolean; data: Trip }>('/trips', newTrip)
      if (response.data.success) {
        setShowCreateTrip(false)
        setNewTrip({ origin: '', destination: '', departure_date: '', departure_time: '', capacity: 50, price: null })
        await fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err && 
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to create trip'
      alert(errorMessage)
    } finally {
      setCreatingTrip(false)
    }
  }

  const handleConfirmBooking = async (bookingId: string) => {
    try {
      setConfirmingId(bookingId)
      const response = await api.post<{ success: boolean }>(`/admin/bookings/${bookingId}/status`, {
        status: 'confirmed',
      })
      if (response.data.success) {
        fetchDashboardData()
      }
    } catch (err) {
      alert('Failed to confirm booking')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleExport = async (type: 'trips' | 'bookings' | 'report') => {
    try {
      const response = await api.get<Blob>(`/admin/export/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}_export.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      alert('Failed to export')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  const normalizedQuery = registrationQuery.trim().toLowerCase()
  const filteredBookings = allBookings.filter((booking) => {
    if (selectedTripId !== 'all' && booking.trip_id !== selectedTripId) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchable = [
      booking.full_name || '',
      booking.phone || '',
      booking.trip?.origin || '',
      booking.trip?.destination || '',
    ]
      .join(' ')
      .toLowerCase()

    return searchable.includes(normalizedQuery)
  })

  return (
    <>
      <Head>
        <title>Admin Dashboard - DaBus</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('trips')}>Export Trips</Button>
            <Button variant="outline" onClick={() => handleExport('bookings')}>Export Bookings</Button>
            <Button onClick={() => setShowCreateTrip(true)}>Create Trip</Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Total Trips</p>
            <p className="text-3xl font-bold text-blue-600">{stats?.totalTrips || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-3xl font-bold text-green-600">{stats?.totalBookings || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-3xl font-bold text-yellow-600">
              {(stats?.totalRevenue || 0).toLocaleString()} CFA
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Upcoming Trips</p>
            <p className="text-3xl font-bold text-purple-600">{stats?.upcomingTrips || 0}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Trips</h2>
            {recentTrips.length === 0 ? (
              <p className="text-gray-500">No trips yet</p>
            ) : (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <div key={trip.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{trip.origin} → {trip.destination}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(trip.departure_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      trip.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                      trip.status === 'full' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {trip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
            {recentBookings.length === 0 ? (
              <p className="text-gray-500">No bookings yet</p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{booking.full_name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{booking.phone || 'No phone'}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status}
                      </span>
                      {booking.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={confirmingId === booking.id}
                          onClick={() => handleConfirmBooking(booking.id)}
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Trip Registrations</h2>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select
              className="w-full md:w-80 px-3 py-2 border rounded-lg"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
            >
              <option value="all">All trips</option>
              {allTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.origin} → {trip.destination} ({new Date(trip.departure_date).toLocaleDateString()})
                </option>
              ))}
            </select>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Search by passenger, phone, origin, destination"
              value={registrationQuery}
              onChange={(e) => setRegistrationQuery(e.target.value)}
            />
          </div>

          {filteredBookings.length === 0 ? (
            <p className="text-gray-500">No registrations found for this filter</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Trip</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Passenger</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Booked On</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="bg-white">
                      <td className="px-4 py-3 text-sm">
                        {booking.trip ? (
                          <div>
                            <p className="font-medium text-gray-900">{booking.trip.origin} → {booking.trip.destination}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(booking.trip.departure_date).toLocaleDateString()} at {booking.trip.departure_time}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-500">Trip unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{booking.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{booking.phone || 'No phone'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {booking.status === 'pending' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={confirmingId === booking.id}
                            onClick={() => handleConfirmBooking(booking.id)}
                          >
                            Confirm
                          </Button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Trip Modal */}
        {showCreateTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Create New Trip</h2>
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newTrip.origin}
                      onChange={(e) => setNewTrip({ ...newTrip, origin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newTrip.destination}
                      onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newTrip.departure_date}
                      onChange={(e) => setNewTrip({ ...newTrip, departure_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      required
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newTrip.departure_time}
                      onChange={(e) => setNewTrip({ ...newTrip, departure_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newTrip.capacity}
                      onChange={(e) => setNewTrip({ ...newTrip, capacity: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (CFA)</label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newTrip.price ?? ''}
                      onChange={(e) => setNewTrip({ ...newTrip, price: e.target.value ? parseInt(e.target.value) : null })}
                    >
                      <option value="">Select price</option>
                      <option value={2500}>2500 CFA</option>
                      <option value={3000}>3000 CFA</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateTrip(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={creatingTrip} className="flex-1">
                    Create Trip
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

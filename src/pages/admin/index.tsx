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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin" />
        <p className="text-txt-muted text-sm mt-4">Loading dashboard...</p>
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

  const statCards = [
    {
      label: 'Total Trips',
      value: stats?.totalTrips || 0,
      color: 'accent',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      ),
    },
    {
      label: 'Total Bookings',
      value: stats?.totalBookings || 0,
      color: 'success',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      ),
    },
    {
      label: 'Revenue',
      value: `${(stats?.totalRevenue || 0).toLocaleString()} CFA`,
      color: 'warning',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
    {
      label: 'Upcoming',
      value: stats?.upcomingTrips || 0,
      color: 'info',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
  ]

  const colorMap: Record<string, string> = {
    accent: 'var(--accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    info: 'var(--info)',
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - DaBus</title>
      </Head>

      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-txt-primary">Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleExport('trips')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Trips
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleExport('bookings')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Bookings
            </Button>
            <Button size="sm" onClick={() => setShowCreateTrip(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Trip
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className="stat-card animate-slide-up"
              style={{
                animationDelay: `${i * 0.08}s`,
                opacity: 0,
                ['--stat-color' as string]: colorMap[card.color],
              }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-10"
                style={{ background: `rgb(${colorMap[card.color]})` }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `rgba(${colorMap[card.color]}, 0.12)` }}
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: `rgb(${colorMap[card.color]})` }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      {card.icon}
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">{card.label}</p>
                <p className="font-display text-2xl font-bold text-txt-primary">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Trips */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-display font-bold text-txt-primary mb-4">Recent Trips</h2>
            {recentTrips.length === 0 ? (
              <p className="text-txt-muted text-sm">No trips yet</p>
            ) : (
              <div className="space-y-2">
                {recentTrips.map((trip) => (
                  <div key={trip.id} className="flex justify-between items-center p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-txt-primary">
                        {trip.origin} <span className="text-accent mx-1">&rarr;</span> {trip.destination}
                      </p>
                      <p className="text-xs text-txt-muted">
                        {new Date(trip.departure_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`badge ${
                      trip.status === 'scheduled' ? 'badge-success' :
                      trip.status === 'full' ? 'badge-warning' : 'badge-neutral'
                    }`}>
                      {trip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bookings */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-display font-bold text-txt-primary mb-4">Recent Bookings</h2>
            {recentBookings.length === 0 ? (
              <p className="text-txt-muted text-sm">No bookings yet</p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="flex justify-between items-center p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-txt-primary">{booking.full_name || 'Unknown'}</p>
                      <p className="text-xs text-txt-muted">{booking.phone || 'No phone'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${
                        booking.status === 'confirmed' ? 'badge-success' :
                        booking.status === 'pending' ? 'badge-warning' : 'badge-neutral'
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

        {/* Registrations Table */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-txt-primary mb-4">Trip Registrations</h2>
          <div className="flex flex-col md:flex-row gap-3 mb-5">
            <select
              className="input-dark md:w-80"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
            >
              <option value="all">All trips</option>
              {allTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.origin} &rarr; {trip.destination} ({new Date(trip.departure_date).toLocaleDateString()})
                </option>
              ))}
            </select>
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="input-dark pl-10"
                placeholder="Search passengers..."
                value={registrationQuery}
                onChange={(e) => setRegistrationQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <p className="text-txt-muted text-sm py-6 text-center">No registrations found</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-subtle">
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Trip</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Passenger</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Phone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Booked</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-6 py-3.5">
                        {booking.trip ? (
                          <div>
                            <p className="text-sm font-medium text-txt-primary">
                              {booking.trip.origin} <span className="text-accent">&rarr;</span> {booking.trip.destination}
                            </p>
                            <p className="text-xs text-txt-muted">
                              {new Date(booking.trip.departure_date).toLocaleDateString()} at {booking.trip.departure_time}
                            </p>
                          </div>
                        ) : (
                          <span className="text-txt-muted text-sm">Unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-primary">{booking.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3.5 text-sm text-txt-secondary font-mono">{booking.phone || '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-txt-muted">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`badge ${
                          booking.status === 'confirmed' ? 'badge-success' :
                          booking.status === 'pending' ? 'badge-warning' : 'badge-neutral'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
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
                          <span className="text-txt-muted text-xs">&mdash;</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateTrip(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">Create Trip</h2>
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Origin</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      value={newTrip.origin}
                      onChange={(e) => setNewTrip({ ...newTrip, origin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Destination</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      value={newTrip.destination}
                      onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      className="input-dark"
                      value={newTrip.departure_date}
                      onChange={(e) => setNewTrip({ ...newTrip, departure_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Time</label>
                    <input
                      type="time"
                      required
                      className="input-dark"
                      value={newTrip.departure_time}
                      onChange={(e) => setNewTrip({ ...newTrip, departure_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Capacity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="input-dark"
                      value={newTrip.capacity}
                      onChange={(e) => setNewTrip({ ...newTrip, capacity: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Price (CFA)</label>
                    <select
                      required
                      className="input-dark"
                      value={newTrip.price ?? ''}
                      onChange={(e) => setNewTrip({ ...newTrip, price: e.target.value ? parseInt(e.target.value) : null })}
                    >
                      <option value="">Select</option>
                      <option value={2500}>2,500 CFA</option>
                      <option value={3000}>3,000 CFA</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCreateTrip(false)}>
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

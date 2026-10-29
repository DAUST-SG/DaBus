import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'
import DatePicker from '@/components/DatePicker'
import TimePicker from '@/components/TimePicker'
import { DashboardStats, Trip, Booking, Checkpoint } from '@/types'

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
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
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

  // Export modal state
  const [showExport, setShowExport] = useState(false)
  const [exportTripId, setExportTripId] = useState('all')
  const [exportingBookings, setExportingBookings] = useState(false)

  // Add Admin modal state
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ email: '', full_name: '', phone: '', password: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [addAdminError, setAddAdminError] = useState<string | null>(null)
  const [addAdminSuccess, setAddAdminSuccess] = useState(false)

  // Change Password modal state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)

  // Checkpoints
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [newCheckpoint, setNewCheckpoint] = useState({ name: '', city: '' })
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)
  const [checkpointError, setCheckpointError] = useState<string | null>(null)

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
    if (!newTrip.departure_date || !newTrip.departure_time) {
      alert('Please select a departure date and time')
      return
    }
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

  const handleExportBookings = async () => {
    setExportingBookings(true)
    try {
      const params = new URLSearchParams({ paid_only: 'true' })
      if (exportTripId !== 'all') params.set('trip_id', exportTripId)
      const response = await api.get<Blob>(`/admin/export/bookings?${params.toString()}`, { responseType: 'blob' })
      const tripLabel = exportTripId !== 'all'
        ? allTrips.find((t) => t.id === exportTripId)?.departure_date || exportTripId
        : 'all'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bookings_${tripLabel}_paid.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShowExport(false)
    } catch {
      alert('Failed to export bookings')
    } finally {
      setExportingBookings(false)
    }
  }

  const handleArchiveTrip = async (tripId: string) => {
    if (!confirm('Archive this trip? It will be hidden from users.')) return
    try {
      setArchivingId(tripId)
      const response = await api.put<{ success: boolean }>(`/trips/${tripId}`, { status: 'archived' })
      if (response.data.success) {
        fetchDashboardData()
      }
    } catch (err) {
      alert('Failed to archive trip')
    } finally {
      setArchivingId(null)
    }
  }

  const handleSyncBooking = async (bookingId: string) => {
    try {
      setSyncMessage(null)
      setSyncingId(bookingId)
      const response = await api.post<{ success: boolean; data: { changed: boolean; remoteStatus?: string } }>(`/admin/bookings/${bookingId}/sync`)
      if (response.data.success) {
        const { changed, remoteStatus } = response.data.data
        setSyncMessage(
          changed
            ? `Booking updated from Naboopay (status: ${remoteStatus || 'unknown'})`
            : `Already in sync with Naboopay (status: ${remoteStatus || 'unknown'})`,
        )
        fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to sync booking'
      setSyncMessage(`Sync failed: ${errorMessage}`)
    } finally {
      setSyncingId(null)
    }
  }

  const handleSyncAll = async () => {
    if (!confirm('Sync all eligible bookings with Naboopay? This may take a moment.')) return
    try {
      setSyncMessage(null)
      setSyncingAll(true)
      const response = await api.post<{ success: boolean; data: { total: number; updated: number; unchanged: number; errors: number } }>(`/admin/bookings/sync-all`)
      if (response.data.success) {
        const { total, updated, unchanged, errors } = response.data.data
        setSyncMessage(`Synced ${total} bookings — ${updated} updated, ${unchanged} unchanged, ${errors} errors`)
        fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to sync bookings'
      setSyncMessage(`Sync failed: ${errorMessage}`)
    } finally {
      setSyncingAll(false)
    }
  }

  const handleRefundBooking = async (bookingId: string) => {
    if (!confirm('Refund this booking? This will call Naboopay refund and cancel the booking.')) return
    try {
      setRefundingId(bookingId)
      const response = await api.post<{ success: boolean }>(`/admin/bookings/${bookingId}/refund`)
      if (response.data.success) {
        fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to refund booking'
      alert(errorMessage)
    } finally {
      setRefundingId(null)
    }
  }

  const isDepartureMoreThan3hAway = (trip?: Trip) => {
    if (!trip) return false
    const departure = new Date(`${trip.departure_date}T${trip.departure_time}`)
    const nowPlus3h = new Date(Date.now() + 3 * 60 * 60 * 1000)
    return departure > nowPlus3h
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddAdminError(null)
    setAddAdminSuccess(false)
    setAddingAdmin(true)
    try {
      const response = await api.post<{ success: boolean }>('/admin/members', newAdmin)
      if (response.data.success) {
        setAddAdminSuccess(true)
        setNewAdmin({ email: '', full_name: '', phone: '', password: '' })
        setTimeout(() => {
          setShowAddAdmin(false)
          setAddAdminSuccess(false)
        }, 1500)
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to add admin'
      setAddAdminError(errorMessage)
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError(null)
    setChangePasswordSuccess(false)

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setChangePasswordError('New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const response = await api.post<{ success: boolean }>('/admin/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      if (response.data.success) {
        setChangePasswordSuccess(true)
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
        setTimeout(() => {
          setShowChangePassword(false)
          setChangePasswordSuccess(false)
        }, 1500)
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to change password'
      setChangePasswordError(errorMessage)
    } finally {
      setChangingPassword(false)
    }
  }

  const apiError = (err: unknown, fallback: string) =>
    (typeof err === 'object' && err && 'response' in err &&
      (err as { response?: { data?: { error?: string } } }).response?.data?.error) || fallback

  const openCheckpoints = async () => {
    setShowCheckpoints(true)
    setCheckpointError(null)
    try {
      const response = await api.get<{ success: boolean; data: Checkpoint[] }>('/admin/checkpoints')
      if (response.data.success) setCheckpoints(response.data.data)
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to load checkpoints'))
    }
  }

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCheckpoint(true)
    setCheckpointError(null)
    try {
      const response = await api.post<{ success: boolean; data: Checkpoint }>('/admin/checkpoints', newCheckpoint)
      if (response.data.success) {
        setCheckpoints([...checkpoints, response.data.data])
        setNewCheckpoint({ name: '', city: newCheckpoint.city })
      }
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to add checkpoint'))
    } finally {
      setSavingCheckpoint(false)
    }
  }

  const handleToggleCheckpoint = async (checkpoint: Checkpoint) => {
    setCheckpointError(null)
    try {
      const response = await api.patch<{ success: boolean; data: Checkpoint }>('/admin/checkpoints', {
        id: checkpoint.id,
        active: !checkpoint.active,
      })
      if (response.data.success) {
        setCheckpoints(checkpoints.map((c) => (c.id === checkpoint.id ? response.data.data : c)))
      }
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to update checkpoint'))
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

  // Compute total paid revenue per trip
  const revenueByTrip = allBookings.reduce<Record<string, number>>((acc, booking) => {
    if (booking.payment_status === 'paid' && booking.trip_id) {
      const trip = allTrips.find((t) => t.id === booking.trip_id)
      if (trip) {
        acc[booking.trip_id] = (acc[booking.trip_id] || 0) + trip.price
      }
    }
    return acc
  }, {})

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
      booking.pickup_location || '',
      booking.dropoff_location || '',
    ]
      .join(' ')
      .toLowerCase()

    return searchable.includes(normalizedQuery)
  })

  // Head count per stop for the selected trip, so the driver knows who to expect where
  const countByStop = (key: 'pickup_location' | 'dropoff_location') =>
    Object.entries(
      filteredBookings
        .filter((b) => b.status !== 'cancelled' && b[key])
        .reduce<Record<string, number>>((acc, b) => {
          acc[b[key] as string] = (acc[b[key] as string] || 0) + 1
          return acc
        }, {}),
    ).sort((a, b) => b[1] - a[1])
  const stopSummary = selectedTripId === 'all' ? [] : [
    { label: 'Pickup', counts: countByStop('pickup_location') },
    { label: 'Drop-off', counts: countByStop('dropoff_location') },
  ].filter((group) => group.counts.length > 0)

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
            <Button variant="ghost" size="sm" onClick={() => { setExportTripId('all'); setShowExport(true) }}>
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
            <Button variant="outline" size="sm" onClick={openCheckpoints}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Checkpoints
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddAdmin(true); setAddAdminError(null); setAddAdminSuccess(false) }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Admin
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowChangePassword(true); setChangePasswordError(null); setChangePasswordSuccess(false) }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Password
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
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-[rgb(var(--warning))]">
                        {(revenueByTrip[trip.id] || 0).toLocaleString()} CFA
                      </span>
                      <span className={`badge ${trip.status === 'scheduled' ? 'badge-success' :
                          trip.status === 'full' ? 'badge-warning' :
                            trip.status === 'archived' ? 'badge-neutral opacity-60' : 'badge-neutral'
                        }`}>
                        {trip.status}
                      </span>
                      {trip.status !== 'archived' && trip.status !== 'completed' && trip.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={archivingId === trip.id}
                          onClick={() => handleArchiveTrip(trip.id)}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
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
                      <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' :
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
                      {booking.payment_status === 'paid' && booking.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={refundingId === booking.id}
                          disabled={!isDepartureMoreThan3hAway(booking.trip)}
                          onClick={() => handleRefundBooking(booking.id)}
                          title={!isDepartureMoreThan3hAway(booking.trip) ? 'Cannot refund — less than 3h before departure' : 'Refund'}
                        >
                          Refund
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-txt-primary">Trip Registrations</h2>
            <Button
              variant="outline"
              size="sm"
              loading={syncingAll}
              onClick={handleSyncAll}
              title="Query Naboopay for the latest payment status of every booking"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync from Naboopay
            </Button>
          </div>
          {syncMessage && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--info),0.08)] border border-[rgba(var(--info),0.2)] text-[rgb(var(--info))] text-sm flex items-start justify-between gap-3">
              <span>{syncMessage}</span>
              <button
                type="button"
                onClick={() => setSyncMessage(null)}
                className="text-txt-muted hover:text-txt-primary"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
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

          {stopSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {stopSummary.map((group) => (
                <div key={group.label} className="rounded-xl border border-subtle p-4">
                  <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-2">{group.label}</p>
                  <ul className="space-y-1.5">
                    {group.counts.map(([name, count]) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setRegistrationQuery(name)}
                          className="w-full flex items-center justify-between text-sm text-txt-secondary hover:text-txt-primary"
                          title={`Show passengers for ${name}`}
                        >
                          <span>{name}</span>
                          <span className="font-semibold text-txt-primary">{count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

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
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Pickup</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Drop-off</th>
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
                      <td className="px-4 py-3.5 text-sm">
                        {booking.pickup_location ? (
                          <span className="inline-flex items-center gap-1 text-txt-secondary">
                            <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {booking.pickup_location}
                          </span>
                        ) : (
                          <span className="text-txt-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-secondary">
                        {booking.dropoff_location || <span className="text-txt-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-muted">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5">
                          <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' :
                              booking.status === 'pending' ? 'badge-warning' : 'badge-neutral'
                            }`}>
                            {booking.status}
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${
                            booking.payment_status === 'paid' ? 'text-[rgb(var(--success))]' :
                            booking.payment_status === 'refunded' ? 'text-[rgb(var(--warning))]' : 'text-txt-muted'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              booking.payment_status === 'paid' ? 'bg-[rgb(var(--success))]' :
                              booking.payment_status === 'refunded' ? 'bg-[rgb(var(--warning))]' : 'bg-[rgba(255,255,255,0.2)]'
                            }`} />
                            {booking.payment_status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                          {booking.payment_id && booking.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={syncingId === booking.id}
                              onClick={() => handleSyncBooking(booking.id)}
                              title="Query Naboopay for the latest payment status"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Sync
                            </Button>
                          )}
                          {booking.payment_status === 'paid' && booking.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={refundingId === booking.id}
                              disabled={!isDepartureMoreThan3hAway(booking.trip)}
                              onClick={() => handleRefundBooking(booking.id)}
                              title={!isDepartureMoreThan3hAway(booking.trip) ? 'Cannot refund — trip departs in less than 3 hours' : 'Refund this booking'}
                            >
                              Refund
                            </Button>
                          )}
                          {booking.status !== 'pending' && booking.payment_status !== 'paid' && !booking.payment_id && (
                            <span className="text-txt-muted text-xs">&mdash;</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export Bookings Modal */}
        {showExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExport(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-1">Export Bookings</h2>
              <p className="text-sm text-txt-muted mb-5">Only paid, non-cancelled bookings will be included.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Filter by Shuttle</label>
                  <select
                    className="input-dark"
                    value={exportTripId}
                    onChange={(e) => setExportTripId(e.target.value)}
                  >
                    <option value="all">All shuttles</option>
                    {allTrips.filter((t) => t.status !== 'archived').map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.origin} → {trip.destination} &mdash; {new Date(trip.departure_date).toLocaleDateString()} {trip.departure_time}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-[rgba(var(--success),0.25)] bg-[rgba(var(--success),0.06)] px-4 py-3 text-sm text-[rgb(var(--success))] flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Includes only <strong>paid</strong> bookings. Cancelled and pending/unpaid bookings are excluded.</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowExport(false)}>
                  Cancel
                </Button>
                <Button loading={exportingBookings} className="flex-1" onClick={handleExportBookings}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </Button>
              </div>
            </div>
          </div>
        )}

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
                    <DatePicker
                      value={newTrip.departure_date}
                      onChange={(val) => setNewTrip({ ...newTrip, departure_date: val })}
                    />
                    <input type="hidden" required value={newTrip.departure_date} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Time</label>
                    <TimePicker
                      value={newTrip.departure_time}
                      onChange={(val) => setNewTrip({ ...newTrip, departure_time: val })}
                    />
                    <input type="hidden" required value={newTrip.departure_time} />
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
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      className="input-dark"
                      placeholder="e.g. 2500"
                      value={newTrip.price ?? ''}
                      onChange={(e) => setNewTrip({ ...newTrip, price: e.target.value ? parseInt(e.target.value) : null })}
                    />
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

        {/* Add Admin Modal */}
        {showAddAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddAdmin(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">Add Admin Member</h2>

              {addAdminSuccess && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm">
                  Admin added successfully!
                </div>
              )}
              {addAdminError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {addAdminError}
                </div>
              )}

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    className="input-dark"
                    placeholder="admin@example.com"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    className="input-dark"
                    placeholder="John Doe"
                    value={newAdmin.full_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Phone</label>
                  <input
                    type="tel"
                    required
                    className="input-dark"
                    placeholder="+221 77 000 0000"
                    value={newAdmin.phone}
                    onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    placeholder="Min 6 characters"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddAdmin(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={addingAdmin} className="flex-1">
                    Add Admin
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Checkpoints Modal */}
        {showCheckpoints && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckpoints(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-1">Checkpoints</h2>
              <p className="text-xs text-txt-muted mb-5">
                Students pick from the active stops in the trip&apos;s origin city (pickup) and destination city (drop-off).
              </p>

              {checkpointError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {checkpointError}
                </div>
              )}

              {checkpoints.length === 0 ? (
                <p className="text-txt-muted text-sm mb-5">No checkpoints yet</p>
              ) : (
                <ul className="divide-y divide-subtle mb-5">
                  {checkpoints.map((checkpoint) => (
                    <li key={checkpoint.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className={checkpoint.active ? '' : 'opacity-50'}>
                        <p className="text-sm font-medium text-txt-primary">{checkpoint.name}</p>
                        <p className="text-xs text-txt-muted capitalize">{checkpoint.city}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleCheckpoint(checkpoint)}>
                        {checkpoint.active ? 'Turn off' : 'Turn on'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddCheckpoint} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      placeholder="Liberté 6"
                      value={newCheckpoint.name}
                      onChange={(e) => setNewCheckpoint({ ...newCheckpoint, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">City</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      placeholder="Dakar"
                      value={newCheckpoint.city}
                      onChange={(e) => setNewCheckpoint({ ...newCheckpoint, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCheckpoints(false)}>
                    Close
                  </Button>
                  <Button type="submit" loading={savingCheckpoint} className="flex-1">
                    Add Checkpoint
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowChangePassword(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">Change Password</h2>

              {changePasswordSuccess && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm">
                  Password changed successfully!
                </div>
              )}
              {changePasswordError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {changePasswordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    className="input-dark"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    placeholder="Min 6 characters"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowChangePassword(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={changingPassword} className="flex-1">
                    Update Password
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

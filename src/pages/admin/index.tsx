import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'
import DatePicker from '@/components/DatePicker'
import TimePicker from '@/components/TimePicker'
import { DashboardStats, Trip, Booking } from '@/types'
import { bookingsOpen, formatDakarTime } from '@/lib/time'
import SettingsTab from '@/components/admin/SettingsTab'
import UpdatesTab from '@/components/admin/UpdatesTab'
import RevenueTab from '@/components/admin/RevenueTab'
import BookingsTab from '@/components/admin/BookingsTab'
import { apiError, BookingRules, formatCfa, formatDeparture, tripBadge } from '@/components/admin/shared'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'trips', label: 'Trips' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'updates', label: 'Updates' },
  { id: 'settings', label: 'Settings' },
] as const
type Tab = (typeof TABS)[number]['id']


const EMPTY_TRIP = {
  origin: '',
  destination: '',
  departure_date: '',
  departure_time: '',
  capacity: 50,
  price: null as number | null,
  // Empty = the default from Settings
  booking_close_minutes: null as number | null,
  // Optional auto-cancel rule; both set or both empty
  min_seats: null as number | null,
  cutoff_hours: null as number | null,
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [showArchived, setShowArchived] = useState(false)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  // Trip preselected in the Bookings tab ("all" = every trip)
  const [bookingsTripId, setBookingsTripId] = useState('all')
  const [updatesTripId, setUpdatesTripId] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null)
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateTrip, setShowCreateTrip] = useState(false)
  const [newTrip, setNewTrip] = useState(EMPTY_TRIP)
  // Set when the trip modal is editing an existing trip instead of creating one
  const [editingTripId, setEditingTripId] = useState<string | null>(null)
  const [creatingTrip, setCreatingTrip] = useState(false)





  // Booking rules (Settings tab)
  const [bookingRules, setBookingRules] = useState<BookingRules | null>(null)

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

  // Only the first load blanks the page; refreshes after an action happen in the background
  // (each button shows its own spinner), so the admin keeps their place on the page.
  const fetchDashboardData = async () => {
    try {
      const [statsRes, tripsRes, bookingsRes] = await Promise.all([
        api.get<{ success: boolean; data: DashboardStats }>('/admin/stats'),
        api.get<{ success: boolean; data: Trip[] }>('/admin/trips'),
        // ponytail: loads every booking at once (the API defaults to 100); paginate if this passes a few thousand
        api.get<{ success: boolean; data: Booking[] }>('/admin/bookings?limit=5000'),
      ])

      if (statsRes.data.success) setStats(statsRes.data.data)
      if (tripsRes.data.success) {
        setAllTrips(tripsRes.data.data || [])
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

  const openCreateTrip = () => {
    if (!bookingRules) loadBookingRules()
    setEditingTripId(null)
    setNewTrip(EMPTY_TRIP)
    setShowCreateTrip(true)
  }

  const openEditTrip = (trip: Trip) => {
    if (!bookingRules) loadBookingRules()
    setEditingTripId(trip.id)
    setNewTrip({
      origin: trip.origin,
      destination: trip.destination,
      departure_date: trip.departure_date,
      departure_time: trip.departure_time,
      capacity: trip.capacity,
      price: trip.price,
      min_seats: trip.min_seats ?? null,
      cutoff_hours: trip.cutoff_hours ?? null,
      booking_close_minutes: trip.booking_close_minutes ?? null,
    })
    setShowCreateTrip(true)
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTrip.departure_date || !newTrip.departure_time) {
      alert('Please select a departure date and time')
      return
    }
    setCreatingTrip(true)
    // An empty or 0 minimum means "no minimum": drop the hours too, so it's removed cleanly
    const payload = newTrip.min_seats ? newTrip : { ...newTrip, min_seats: null, cutoff_hours: null }
    try {
      const response = editingTripId
        ? await api.put<{ success: boolean; data: Trip }>(`/trips/${editingTripId}`, payload)
        : await api.post<{ success: boolean; data: Trip }>('/trips', payload)
      if (response.data.success) {
        setShowCreateTrip(false)
        setEditingTripId(null)
        setNewTrip(EMPTY_TRIP)
        await fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        (editingTripId ? 'Failed to update trip' : 'Failed to create trip')
      alert(errorMessage)
    } finally {
      setCreatingTrip(false)
    }
  }

  // Undo a booking marked paid that Naboopay never received money for
  const handleMarkUnpaid = async (bookingId: string) => {
    if (!confirm('Cancel this booking as NOT paid? Naboopay is checked first; a real payment must be refunded instead.')) return
    try {
      setConfirmingId(bookingId)
      const response = await api.post<{ success: boolean }>(`/admin/bookings/${bookingId}/unpaid`)
      if (response.data.success) {
        fetchDashboardData()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to cancel booking'
      alert(errorMessage)
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

  const updateTrip = async (tripId: string, body: Partial<Trip>, question: string) => {
    if (!confirm(question)) return
    try {
      setUpdatingTripId(tripId)
      const response = await api.put<{ success: boolean }>(`/trips/${tripId}`, body)
      if (response.data.success) {
        fetchDashboardData()
      }
    } catch (err) {
      alert(apiError(err, 'Failed to update trip'))
    } finally {
      setUpdatingTripId(null)
    }
  }
  const setTripStatus = (tripId: string, status: 'archived' | 'cancelled', question: string) =>
    updateTrip(tripId, { status }, question)

  const handleArchiveTrip = (tripId: string) =>
    setTripStatus(tripId, 'archived', 'Archive this trip? It will be hidden from users.')

  // Cancelling doesn't refund anyone; paid bookings are refunded one by one from the Bookings tab
  const handleCancelTrip = (trip: Trip) => {
    const paid = allBookings.filter(
      (b) => b.trip_id === trip.id && b.payment_status === 'paid' && b.status !== 'cancelled',
    ).length
    const refundNote = paid
      ? `\n\n${paid} paid booking${paid === 1 ? ' is' : 's are'} NOT refunded automatically. Refund them from the Bookings tab.`
      : ''
    return setTripStatus(trip.id, 'cancelled', `Cancel ${trip.origin} → ${trip.destination}? Students can no longer book it.${refundNote}`)
  }

  const viewTripBookings = (tripId: string) => {
    setBookingsTripId(tripId)
    setTab('bookings')
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

  const loadBookingRules = async () => {
    try {
      const response = await api.get<{ success: boolean; data: BookingRules }>('/admin/settings')
      if (response.data.success) setBookingRules(response.data.data)
    } catch {
      // Only used for the "Default: N" hint in the trip form
    }
  }


  // The Updates tab, optionally with a trip preselected
  const openUpdates = (tripId = '') => {
    setUpdatesTripId(tripId)
    setTab('updates')
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

  const departureKey = (trip: Trip) => `${trip.departure_date}T${trip.departure_time}`

  const today = new Date().toISOString().slice(0, 10)
  const upcomingTrips = allTrips
    .filter((trip) => trip.departure_date >= today && (trip.status === 'scheduled' || trip.status === 'full'))
    .sort((a, b) => departureKey(a).localeCompare(departureKey(b)))
  const tripsNewestFirst = allTrips
    .filter((trip) => showArchived || trip.status !== 'archived')
    .sort((a, b) => departureKey(b).localeCompare(departureKey(a)))

  // Revenue = trip price × paid bookings, grouped by the trip's departure month
  const paidSeatsByTrip = allBookings.reduce<Record<string, number>>((acc, booking) => {
    if (booking.payment_status === 'paid') acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1
    return acc
  }, {})
  const boardedByTrip = allBookings.reduce<Record<string, number>>((acc, booking) => {
    if (booking.boarded_at) acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1
    return acc
  }, {})
  const renderBookingStatus = (booking: Booking) => (
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
          booking.payment_status === 'refunded' ? 'bg-[rgb(var(--warning))]' : 'bg-[rgba(var(--overlay),0.2)]'
        }`} />
        {booking.payment_status}
      </span>
    </div>
  )

  const renderBookingActions = (booking: Booking) => (
    <>
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
          onClick={() => handleRefundBooking(booking.id)}
          title="Refund through Naboopay and cancel this booking"
        >
          Refund
        </Button>
      )}
      {booking.payment_status === 'paid' && booking.status !== 'cancelled' && (
        <Button
          variant="ghost"
          size="sm"
          loading={confirmingId === booking.id}
          onClick={() => handleMarkUnpaid(booking.id)}
          title="Confirmed by mistake? Cancel it as not paid (Naboopay is checked first)"
        >
          Not paid
        </Button>
      )}
    </>
  )

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
        <div className="flex justify-between items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-txt-primary">Dashboard</h1>
          <Button size="sm" onClick={openCreateTrip}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Trip
          </Button>
        </div>

        {/* Tabs scroll sideways on narrow screens instead of wrapping */}
        <div className="flex gap-1 overflow-x-auto border-b border-subtle -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                if (t.id === 'updates') return openUpdates()
                setTab(t.id)
              }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-accent text-txt-primary'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <>
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
                    <p className="font-display text-xl sm:text-2xl font-bold text-txt-primary">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Upcoming Trips */}
              <div className="glass rounded-2xl p-4 sm:p-6">
                <h2 className="font-display font-bold text-txt-primary mb-4">Upcoming Trips</h2>
                {upcomingTrips.length === 0 ? (
                  <p className="text-txt-muted text-sm">No upcoming trips</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingTrips.slice(0, 5).map((trip) => (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => viewTripBookings(trip.id)}
                        className="w-full flex justify-between items-center gap-3 p-3 rounded-xl text-left bg-[rgba(var(--overlay),0.02)] hover:bg-[rgba(var(--overlay),0.04)] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-txt-primary truncate">
                            {trip.origin} <span className="text-accent mx-1">&rarr;</span> {trip.destination}
                          </p>
                          <p className="text-xs text-txt-muted">{formatDeparture(trip)}</p>
                        </div>
                        <span className="text-sm font-semibold text-txt-primary whitespace-nowrap">
                          {trip.capacity - trip.available_seats}/{trip.capacity}
                          <span className="text-xs font-normal text-txt-muted ml-1">seats</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Bookings */}
              <div className="glass rounded-2xl p-4 sm:p-6">
                <h2 className="font-display font-bold text-txt-primary mb-4">Recent Bookings</h2>
                {recentBookings.length === 0 ? (
                  <p className="text-txt-muted text-sm">No bookings yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentBookings.map((booking) => (
                      <div key={booking.id} className="flex flex-wrap justify-between items-center gap-2 p-3 rounded-xl bg-[rgba(var(--overlay),0.02)] hover:bg-[rgba(var(--overlay),0.04)] transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-txt-primary">{booking.full_name || 'Unknown'}</p>
                          <p className="text-xs text-txt-muted">{booking.phone || 'No phone'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' :
                              booking.status === 'pending' ? 'badge-warning' : 'badge-neutral'
                            }`}>
                            {booking.status}
                          </span>
                          {renderBookingActions(booking)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'trips' && (
          <div className="glass rounded-2xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-bold text-txt-primary">All Trips</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-txt-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived
                </label>
                <Button variant="ghost" size="sm" onClick={() => handleExport('trips')}>
                  Export CSV
                </Button>
              </div>
            </div>
            {tripsNewestFirst.length === 0 ? (
              <p className="text-txt-muted text-sm py-6 text-center">No trips</p>
            ) : (
              <div className="space-y-2">
                {tripsNewestFirst.map((trip) => {
                  const editable = trip.status === 'scheduled' || trip.status === 'full'
                  return (
                    <div key={trip.id} className="p-4 rounded-xl border border-subtle space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-txt-primary">
                            {trip.origin} <span className="text-accent mx-1">&rarr;</span> {trip.destination}
                          </p>
                          <span className={`badge ${tripBadge(trip.status)}`}>{trip.status}</span>
                          {editable && (
                            bookingsOpen(trip) ? (
                              <span className="text-xs text-txt-muted">
                                Bookings open until {formatDakarTime(trip.bookings_close_at!)}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">
                                Bookings closed{trip.bookings_closed ? '' : ' (deadline passed)'}
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-xs text-txt-muted mt-1">
                          {formatDeparture(trip)} · {formatCfa(trip.price)} per seat
                          {trip.min_seats && trip.cutoff_hours && (
                            <> · min {trip.min_seats} paid, checked {trip.cutoff_hours}h before</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-6 text-sm shrink-0">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-txt-muted">Seats</p>
                          <p className="font-semibold text-txt-primary">{trip.capacity - trip.available_seats}/{trip.capacity}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-txt-muted">Revenue</p>
                          <p className="font-semibold text-[rgb(var(--warning))]">{formatCfa(revenueByTrip[trip.id] || 0)}</p>
                        </div>
                        {boardedByTrip[trip.id] > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-txt-muted">Boarded</p>
                            <p className="font-semibold text-[rgb(var(--success))]">{boardedByTrip[trip.id]}/{paidSeatsByTrip[trip.id] || 0}</p>
                          </div>
                        )}
                      </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-subtle">
                        <Button variant="outline" size="sm" onClick={() => viewTripBookings(trip.id)}>
                          Bookings
                        </Button>
                        {editable && (
                          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/scan?trip=${trip.id}`)}>
                            Scan tickets
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openUpdates(trip.id)}>
                          Post update
                        </Button>
                        {editable && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEditTrip(trip)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={updatingTripId === trip.id}
                              onClick={() =>
                                trip.bookings_closed
                                  ? updateTrip(trip.id, { bookings_closed: false }, 'Reopen bookings? Students can book again until the deadline.')
                                  : updateTrip(trip.id, { bookings_closed: true }, 'Close bookings now? It stays closed until you reopen it, even if the departure time changes.')
                              }
                            >
                              {trip.bookings_closed ? 'Reopen bookings' : 'Close bookings'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={updatingTripId === trip.id}
                              onClick={() => updateTrip(trip.id, { status: 'completed' }, 'Mark this trip as completed? It leaves the students\' list and stops taking bookings.')}
                            >
                              Mark completed
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={updatingTripId === trip.id}
                              onClick={() => handleCancelTrip(trip)}
                            >
                              Cancel trip
                            </Button>
                          </>
                        )}
                        {trip.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={updatingTripId === trip.id}
                            onClick={() =>
                              updateTrip(
                                trip.id,
                                { status: 'scheduled' },
                                'Reopen this trip? It goes back to students\' list. If its departure was long ago, edit the departure time too, or it will be completed again automatically.',
                              )
                            }
                          >
                            Reopen trip
                          </Button>
                        )}
                        {trip.status !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={updatingTripId === trip.id}
                            onClick={() => handleArchiveTrip(trip.id)}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <BookingsTab
            key={bookingsTripId}
            tripId={bookingsTripId}
            bookings={allBookings}
            trips={allTrips}
            renderBookingStatus={renderBookingStatus}
            renderBookingActions={renderBookingActions}
            syncMessage={syncMessage}
            setSyncMessage={setSyncMessage}
            onChanged={fetchDashboardData}
          />
        )}

        {tab === 'revenue' && (
          <RevenueTab
            bookings={allBookings}
            trips={allTrips}
            totalRevenue={stats?.totalRevenue || 0}
            revenueByTrip={revenueByTrip}
            paidSeatsByTrip={paidSeatsByTrip}
          />
        )}

        {tab === 'updates' && (
          <UpdatesTab
            key={updatesTripId}
            tripId={updatesTripId}
            trips={[...upcomingTrips, ...tripsNewestFirst.filter((t) => !upcomingTrips.includes(t))]}
          />
        )}

        {tab === 'settings' && <SettingsTab />}

        {/* Create Trip Modal */}
        {showCreateTrip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateTrip(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">{editingTripId ? 'Edit Trip' : 'Create Trip'}</h2>
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
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">
                    Bookings close (minutes before departure)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    className="input-dark"
                    placeholder={`Default: ${bookingRules?.default_booking_close_minutes ?? 30} (Settings)`}
                    value={newTrip.booking_close_minutes ?? ''}
                    onChange={(e) => setNewTrip({ ...newTrip, booking_close_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <p className="mt-1 text-xs text-txt-muted">
                    Follows the departure time: if the bus is late and you move the departure, the deadline moves too.
                  </p>
                </div>
                <div className="rounded-xl border border-subtle p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-txt-primary">Minimum seats (optional)</p>
                      <p className="text-xs text-txt-muted">
                        If fewer seats are paid by the deadline, the trip is cancelled, paid students are refunded and admins get an email.
                        Leave empty for no minimum.
                      </p>
                    </div>
                    {(newTrip.min_seats !== null || newTrip.cutoff_hours !== null) && (
                      <button
                        type="button"
                        onClick={() => setNewTrip({ ...newTrip, min_seats: null, cutoff_hours: null })}
                        className="text-xs font-medium text-[rgb(var(--danger))] whitespace-nowrap hover:underline"
                      >
                        Remove minimum
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-txt-secondary mb-1.5">Minimum paid seats</label>
                      <input
                        type="number"
                        min="0"
                        max={newTrip.capacity || undefined}
                        className="input-dark"
                        placeholder="No minimum"
                        value={newTrip.min_seats ?? ''}
                        onChange={(e) => setNewTrip({ ...newTrip, min_seats: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-txt-secondary mb-1.5">Hours before departure</label>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        className="input-dark"
                        placeholder="e.g. 4"
                        value={newTrip.cutoff_hours ?? ''}
                        required={!!newTrip.min_seats}
                        onChange={(e) => setNewTrip({ ...newTrip, cutoff_hours: e.target.value ? parseFloat(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCreateTrip(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={creatingTrip} className="flex-1">
                    {editingTripId ? 'Save Changes' : 'Create Trip'}
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

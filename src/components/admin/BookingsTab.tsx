import { ReactNode, useState } from 'react'
import api from '@/lib/api'
import Button from '@/components/Button'
import { Booking, Trip } from '@/types'
import { formatDeparture } from './shared'

// One choice of which bookings to show (stops are filtered by clicking them in the stop summary)
const BOOKING_VIEWS = {
  all: { label: 'All', match: (_: Booking) => true },
  paid: { label: 'Paid', match: (b: Booking) => b.payment_status === 'paid' && b.status !== 'cancelled' },
  unpaid: { label: 'Not paid', match: (b: Booking) => b.payment_status === 'pending' && b.status !== 'cancelled' },
  cancelled: { label: 'Cancelled', match: (b: Booking) => b.status === 'cancelled' },
  refunded: { label: 'Refunded', match: (b: Booking) => b.payment_status === 'refunded' },
  boarded: { label: 'Boarded', match: (b: Booking) => !!b.boarded_at },
  no_show: { label: 'Not boarded', match: (b: Booking) => b.payment_status === 'paid' && b.status !== 'cancelled' && !b.boarded_at },
}
type BookingView = keyof typeof BOOKING_VIEWS

// Sorting by clicking a column header; empty values (and erased names) always go last
const SORT_VALUES = {
  trip: (b: Booking) => b.trip ? `${b.trip.departure_date}T${b.trip.departure_time}` : '',
  name: (b: Booking) => b.full_name?.startsWith('(') ? '' : b.full_name || '',
  pickup: (b: Booking) => b.pickup_location || '',
  dropoff: (b: Booking) => b.dropoff_location || '',
  booked: (b: Booking) => String(b.created_at),
  status: (b: Booking) => b.payment_status,
}
type SortKey = keyof typeof SORT_VALUES
const compareBy = ({ key, desc }: { key: SortKey; desc: boolean }) => (a: Booking, b: Booking) => {
  const x = SORT_VALUES[key](a)
  const y = SORT_VALUES[key](b)
  if (!x || !y) return x ? -1 : y ? 1 : 0
  return (desc ? -1 : 1) * x.localeCompare(y)
}

// Admin → Bookings: who booked what, with filters, sorting, per-stop counts and CSV export.
// Row buttons (refund, not paid, sync) come from the page, which also uses them on Overview.
export default function BookingsTab({
  bookings, trips, tripId = 'all', renderBookingStatus, renderBookingActions, syncMessage, setSyncMessage, onChanged,
}: {
  bookings: Booking[]
  trips: Trip[]
  // Preselected trip (the "Bookings" button on a trip)
  tripId?: string
  renderBookingStatus: (booking: Booking) => ReactNode
  renderBookingActions: (booking: Booking) => ReactNode
  syncMessage: string | null
  setSyncMessage: (message: string | null) => void
  // Reload the dashboard after a sync changed bookings
  onChanged: () => void
}) {
  const [selectedTripId, setSelectedTripId] = useState(tripId)
  const [registrationQuery, setRegistrationQuery] = useState('')
  const [bookingView, setBookingView] = useState<BookingView>('all')
  const [bookingSort, setBookingSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'booked', desc: true })
  const [syncingAll, setSyncingAll] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportTripId, setExportTripId] = useState('all')
  const [exportingBookings, setExportingBookings] = useState(false)

  const handleExportBookings = async () => {
    setExportingBookings(true)
    try {
      const params = new URLSearchParams({ paid_only: 'true' })
      if (exportTripId !== 'all') params.set('trip_id', exportTripId)
      const response = await api.get<Blob>(`/admin/export/bookings?${params.toString()}`, { responseType: 'blob' })
      const tripLabel = exportTripId !== 'all'
        ? trips.find((t) => t.id === exportTripId)?.departure_date || exportTripId
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

  const handleSyncAll = async () => {
    if (!confirm('Sync all eligible bookings with Naboopay? This may take a moment.')) return
    try {
      setSyncMessage(null)
      setSyncingAll(true)
      const response = await api.post<{ success: boolean; data: { total: number; updated: number; unchanged: number; errors: number } }>(`/admin/bookings/sync-all`)
      if (response.data.success) {
        const { total, updated, unchanged, errors } = response.data.data
        setSyncMessage(`Synced ${total} bookings — ${updated} updated, ${unchanged} unchanged, ${errors} errors`)
        onChanged()
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to sync bookings'
      setSyncMessage(`Sync failed: ${errorMessage}`)
    } finally {
      setSyncingAll(false)
    }
  }

  const normalizedQuery = registrationQuery.trim().toLowerCase()
  const tripBookings = bookings.filter((b) => selectedTripId === 'all' || b.trip_id === selectedTripId)
  const filteredBookings = tripBookings.filter((booking) => {
    if (!BOOKING_VIEWS[bookingView].match(booking)) return false

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
  }).sort(compareBy(bookingSort))
  const filtersActive = bookingView !== 'all' || !!normalizedQuery
  // Clicking the sorted column again flips the direction
  const sortHeader = (key: SortKey, label: string, className = 'px-4') => (
    <th className={`${className} py-3 text-left`}>
      <button
        type="button"
        onClick={() => setBookingSort({ key, desc: bookingSort.key === key ? !bookingSort.desc : key === 'booked' })}
        className={`text-[10px] font-semibold uppercase tracking-widest hover:text-txt-primary ${bookingSort.key === key ? 'text-accent' : 'text-txt-muted'}`}
      >
        {label}{bookingSort.key === key ? (bookingSort.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )

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

  return (
    <>
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-txt-primary">Trip Registrations</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setExportTripId(selectedTripId); setShowExport(true) }}>
                Export CSV
              </Button>
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
              onChange={(e) => { setSelectedTripId(e.target.value); setBookingView('all') }}
            >
              <option value="all">All trips</option>
              {trips.map((trip) => (
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
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.entries(BOOKING_VIEWS) as [BookingView, (typeof BOOKING_VIEWS)[BookingView]][]).map(([view, { label, match }]) => (
              <button
                key={view}
                type="button"
                onClick={() => setBookingView(view)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  bookingView === view
                    ? 'bg-accent text-surface-primary border-accent'
                    : 'border-subtle text-txt-secondary hover:text-txt-primary'
                }`}
              >
                {label} <span className="opacity-70">{tripBookings.filter(match).length}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 mb-4 text-xs text-txt-muted">
            <span>{filteredBookings.length} of {tripBookings.length} booking{tripBookings.length === 1 ? '' : 's'}</span>
            {filtersActive && (
              <button type="button" className="text-accent hover:underline" onClick={() => { setBookingView('all'); setRegistrationQuery('') }}>
                Clear filters
              </button>
            )}
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
            <>
            {/* Phones: one card per booking */}
            <div className="md:hidden space-y-3">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-subtle p-4 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-txt-primary">{booking.full_name || 'Unknown'}</p>
                      {booking.phone ? (
                        <a href={`tel:${booking.phone}`} className="text-sm text-accent font-mono">{booking.phone}</a>
                      ) : (
                        <p className="text-sm text-txt-muted">No phone</p>
                      )}
                    </div>
                    {renderBookingStatus(booking)}
                  </div>
                  {booking.trip && (
                    <p className="text-xs text-txt-muted">
                      {booking.trip.origin} &rarr; {booking.trip.destination} · {formatDeparture(booking.trip)}
                    </p>
                  )}
                  {(booking.pickup_location || booking.dropoff_location) && (
                    <p className="text-xs text-txt-secondary">
                      {booking.pickup_location || '—'} <span className="text-accent">&rarr;</span> {booking.dropoff_location || '—'}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">{renderBookingActions(booking)}</div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto -mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-subtle">
                    {sortHeader('trip', 'Trip', 'px-6')}
                    {sortHeader('name', 'Passenger')}
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Phone</th>
                    {sortHeader('pickup', 'Pickup')}
                    {sortHeader('dropoff', 'Drop-off')}
                    {sortHeader('booked', 'Booked')}
                    {sortHeader('status', 'Status')}
                    <th className="px-6 py-3 text-right text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-[rgba(var(--overlay),0.02)] transition-colors">
                      <td className="px-6 py-3.5">
                        {booking.trip ? (
                          <div>
                            <p className="text-sm font-medium text-txt-primary">
                              {booking.trip.origin} <span className="text-accent">&rarr;</span> {booking.trip.destination}
                            </p>
                            <p className="text-xs text-txt-muted">{formatDeparture(booking.trip)}</p>
                          </div>
                        ) : (
                          <span className="text-txt-muted text-sm">Unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-primary">{booking.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3.5 text-sm text-txt-secondary font-mono">{booking.phone || '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-txt-secondary">
                        {booking.pickup_location || <span className="text-txt-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-secondary">
                        {booking.dropoff_location || <span className="text-txt-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-txt-muted">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">{renderBookingStatus(booking)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">{renderBookingActions(booking)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
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
                    {trips.filter((t) => t.status !== 'archived').map((trip) => (
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
    </>
  )
}

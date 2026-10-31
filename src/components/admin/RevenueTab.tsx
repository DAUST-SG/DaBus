import { Booking, Trip } from '@/types'
import { formatCfa, formatDeparture } from './shared'

const departureKey = (trip: Trip) => `${trip.departure_date}T${trip.departure_time}`

// Admin → Revenue: paid revenue and seats by month and by trip
export default function RevenueTab({ bookings, trips, totalRevenue, revenueByTrip, paidSeatsByTrip }: {
  bookings: Booking[]
  trips: Trip[]
  totalRevenue: number
  revenueByTrip: Record<string, number>
  paidSeatsByTrip: Record<string, number>
}) {
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
  const paymentCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.payment_status] = (acc[booking.payment_status] || 0) + 1
    return acc
  }, {})
  const revenueByMonth = Object.entries(
    bookings.reduce<Record<string, { seats: number; amount: number }>>((acc, booking) => {
      const trip = tripsById.get(booking.trip_id)
      if (booking.payment_status !== 'paid' || !trip) return acc
      const month = trip.departure_date.slice(0, 7)
      acc[month] = acc[month] || { seats: 0, amount: 0 }
      acc[month].seats += 1
      acc[month].amount += trip.price
      return acc
    }, {}),
  ).sort((a, b) => b[0].localeCompare(a[0]))
  const revenueTrips = trips
    .filter((trip) => paidSeatsByTrip[trip.id])
    .sort((a, b) => departureKey(b).localeCompare(departureKey(a)))
  const monthLabel = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Paid revenue', value: formatCfa(totalRevenue) },
                { label: 'Paid bookings', value: paymentCounts.paid || 0 },
                { label: 'Pending payment', value: paymentCounts.pending || 0 },
                { label: 'Refunded', value: paymentCounts.refunded || 0 },
              ].map((item) => (
                <div key={item.label} className="glass rounded-2xl p-4">
                  <p className="text-xs text-txt-muted uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="font-display text-xl font-bold text-txt-primary">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-4 sm:p-6">
                <h2 className="font-display font-bold text-txt-primary mb-4">By month</h2>
                {revenueByMonth.length === 0 ? (
                  <p className="text-txt-muted text-sm">No paid bookings yet</p>
                ) : (
                  <ul className="divide-y divide-subtle">
                    {revenueByMonth.map(([month, { seats, amount }]) => (
                      <li key={month} className="flex justify-between items-center py-2.5 text-sm">
                        <span className="text-txt-secondary">{monthLabel(month)}</span>
                        <span className="text-right">
                          <span className="font-semibold text-txt-primary">{formatCfa(amount)}</span>
                          <span className="block text-xs text-txt-muted">{seats} seat{seats === 1 ? '' : 's'}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glass rounded-2xl p-4 sm:p-6">
                <h2 className="font-display font-bold text-txt-primary mb-4">By trip</h2>
                {revenueTrips.length === 0 ? (
                  <p className="text-txt-muted text-sm">No paid bookings yet</p>
                ) : (
                  <ul className="divide-y divide-subtle">
                    {revenueTrips.map((trip) => (
                      <li key={trip.id} className="flex justify-between items-center gap-3 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block text-txt-primary truncate">{trip.origin} &rarr; {trip.destination}</span>
                          <span className="block text-xs text-txt-muted">{formatDeparture(trip)}</span>
                        </span>
                        <span className="text-right whitespace-nowrap">
                          <span className="font-semibold text-txt-primary">{formatCfa(revenueByTrip[trip.id] || 0)}</span>
                          <span className="block text-xs text-txt-muted">{paidSeatsByTrip[trip.id]} paid</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="text-xs text-txt-muted">
              Revenue is each trip&apos;s current price × its paid bookings, grouped by departure month.
            </p>
          </div>
  )
}

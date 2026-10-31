import { Trip } from '@/types'

// Trip dates and times are Dakar time (UTC+0 all year). Formatting in that zone shows the same
// day and hour on any device, wherever its clock is set.
export const formatTripDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'Africa/Dakar' })

export const formatDakarTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })

// Price + Naboopay's fee: what the student actually pays
export const totalPrice = (trip: Trip) => trip.price + (trip.payment_fee || 0)

// The server rechecks on booking; this only decides what the page shows
export const bookingsOpen = (trip: Trip) =>
  (trip.status === 'scheduled' || trip.status === 'full') &&
  !trip.bookings_closed &&
  (!trip.bookings_close_at || Date.now() < Date.parse(trip.bookings_close_at))

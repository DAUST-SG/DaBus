import { Trip } from '@/types'
import { formatTripDate } from '@/lib/time'

// Helpers shared by the admin page and its tabs

export type BookingRules = {
  max_unpaid_per_phone: number
  max_bookings_per_window: number
  booking_window_minutes: number
  refund_cutoff_hours: number
  default_booking_close_minutes: number
  auto_complete_hours: number
  personal_data_months: number
  payment_fee_percent: number
}

export const apiError = (err: unknown, fallback: string) =>
  (typeof err === 'object' && err && 'response' in err &&
    (err as { response?: { data?: { error?: string } } }).response?.data?.error) || fallback

export const formatCfa = (amount: number) => `${amount.toLocaleString()} CFA`
export const formatDeparture = (trip: Trip) =>
  `${formatTripDate(trip.departure_date, { day: 'numeric', month: 'short', year: 'numeric' })} at ${trip.departure_time}`
export const tripBadge = (status: Trip['status']) =>
  status === 'scheduled' ? 'badge-success' : status === 'full' ? 'badge-warning' : 'badge-neutral'

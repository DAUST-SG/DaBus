// Frontend types matching backend

export interface User {
  id: string
  email: string
  full_name: string
  phone: string
  role: 'student' | 'admin'
  created_at: string
}

export interface Trip {
  id: string
  origin: string
  destination: string
  departure_date: string
  departure_time: string
  capacity: number
  available_seats: number
  price: number
  status: 'scheduled' | 'full' | 'completed' | 'cancelled' | 'archived'
  min_seats?: number
  cutoff_hours?: number
  booking_close_minutes?: number
  bookings_closed?: boolean
  // When bookings close (ISO); compare with the clock, the server rechecks on booking
  bookings_close_at?: string
  created_at: string
  // Only returned by GET /trips/:id
  pickup_checkpoints?: string[]
  dropoff_checkpoints?: string[]
  // When the bus passes each pickup stop that has a time set
  pickup_times?: { name: string; time: string }[]
  updates?: TripUpdate[]
}

// A notice from the DaBus team; trip_id null = for everyone
export interface TripUpdate {
  id: string
  trip_id: string | null
  message: string
  created_at: number
}

export interface Checkpoint {
  id: string
  name: string
  city: string
  active: boolean
  // Route order within the city; null = not ordered yet
  position: number | null
  // Pickup time = departure + this; null = no time shown
  minutes_after_departure: number | null
}

export interface Booking {
  id: string
  trip_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  payment_status: 'pending' | 'paid' | 'refunded'
  payment_id?: string
  payment_link?: string
  full_name?: string
  phone?: string
  pickup_location?: string
  dropoff_location?: string
  // Private link to the ticket page: /ticket/<ticket_token>
  ticket_token?: string
  // When the ticket was scanned at the bus door (ISO)
  boarded_at?: string
  created_at: string
  trip?: Trip
}

export interface PaymentInfo {
  id: string
  booking_id: string
  amount: number
  method: 'wave' | 'orange_money'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  checkout_url?: string
}

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  phone: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface DashboardStats {
  totalTrips: number
  totalBookings: number
  totalRevenue: number
  upcomingTrips: number
}

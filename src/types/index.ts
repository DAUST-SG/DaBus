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
  status: 'scheduled' | 'full' | 'completed' | 'cancelled'
  created_at: string
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

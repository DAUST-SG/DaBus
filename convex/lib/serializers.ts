import { toIso } from "./time";

export const toPublicUser = (user: any) => ({
  id: user._id,
  email: user.email,
  full_name: user.full_name,
  phone: user.phone,
  role: user.role,
  created_at: toIso(user.created_at),
});

export const toPublicTrip = (trip: any) => ({
  id: trip._id,
  origin: trip.origin,
  destination: trip.destination,
  departure_date: trip.departure_date,
  departure_time: trip.departure_time,
  capacity: trip.capacity,
  available_seats: trip.available_seats,
  price: trip.price,
  status: trip.status,
  created_at: toIso(trip.created_at),
});

export const toPublicBooking = (booking: any, trip?: any) => ({
  id: booking._id,
  trip_id: booking.trip_id,
  status: booking.status,
  payment_status: booking.payment_status,
  payment_id: booking.payment_id,
  payment_link: booking.payment_link,
  full_name: booking.full_name,
  phone: booking.phone,
  email: booking.email,
  created_at: toIso(booking.created_at),
  trip: trip ? toPublicTrip(trip) : undefined,
});

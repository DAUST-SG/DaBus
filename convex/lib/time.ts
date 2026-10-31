export const now = () => Date.now();

// Trips store date and time as Dakar local time, which is UTC+0 all year
export const departureMs = (trip: { departure_date: string; departure_time: string }) =>
  Date.parse(`${trip.departure_date}T${trip.departure_time}:00Z`);

// Bookings close a number of minutes before the departure time currently set, so moving a
// late bus's departure moves the deadline too
export const bookingsCloseAt = (
  trip: { departure_date: string; departure_time: string; booking_close_minutes?: number },
  defaultMinutes: number,
) => departureMs(trip) - (trip.booking_close_minutes ?? defaultMinutes) * 60_000;

export const toIso = (value: number) => new Date(value).toISOString();

export const sessionExpiryMs = () => now() + 1000 * 60 * 60 * 24 * 30;

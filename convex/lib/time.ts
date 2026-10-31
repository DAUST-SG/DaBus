export const now = () => Date.now();

// Trips store date and time as Dakar local time, which is UTC+0 all year
export const departureMs = (trip: { departure_date: string; departure_time: string }) =>
  Date.parse(`${trip.departure_date}T${trip.departure_time}:00Z`);

export const toIso = (value: number) => new Date(value).toISOString();

export const sessionExpiryMs = () => now() + 1000 * 60 * 60 * 24 * 30;

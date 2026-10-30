import { now } from "./time";

// A booking holds a seat until it's cancelled (expired, refunded or cancelled by someone)
const holdsSeat = (booking: any) =>
  booking.status === "pending" || booking.status === "confirmed" || booking.status === "completed";

export const seatsTaken = async (ctx: any, tripId: any): Promise<number> => {
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_trip_id", (q: any) => q.eq("trip_id", tripId))
    .collect();
  return bookings.filter(holdsSeat).length;
};

// Sets available_seats from the bookings themselves instead of +1/-1, so a missed or
// doubled adjustment can't leave the count wrong. Call it after any booking change.
export const syncSeats = async (ctx: any, tripId: any) => {
  const trip = await ctx.db.get(tripId);
  if (!trip) return;

  const available = Math.max(0, trip.capacity - (await seatsTaken(ctx, tripId)));
  // Only bookable trips flip between scheduled and full
  const status =
    trip.status === "scheduled" || trip.status === "full"
      ? available === 0
        ? "full"
        : "scheduled"
      : trip.status;

  if (available !== trip.available_seats || status !== trip.status) {
    await ctx.db.patch(tripId, { available_seats: available, status, updated_at: now() });
  }
};

import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { now } from "./lib/time";
import { ticketRef } from "./tickets";

// Seats that should board: paid and not cancelled
const expected = (b: Doc<"bookings">) => b.payment_status === "paid" && b.status !== "cancelled";

const passenger = (b: Doc<"bookings">) => ({
  booking_id: b._id,
  ref: ticketRef(b._id),
  full_name: b.personal_data_erased_at ? undefined : b.full_name,
  pickup_location: b.pickup_location,
  dropoff_location: b.dropoff_location,
  boarded_at: b.boarded_at ?? null,
});

// Scan page: who should board this trip and who already has
export const tripSummary = query({
  args: { sessionToken: v.optional(v.string()), tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const bookings = await ctx.db.query("bookings").withIndex("by_trip_id", (q) => q.eq("trip_id", args.tripId)).collect();
    const passengers = bookings.filter(expected).map(passenger);
    return { boarded: passengers.filter((p) => p.boarded_at).length, expected: passengers.length, passengers };
  },
});

// code = what the QR holds (the ticket URL), the bare ticket token, or the 8-character ref printed on the ticket
export const checkIn = mutation({
  args: { sessionToken: v.optional(v.string()), tripId: v.id("trips"), code: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);
    const code = args.code.trim();
    const token = code.match(/\/ticket\/([A-Za-z0-9]+)/)?.[1] ?? (code.length >= 32 ? code : null);

    let booking: Doc<"bookings"> | null | undefined;
    if (token) {
      booking = await ctx.db.query("bookings").withIndex("by_ticket_token", (q) => q.eq("ticket_token", token)).unique();
    } else {
      // A ref is only unique enough within one trip
      const ref = code.toUpperCase();
      const tripBookings = await ctx.db.query("bookings").withIndex("by_trip_id", (q) => q.eq("trip_id", args.tripId)).collect();
      booking = tripBookings.find((b) => ticketRef(b._id) === ref);
    }
    if (!booking) return { result: "not_found" as const };

    const info = passenger(booking);
    if (booking.trip_id !== args.tripId) {
      const trip = await ctx.db.get(booking.trip_id);
      return { result: "wrong_trip" as const, ...info, trip_label: trip ? `${trip.origin} → ${trip.destination}, ${trip.departure_date} ${trip.departure_time}` : null };
    }
    if (booking.status === "cancelled") return { result: "cancelled" as const, ...info };
    if (booking.payment_status !== "paid") return { result: "not_paid" as const, ...info };
    if (booking.boarded_at) return { result: "already" as const, ...info };

    const boardedAt = now();
    await ctx.db.patch(booking._id, { boarded_at: boardedAt, boarded_by: admin._id });
    return { result: "ok" as const, ...info, boarded_at: boardedAt };
  },
});

// For a scan made by mistake
export const undo = mutation({
  args: { sessionToken: v.optional(v.string()), bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.patch(args.bookingId, { boarded_at: undefined, boarded_by: undefined });
    return { undone: true };
  },
});

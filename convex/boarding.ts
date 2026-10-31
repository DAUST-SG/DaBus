import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { now } from "./lib/time";
import { generateSessionToken } from "./lib/validation";
import { ticketRef } from "./tickets";
import { routeOrder } from "./checkpoints";

// Seats that should board: paid and not cancelled
const expected = (b: Doc<"bookings">) => b.payment_status === "paid" && b.status !== "cancelled";

// A passenger scanner sees "Abdoulaye F.", admins the full name
const shortName = (name?: string) => {
  const [first, ...rest] = (name || "").trim().split(/\s+/);
  return first ? `${first}${rest.length ? ` ${rest[rest.length - 1][0]}.` : ""}` : undefined;
};

const passenger = (b: Doc<"bookings">, isAdmin: boolean) => {
  const name = b.personal_data_erased_at ? undefined : b.full_name;
  return {
    booking_id: b._id,
    ref: ticketRef(b._id),
    full_name: isAdmin ? name : shortName(name),
    pickup_location: b.pickup_location,
    dropoff_location: b.dropoff_location,
    boarded_at: b.boarded_at ?? null,
  };
};

const tripLabel = (trip: Doc<"trips">) => `${trip.origin} → ${trip.destination}, ${trip.departure_date} ${trip.departure_time}`;

const scanArgs = {
  sessionToken: v.optional(v.string()),
  scanToken: v.optional(v.string()),
  tripId: v.optional(v.id("trips")),
};

// Who may scan: an admin (any trip), or the passenger holding a trip's scan link
// (only that trip, and only while it is scheduled or full)
const authorize = async (ctx: any, args: { sessionToken?: string; scanToken?: string; tripId?: Id<"trips"> }) => {
  if (args.scanToken) {
    const trip: Doc<"trips"> | null =
      args.scanToken.length < 32
        ? null
        : await ctx.db.query("trips").withIndex("by_scanner_token", (q: any) => q.eq("scanner_token", args.scanToken)).unique();
    if (!trip || (trip.status !== "scheduled" && trip.status !== "full")) {
      throw new ConvexError({ status: 403, message: "This scan link is no longer valid" });
    }
    return { trip, adminId: undefined, isAdmin: false };
  }
  const admin = await requireAdmin(ctx, args.sessionToken);
  const trip: Doc<"trips"> | null = args.tripId ? await ctx.db.get(args.tripId) : null;
  if (!trip) throw new ConvexError({ status: 404, message: "Trip not found" });
  return { trip, adminId: admin._id as Id<"users">, isAdmin: true };
};

// Scan page: who should board this trip and who already has
export const tripSummary = query({
  args: scanArgs,
  handler: async (ctx, args) => {
    const { trip, isAdmin } = await authorize(ctx, args);
    const order = await routeOrder(ctx, trip.origin);
    const bookings = await ctx.db.query("bookings").withIndex("by_trip_id", (q) => q.eq("trip_id", trip._id)).collect();
    // In the order the bus reaches each pickup stop; no stop or an unknown one last
    const stopIndex = (b: Doc<"bookings">) => order[b.pickup_location ?? ""] ?? Infinity;
    const seated = bookings
      .filter(expected)
      .sort((a, b) => stopIndex(a) - stopIndex(b) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    const passengers = seated.map((b) => passenger(b, isAdmin));
    const scanner = trip.scanner_booking_id ? seated.find((b) => b._id === trip.scanner_booking_id) : undefined;
    return {
      trip: { id: trip._id, label: tripLabel(trip) },
      boarded: passengers.filter((p) => p.boarded_at).length,
      expected: passengers.length,
      passengers,
      // Admins only: who scans for this trip, and which passengers have an email to send the link to
      scanner: isAdmin && scanner ? { booking_id: scanner._id, full_name: scanner.full_name, token: trip.scanner_token } : null,
      with_email: isAdmin ? seated.filter((b) => b.email || b.user_id).map((b) => b._id) : [],
    };
  },
});

// code = what the QR holds (the ticket URL), the bare ticket token, or the 8-character ref printed on the ticket
export const checkIn = mutation({
  args: { ...scanArgs, code: v.string() },
  handler: async (ctx, args) => {
    const { trip, adminId, isAdmin } = await authorize(ctx, args);
    const code = args.code.trim();
    const token = code.match(/\/ticket\/([A-Za-z0-9]+)/)?.[1] ?? (code.length >= 32 ? code : null);

    let booking: Doc<"bookings"> | null | undefined;
    if (token) {
      booking = await ctx.db.query("bookings").withIndex("by_ticket_token", (q) => q.eq("ticket_token", token)).unique();
    } else {
      // A ref is only unique enough within one trip
      const ref = code.toUpperCase();
      const tripBookings = await ctx.db.query("bookings").withIndex("by_trip_id", (q) => q.eq("trip_id", trip._id)).collect();
      booking = tripBookings.find((b) => ticketRef(b._id) === ref);
    }
    if (!booking) return { result: "not_found" as const };

    const info = passenger(booking, isAdmin);
    if (booking.trip_id !== trip._id) {
      const other = await ctx.db.get(booking.trip_id);
      return { result: "wrong_trip" as const, ...info, trip_label: other ? tripLabel(other) : null };
    }
    if (booking.status === "cancelled") return { result: "cancelled" as const, ...info };
    if (booking.payment_status !== "paid") return { result: "not_paid" as const, ...info };
    if (booking.boarded_at) return { result: "already" as const, ...info };

    const boardedAt = now();
    // boarded_by stays empty when the trip's passenger scanner checked them in
    await ctx.db.patch(booking._id, { boarded_at: boardedAt, boarded_by: adminId });
    return { result: "ok" as const, ...info, boarded_at: boardedAt };
  },
});

// For a scan made by mistake
export const undo = mutation({
  args: { ...scanArgs, bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const { trip } = await authorize(ctx, args);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.trip_id !== trip._id) {
      throw new ConvexError({ status: 404, message: "Booking not found on this trip" });
    }
    await ctx.db.patch(booking._id, { boarded_at: undefined, boarded_by: undefined });
    return { undone: true };
  },
});

// Admin picks the passenger who scans this trip (null removes them). A new link is made each
// time, so the previous one stops working, and it is emailed when the passenger has an address.
export const setScanner = mutation({
  args: { sessionToken: v.optional(v.string()), tripId: v.id("trips"), bookingId: v.union(v.id("bookings"), v.null()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new ConvexError({ status: 404, message: "Trip not found" });
    if (!args.bookingId) {
      await ctx.db.patch(trip._id, { scanner_booking_id: undefined, scanner_token: undefined });
      return { token: null, emailed: false };
    }
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.trip_id !== trip._id || !expected(booking)) {
      throw new ConvexError({ status: 400, message: "Choose a paid passenger of this trip" });
    }
    const token = generateSessionToken() as string;
    await ctx.db.patch(trip._id, { scanner_booking_id: booking._id, scanner_token: token });
    const user = booking.user_id ? await ctx.db.get(booking.user_id) : null;
    const emailed = !!(booking.email || user?.email);
    if (emailed) await ctx.scheduler.runAfter(0, internal.scannerEmail.send, { tripId: trip._id, token });
    return { token, emailed };
  },
});

export const scannerEmailContext = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    const booking = trip?.scanner_booking_id ? await ctx.db.get(trip.scanner_booking_id) : null;
    if (!trip || !booking) return null;
    const user = booking.user_id ? await ctx.db.get(booking.user_id) : null;
    return {
      token: trip.scanner_token,
      email: booking.email || user?.email,
      first_name: (booking.full_name || "").trim().split(/\s+/)[0] || "",
      trip: { origin: trip.origin, destination: trip.destination, departure_date: trip.departure_date, departure_time: trip.departure_time },
    };
  },
});

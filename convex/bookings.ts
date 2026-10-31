import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { getCurrentUser, isServerCall, requireBookingOwnerOrAdmin, requireServer, requireUser } from "./lib/guards";
import { toPublicBooking } from "./lib/serializers";
import { bookingsCloseAt, departureMs, now } from "./lib/time";
import { activeCheckpointNames } from "./checkpoints";
import { flagRefund, flagSale } from "./ledger";
import { getSettings } from "./settings";
import { seatsTaken, syncSeats } from "./lib/seats";

// A stop is required only when the city has some; it must be one of them
const resolveCheckpoint = async (ctx: any, city: string, chosen: string | undefined, label: string) => {
  const names = await activeCheckpointNames(ctx, city);
  if (names.length === 0) return undefined;
  if (names.length === 1 && !chosen?.trim()) return names[0];
  const match = names.find((n) => n === chosen?.trim());
  if (!match) {
    throw new ConvexError({ status: 400, message: `Please choose a valid ${label} point` });
  }
  return match;
};

// Last 9 digits, so "+221 77 123 45 67" and "771234567" count as the same phone
const phoneKey = (phone: string) => {
  const digits = phone.replace(/\D/g, "").slice(-9);
  return digits.length >= 6 ? digits : phone.trim().toLowerCase();
};

// Called only by our booking API route, which passes the server secret and a hash of the caller's IP
export const create = mutation({
  args: {
    serverSecret: v.string(),
    clientKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    trip_id: v.id("trips"),
    full_name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    pickup_location: v.optional(v.string()),
    dropoff_location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServer(args.serverSecret);
    if (!args.full_name.trim() || !args.phone.trim()) {
      throw new ConvexError({ status: 400, message: "Full name and phone are required" });
    }

    // Auth is optional: logged-in users get user_id, guests proceed without
    const user = await getCurrentUser(ctx, args.sessionToken);

    const trip = await ctx.db.get(args.trip_id);
    if (!trip) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }

    if (trip.status !== "scheduled" && trip.status !== "full") {
      throw new ConvexError({ status: 400, message: "Trip is not bookable" });
    }

    if ((await seatsTaken(ctx, trip._id)) >= trip.capacity) {
      throw new ConvexError({ status: 400, message: "No seats available" });
    }

    // Limits stop scripts from holding seats with unpaid bookings; paid bookings are never limited
    const settings = await getSettings(ctx);
    // Admins can still add someone after the deadline or a manual close, e.g. a passenger by the road
    const isAdmin = user?.role === "admin";
    const closed = trip.bookings_closed || now() >= bookingsCloseAt(trip, settings.default_booking_close_minutes);
    if (closed && !isAdmin) {
      throw new ConvexError({ status: 400, message: "Bookings are closed for this trip" });
    }

    const phone_key = phoneKey(args.phone);
    const byPhone = await ctx.db
      .query("bookings")
      .withIndex("by_phone_key", (q) => q.eq("phone_key", phone_key))
      .collect();
    // Admins booking on someone's behalf are never limited
    const limited = !isAdmin;
    const unpaidHolds = byPhone.filter((b) => b.status === "pending" && b.payment_status === "pending").length;
    if (limited && unpaidHolds >= settings.max_unpaid_per_phone) {
      throw new ConvexError({
        status: 429,
        message: `You already have ${unpaidHolds} unpaid booking${unpaidHolds === 1 ? "" : "s"}. Pay or wait for one to expire (max 10 minutes), then try again.`,
      });
    }
    const windowStart = now() - settings.booking_window_minutes * 60_000;
    const byClient = args.clientKey
      ? await ctx.db
          .query("bookings")
          .withIndex("by_client_key", (q) => q.eq("client_key", args.clientKey))
          .collect()
      : [];
    const recent = new Set(
      [...byPhone, ...byClient].filter((b) => b.created_at >= windowStart).map((b) => b._id),
    ).size;
    if (limited && recent >= settings.max_bookings_per_window) {
      throw new ConvexError({
        status: 429,
        message: `Too many bookings in a short time. Please wait ${settings.booking_window_minutes} minutes and try again.`,
      });
    }

    const pickup_location = await resolveCheckpoint(ctx, trip.origin, args.pickup_location, "pickup");
    const dropoff_location = await resolveCheckpoint(ctx, trip.destination, args.dropoff_location, "drop-off");

    const timestamp = now();

    const bookingId = await ctx.db.insert("bookings", {
      trip_id: trip._id,
      user_id: user?._id,
      status: "pending",
      payment_status: "pending",
      full_name: args.full_name.trim(),
      phone: args.phone.trim(),
      email: args.email?.trim(),
      pickup_location,
      dropoff_location,
      amount: trip.price,
      phone_key,
      client_key: args.clientKey,
      created_at: timestamp,
      updated_at: timestamp,
    });

    await syncSeats(ctx, trip._id);

    // Schedule auto-expiry for unpaid bookings after 10 minutes
    await ctx.scheduler.runAfter(
      10 * 60 * 1000,
      internal.bookings.expireUnpaidBooking,
      { bookingId },
    );

    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found after creation" });
    }

    return {
      booking: toPublicBooking(booking),
    };
  },
});

// Called only by our booking API route right after Naboopay created the payment
export const attachPaymentTransaction = mutation({
  args: {
    serverSecret: v.string(),
    bookingId: v.id("bookings"),
    payment_id: v.string(),
    payment_link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServer(args.serverSecret);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    await ctx.db.patch(booking._id, {
      payment_id: args.payment_id,
      payment_link: args.payment_link,
      updated_at: now(),
    });

    const updated = await ctx.db.get(booking._id);
    if (!updated) {
      throw new ConvexError({ status: 404, message: "Booking not found after update" });
    }
    const trip = await ctx.db.get(updated.trip_id);
    return toPublicBooking(updated, trip);
  },
});

export const myBookings = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user_id", (q: any) => q.eq("user_id", user._id))
      .collect();

    bookings.sort((a: any, b: any) => b.created_at - a.created_at);

    const trips = await Promise.all(bookings.map((booking: any) => ctx.db.get(booking.trip_id)));

    return bookings.map((booking: any, index: number) => toPublicBooking(booking, trips[index]));
  },
});

export const getById = query({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    await requireBookingOwnerOrAdmin(ctx, booking, args.sessionToken);
    const trip = await ctx.db.get(booking.trip_id);

    return toPublicBooking(booking, trip);
  },
});

// What happens if this booking is cancelled now: used by the cancel route before refunding,
// and shown to the student. Only the owner or an admin may ask.
export const cancellationCheck = query({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }
    await requireBookingOwnerOrAdmin(ctx, booking, args.sessionToken);
    if (booking.status === "cancelled") {
      return { allowed: false, needsRefund: false, message: "This booking is already cancelled" };
    }
    if (booking.payment_status !== "paid") {
      return { allowed: true, needsRefund: false };
    }
    const trip = await ctx.db.get(booking.trip_id);
    const { refund_cutoff_hours } = await getSettings(ctx);
    if (!trip || !booking.payment_id || departureMs(trip) - now() < refund_cutoff_hours * 3_600_000) {
      return {
        allowed: false,
        needsRefund: true,
        message: `Paid bookings can be cancelled and refunded up to ${refund_cutoff_hours} hours before departure. Please contact the DaBus team.`,
      };
    }
    return { allowed: true, needsRefund: true, payment_id: booking.payment_id };
  },
});

// The owner or an admin can cancel an unpaid booking. A paid booking is cancelled only by our
// server, after Naboopay confirmed the refund (refundedViaNaboopay), so nobody is marked
// "refunded" without getting their money back.
export const cancel = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    bookingId: v.id("bookings"),
    refundedViaNaboopay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    const fromServer = isServerCall(args.serverSecret);
    if (!fromServer) {
      await requireBookingOwnerOrAdmin(ctx, booking, args.sessionToken);
    }

    if (booking.status === "cancelled") {
      const trip = await ctx.db.get(booking.trip_id);
      return toPublicBooking(booking, trip);
    }

    const paid = booking.payment_status === "paid";
    if (paid && !(fromServer && args.refundedViaNaboopay)) {
      throw new ConvexError({
        status: 400,
        message: "Paid bookings are cancelled through a refund. Use Cancel in My Bookings, or Refund in the admin page.",
      });
    }

    const previousStatus = booking.status;
    await ctx.db.patch(booking._id, {
      status: "cancelled",
      payment_status: paid ? "refunded" : booking.payment_status,
      updated_at: now(),
    });

    if (paid) {
      await flagRefund(ctx, (await ctx.db.get(booking._id))!, "Cancelled by the student");
    }

    if (previousStatus === "pending" || previousStatus === "confirmed") {
      await syncSeats(ctx, booking.trip_id);
    }

    const updated = await ctx.db.get(booking._id);
    if (!updated) {
      throw new ConvexError({ status: 404, message: "Booking not found after cancellation" });
    }
    const trip = await ctx.db.get(updated.trip_id);
    return toPublicBooking(updated, trip);
  },
});

export const expireUnpaidBooking = internalMutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return;

    // Only expire if still pending and unpaid
    if (booking.status !== "pending" || booking.payment_status !== "pending") {
      return;
    }

    await ctx.db.patch(booking._id, {
      status: "cancelled",
      updated_at: now(),
    });

    await syncSeats(ctx, booking.trip_id);
  },
});

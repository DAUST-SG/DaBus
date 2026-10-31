import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { isFailed, isPaid } from "./lib/paymentStatus";
import { toPublicBooking, toPublicTrip, toPublicUser } from "./lib/serializers";
import { now } from "./lib/time";
import { flagRefund, flagSale } from "./ledger";
import { syncSeats } from "./lib/seats";
import {
  assertRequiredText,
  assertStrongPassword,
  assertValidEmail,
  createPasswordHash,
  normalizeEmail,
  normalizePhone,
  verifyPassword,
} from "./lib/validation";

export const stats = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const [trips, bookings] = await Promise.all([
      ctx.db.query("trips").collect(),
      ctx.db.query("bookings").collect(),
    ]);

    const tripsById = new Map(trips.map((trip: any) => [String(trip._id), trip]));
    const totalRevenue = bookings.reduce((sum: number, booking: any) => {
      if (booking.payment_status !== "paid") {
        return sum;
      }
      const trip = tripsById.get(String(booking.trip_id)) as any;
      return sum + (trip?.price ?? 0);
    }, 0);

    const today = new Date().toISOString().slice(0, 10);
    const upcomingTrips = trips.filter(
      (trip: any) =>
        trip.departure_date >= today &&
        trip.status !== "archived" &&
        (trip.status === "scheduled" || trip.status === "full"),
    ).length;

    return {
      totalTrips: trips.length,
      totalBookings: bookings.length,
      totalRevenue,
      upcomingTrips,
    };
  },
});

export const listTrips = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const trips = await ctx.db.query("trips").collect();
    trips.sort((a: any, b: any) => b.created_at - a.created_at);
    return trips.map(toPublicTrip);
  },
});

export const listBookings = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const bookings = await ctx.db.query("bookings").collect();
    bookings.sort((a: any, b: any) => b.created_at - a.created_at);

    const bounded = bookings.slice(0, args.limit ?? 100);
    const trips = await Promise.all(bounded.map((booking: any) => ctx.db.get(booking.trip_id)));

    return bounded.map((booking: any, index: number) => toPublicBooking(booking, trips[index]));
  },
});

export const updateBookingStatus = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    // Set only by the refund route, after Naboopay confirmed the refund
    refundedViaNaboopay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    if (booking.status === args.status) {
      const trip = await ctx.db.get(booking.trip_id);
      return toPublicBooking(booking, trip);
    }

    if (args.status === "cancelled" && booking.payment_status === "paid" && !args.refundedViaNaboopay) {
      throw new ConvexError({
        status: 400,
        message: "This booking is paid: use Refund so the money goes back, or Not paid if it was never paid.",
      });
    }

    let paymentStatus = booking.payment_status;
    if (args.status === "confirmed") {
      paymentStatus = "paid";
    } else if (args.status === "cancelled" && paymentStatus === "paid") {
      paymentStatus = "refunded";
    }

    await ctx.db.patch(booking._id, {
      status: args.status,
      payment_status: paymentStatus,
      updated_at: now(),
    });
    await syncSeats(ctx, booking.trip_id);

    if (args.refundedViaNaboopay && paymentStatus === "refunded") {
      await flagRefund(ctx, (await ctx.db.get(booking._id))!, "Refunded by admin");
    }

    const updated = await ctx.db.get(booking._id);
    if (!updated) {
      throw new ConvexError({ status: 404, message: "Booking not found after update" });
    }
    const trip = await ctx.db.get(updated.trip_id);
    return toPublicBooking(updated, trip);
  },
});

export const promoteUser = mutation({
  args: {
    email: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_PROMOTION_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new ConvexError({ status: 403, message: "Invalid promotion secret" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", normalizeEmail(args.email)))
      .unique();

    if (!user) {
      throw new ConvexError({ status: 404, message: "User not found" });
    }

    await ctx.db.patch(user._id, {
      role: "admin",
      updated_at: now(),
    });

    const promoted = await ctx.db.get(user._id);
    if (!promoted) {
      throw new ConvexError({ status: 404, message: "User not found after promotion" });
    }
    return {
      id: promoted._id,
      email: promoted.email,
      role: promoted.role,
    };
  },
});

// Shared by the admin "Sync" button and the scheduled minimum-seats check
const applyNaboopayStatus = async (
  ctx: any,
  args: { bookingId: Id<"bookings">; transaction_status: string },
) => {
  const booking = await ctx.db.get(args.bookingId);
  if (!booking) {
    throw new ConvexError({ status: 404, message: "Booking not found" });
  }

  const status = args.transaction_status.toLowerCase();
  const paid = isPaid(status);
  const failed = isFailed(status);

  if (!paid && !failed) {
    const trip = await ctx.db.get(booking.trip_id);
    return {
      booking: toPublicBooking(booking, trip),
      changed: false,
      reason: "status_not_actionable",
      remoteStatus: status,
    };
  }

  const previousStatus = booking.status;
  const previousPaymentStatus = booking.payment_status;
  const nextStatus = paid ? "confirmed" : "cancelled";
  const nextPaymentStatus = paid
    ? "paid"
    : previousPaymentStatus === "paid"
      ? "refunded"
      : previousPaymentStatus;

  if (nextStatus === previousStatus && nextPaymentStatus === previousPaymentStatus) {
    const trip = await ctx.db.get(booking.trip_id);
    return {
      booking: toPublicBooking(booking, trip),
      changed: false,
      reason: "already_in_sync",
      remoteStatus: status,
    };
  }

  await ctx.db.patch(booking._id, {
    status: nextStatus,
    payment_status: nextPaymentStatus,
    updated_at: now(),
  });

  const reported = await ctx.db.get(booking._id);
  if (paid && previousPaymentStatus !== "paid") {
    await flagSale(ctx, reported);
  }
  if (nextPaymentStatus === "refunded" && previousPaymentStatus === "paid") {
    await flagRefund(ctx, reported, "Payment reversed by Naboopay");
  }

  await syncSeats(ctx, booking.trip_id);

  const updated = await ctx.db.get(booking._id);
  if (!updated) {
    throw new ConvexError({ status: 404, message: "Booking not found after sync" });
  }
  const trip = await ctx.db.get(updated.trip_id);
  return {
    booking: toPublicBooking(updated, trip),
    changed: true,
    reason: "updated",
    remoteStatus: status,
    previousStatus,
    previousPaymentStatus,
  };
};

export const syncBookingFromNaboopay = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
    transaction_status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    return applyNaboopayStatus(ctx, args);
  },
});

export const syncBookingFromNaboopayInternal = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    transaction_status: v.string(),
  },
  handler: (ctx, args) => applyNaboopayStatus(ctx, args),
});

export const listBookingsForSync = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const bookings = await ctx.db.query("bookings").collect();
    return bookings
      .filter((b: any) => b.payment_id && b.status !== "completed")
      .map((b: any) => ({
        id: b._id,
        payment_id: b.payment_id,
        status: b.status,
        payment_status: b.payment_status,
      }));
  },
});

// Undoes a manual "Confirm" on a booking that was never paid. The route passes Naboopay's
// current status; a booking Naboopay shows as paid must be refunded instead.
export const markUnpaid = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
    transaction_status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }
    if (args.transaction_status && isPaid(args.transaction_status)) {
      throw new ConvexError({
        status: 409,
        message: "Naboopay shows this booking as paid. Use Refund instead.",
      });
    }
    if (booking.ledger_sale) {
      throw new ConvexError({
        status: 409,
        message: "This payment was already reported to DaLedger as received. Use Refund instead.",
      });
    }

    await ctx.db.patch(booking._id, {
      status: "cancelled",
      payment_status: "pending",
      updated_at: now(),
    });
    await syncSeats(ctx, booking.trip_id);

    const updated = await ctx.db.get(booking._id);
    const trip = await ctx.db.get(booking.trip_id);
    return toPublicBooking(updated, trip);
  },
});

export const getBookingById = query({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    const trip = await ctx.db.get(booking.trip_id);
    return { booking, trip };
  },
});

export const addAdmin = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    email: v.string(),
    password: v.string(),
    full_name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const email = normalizeEmail(args.email);
    assertValidEmail(email);
    assertStrongPassword(args.password);
    assertRequiredText(args.full_name, "Full name");
    assertRequiredText(args.phone, "Phone");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();

    if (existing) {
      throw new ConvexError({ status: 400, message: "An account with this email already exists" });
    }

    const passwordHash = await createPasswordHash(args.password);
    const timestamp = now();

    const userId = await ctx.db.insert("users", {
      email,
      full_name: args.full_name.trim(),
      phone: normalizePhone(args.phone),
      role: "admin",
      password_hash: passwordHash,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ status: 500, message: "Failed to create admin user" });
    }
    return toPublicUser(user);
  },
});

export const changePassword = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    current_password: v.string(),
    new_password: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);

    if (!admin.password_hash) {
      throw new ConvexError({ status: 400, message: "No password set on this account" });
    }

    const valid = await verifyPassword(args.current_password, admin.password_hash);
    if (!valid) {
      throw new ConvexError({ status: 401, message: "Current password is incorrect" });
    }

    assertStrongPassword(args.new_password);

    const newHash = await createPasswordHash(args.new_password);
    await ctx.db.patch(admin._id, {
      password_hash: newHash,
      updated_at: now(),
    });

    return { success: true };
  },
});


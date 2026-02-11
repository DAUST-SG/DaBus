import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireBookingOwnerOrAdmin, requireUser } from "./lib/guards";
import { toPublicBooking } from "./lib/serializers";
import { now } from "./lib/time";

const restoreSeatIfNeeded = async (ctx: any, booking: any) => {
  const trip = await ctx.db.get(booking.trip_id);
  if (!trip) {
    return;
  }

  if (trip.available_seats >= trip.capacity) {
    return;
  }

  const updatedSeats = trip.available_seats + 1;
  await ctx.db.patch(trip._id, {
    available_seats: updatedSeats,
    status: trip.status === "cancelled" || trip.status === "completed"
      ? trip.status
      : updatedSeats >= trip.capacity
        ? "scheduled"
        : trip.status,
    updated_at: now(),
  });
};

export const create = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    trip_id: v.id("trips"),
    full_name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.full_name.trim() || !args.phone.trim()) {
      throw new ConvexError({ status: 400, message: "Full name and phone are required" });
    }

    const user = await requireUser(ctx, args.sessionToken);

    const trip = await ctx.db.get(args.trip_id);
    if (!trip) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }

    if (trip.status !== "scheduled" && trip.status !== "full") {
      throw new ConvexError({ status: 400, message: "Trip is not bookable" });
    }

    if (trip.available_seats <= 0) {
      throw new ConvexError({ status: 400, message: "No seats available" });
    }

    const timestamp = now();

    const bookingId = await ctx.db.insert("bookings", {
      trip_id: trip._id,
      user_id: user._id,
      status: "pending",
      payment_status: "pending",
      full_name: args.full_name.trim(),
      phone: args.phone.trim(),
      created_at: timestamp,
      updated_at: timestamp,
    });

    const updatedSeats = trip.available_seats - 1;
    await ctx.db.patch(trip._id, {
      available_seats: updatedSeats,
      status: updatedSeats === 0 ? "full" : "scheduled",
      updated_at: timestamp,
    });

    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found after creation" });
    }

    return {
      booking: toPublicBooking(booking),
    };
  },
});

export const attachPaymentTransaction = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    bookingId: v.id("bookings"),
    payment_id: v.string(),
    payment_link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found" });
    }

    await requireBookingOwnerOrAdmin(ctx, booking, args.sessionToken);

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

export const cancel = mutation({
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
      const trip = await ctx.db.get(booking.trip_id);
      return toPublicBooking(booking, trip);
    }

    const previousStatus = booking.status;
    await ctx.db.patch(booking._id, {
      status: "cancelled",
      payment_status: booking.payment_status === "paid" ? "refunded" : booking.payment_status,
      updated_at: now(),
    });

    if (previousStatus === "pending" || previousStatus === "confirmed") {
      await restoreSeatIfNeeded(ctx, booking);
    }

    const updated = await ctx.db.get(booking._id);
    if (!updated) {
      throw new ConvexError({ status: 404, message: "Booking not found after cancellation" });
    }
    const trip = await ctx.db.get(updated.trip_id);
    return toPublicBooking(updated, trip);
  },
});

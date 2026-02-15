import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { toPublicBooking, toPublicTrip } from "./lib/serializers";
import { now } from "./lib/time";
import { normalizeEmail } from "./lib/validation";

const restoreSeat = async (ctx: any, booking: any) => {
  const trip = await ctx.db.get(booking.trip_id);
  if (!trip || trip.available_seats >= trip.capacity) {
    return;
  }

  const available = trip.available_seats + 1;
  await ctx.db.patch(trip._id, {
    available_seats: available,
    status: trip.status === "completed" || trip.status === "cancelled" || trip.status === "archived"
      ? trip.status
      : available >= trip.capacity
        ? "scheduled"
        : trip.status,
    updated_at: now(),
  });
};

const consumeSeat = async (ctx: any, booking: any) => {
  const trip = await ctx.db.get(booking.trip_id);
  if (!trip) {
    throw new ConvexError({ status: 404, message: "Trip not found" });
  }

  if (trip.available_seats <= 0) {
    throw new ConvexError({ status: 400, message: "No seats available to reconfirm booking" });
  }

  const available = trip.available_seats - 1;
  await ctx.db.patch(trip._id, {
    available_seats: available,
    status: available === 0 ? "full" : "scheduled",
    updated_at: now(),
  });
};

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

    if (args.status === "cancelled" && (booking.status === "pending" || booking.status === "confirmed")) {
      await restoreSeat(ctx, booking);
    }

    if (booking.status === "cancelled" && (args.status === "pending" || args.status === "confirmed")) {
      await consumeSeat(ctx, booking);
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

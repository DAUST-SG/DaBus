import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { toPublicTrip } from "./lib/serializers";
import { activeCheckpointNames, pickupTimes } from "./checkpoints";
import { bookingsCloseAt, departureMs, now } from "./lib/time";
import { getSettings, paymentFee, type Settings } from "./settings";
import { seatsTaken, syncSeats } from "./lib/seats";
import { updatesFor } from "./updates";

// The exact closing time goes to the page, which compares it with the clock itself
// (a cached query result can't be trusted to know what time it is); bookings:create rechecks.
export const withBookingWindow = (trip: any, settings: Settings) => ({
  ...toPublicTrip(trip),
  bookings_close_at: new Date(bookingsCloseAt(trip, settings.default_booking_close_minutes)).toISOString(),
  // Shown with the price so students know the total before Naboopay's page
  payment_fee: paymentFee(trip.price, settings.payment_fee_percent),
  payment_fee_percent: settings.payment_fee_percent,
});

const sortTrips = (a: any, b: any) => {
  const aKey = `${a.departure_date}T${a.departure_time}`;
  const bKey = `${b.departure_date}T${b.departure_time}`;
  return aKey.localeCompare(bKey);
};


// Both are set together, or neither (no auto-cancel). null clears them on update.
const validateMinSeats = (minSeats: number | null | undefined, cutoffHours: number | null | undefined, capacity: number) => {
  const hasMin = minSeats !== undefined && minSeats !== null;
  const hasCutoff = cutoffHours !== undefined && cutoffHours !== null;
  if (hasMin !== hasCutoff) {
    throw new ConvexError({ status: 400, message: "Set both minimum seats and hours before departure, or neither" });
  }
  if (hasMin && (!Number.isInteger(minSeats) || minSeats! < 1 || minSeats! > capacity)) {
    throw new ConvexError({ status: 400, message: "Minimum seats must be between 1 and the trip capacity" });
  }
  if (hasCutoff && !(cutoffHours! > 0)) {
    throw new ConvexError({ status: 400, message: "Hours before departure must be greater than zero" });
  }
};

export const list = query({
  args: {
    origin: v.optional(v.string()),
    destination: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("full"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const origin = args.origin?.trim().toLowerCase();
    const destination = args.destination?.trim().toLowerCase();

    const rows = await ctx.db.query("trips").collect();
    const filtered = rows.filter((trip: any) => {
      // Students only see trips still to come; finished, cancelled and archived ones need an explicit status
      if (!args.status && trip.status !== "scheduled" && trip.status !== "full") return false;
      const matchesOrigin =
        !origin || trip.origin.toLowerCase().includes(origin);
      const matchesDestination =
        !destination || trip.destination.toLowerCase().includes(destination);
      const matchesStatus = !args.status || trip.status === args.status;
      return matchesOrigin && matchesDestination && matchesStatus;
    });

    filtered.sort(sortTrips);
    const settings = await getSettings(ctx);
    return filtered.map((trip) => withBookingWindow(trip, settings));
  },
});

export const getById = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }
    const settings = await getSettings(ctx);
    return {
      ...withBookingWindow(trip, settings),
      pickup_checkpoints: await activeCheckpointNames(ctx, trip.origin),
      dropoff_checkpoints: await activeCheckpointNames(ctx, trip.destination),
      // A list, not an object: Convex field names can't contain accents ("Liberté 6")
      pickup_times: Object.entries(await pickupTimes(ctx, trip)).map(([name, time]) => ({ name, time })),
      updates: await updatesFor(ctx, trip._id),
    };
  },
});

export const create = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    origin: v.string(),
    destination: v.string(),
    departure_date: v.string(),
    departure_time: v.string(),
    capacity: v.number(),
    price: v.number(),
    min_seats: v.optional(v.number()),
    cutoff_hours: v.optional(v.number()),
    booking_close_minutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);
    if (args.booking_close_minutes !== undefined && !(args.booking_close_minutes >= 0)) {
      throw new ConvexError({ status: 400, message: "Bookings close time must be 0 or more minutes" });
    }
    validateMinSeats(args.min_seats, args.cutoff_hours, args.capacity);

    if (args.capacity <= 0) {
      throw new ConvexError({ status: 400, message: "Capacity must be greater than zero" });
    }
    if (args.price <= 0) {
      throw new ConvexError({ status: 400, message: "Price must be greater than zero" });
    }

    const timestamp = now();
    const tripId = await ctx.db.insert("trips", {
      origin: args.origin.trim(),
      destination: args.destination.trim(),
      departure_date: args.departure_date,
      departure_time: args.departure_time,
      capacity: args.capacity,
      available_seats: args.capacity,
      price: args.price,
      min_seats: args.min_seats,
      cutoff_hours: args.cutoff_hours,
      booking_close_minutes: args.booking_close_minutes,
      status: "scheduled",
      created_by: admin._id,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const trip = await ctx.db.get(tripId);
    return toPublicTrip(trip);
  },
});

export const update = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    tripId: v.id("trips"),
    origin: v.optional(v.string()),
    destination: v.optional(v.string()),
    departure_date: v.optional(v.string()),
    departure_time: v.optional(v.string()),
    capacity: v.optional(v.number()),
    price: v.optional(v.number()),
    min_seats: v.optional(v.union(v.number(), v.null())),
    cutoff_hours: v.optional(v.union(v.number(), v.null())),
    booking_close_minutes: v.optional(v.union(v.number(), v.null())),
    // Admin's manual close; stays closed even if the departure time moves later
    bookings_closed: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("full"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }

    const patch: Record<string, unknown> = {
      updated_at: now(),
    };

    if (args.origin !== undefined) patch.origin = args.origin.trim();
    if (args.destination !== undefined) patch.destination = args.destination.trim();
    if (args.departure_date !== undefined) patch.departure_date = args.departure_date;
    if (args.departure_time !== undefined) patch.departure_time = args.departure_time;
    if (args.price !== undefined) patch.price = args.price;
    if (args.status !== undefined) patch.status = args.status;

    if (args.capacity !== undefined) {
      if (args.capacity < (await seatsTaken(ctx, trip._id))) {
        throw new ConvexError({
          status: 400,
          message: "Capacity cannot be lower than already-booked seats",
        });
      }
      patch.capacity = args.capacity;
    }

    if (args.min_seats !== undefined || args.cutoff_hours !== undefined) {
      const minSeats = args.min_seats !== undefined ? args.min_seats : trip.min_seats;
      const cutoffHours = args.cutoff_hours !== undefined ? args.cutoff_hours : trip.cutoff_hours;
      validateMinSeats(minSeats, cutoffHours, (patch.capacity as number | undefined) ?? trip.capacity);
      patch.min_seats = minSeats ?? undefined;
      patch.cutoff_hours = cutoffHours ?? undefined;
    }

    if (args.bookings_closed !== undefined) patch.bookings_closed = args.bookings_closed;

    if (args.booking_close_minutes !== undefined) {
      if (args.booking_close_minutes !== null && !(args.booking_close_minutes >= 0)) {
        throw new ConvexError({ status: 400, message: "Bookings close time must be 0 or more minutes" });
      }
      // null = use the default from Settings
      patch.booking_close_minutes = args.booking_close_minutes ?? undefined;
    }

    // Any change to the rule or the departure means the trip should be checked again
    if (
      args.min_seats !== undefined ||
      args.cutoff_hours !== undefined ||
      args.departure_date !== undefined ||
      args.departure_time !== undefined
    ) {
      patch.min_seats_checked_at = undefined;
    }

    await ctx.db.patch(args.tripId, patch);
    await syncSeats(ctx, args.tripId);
    const updated = await ctx.db.get(args.tripId);
    return toPublicTrip(updated);
  },
});

export const remove = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }

    const related = await ctx.db
      .query("bookings")
      .withIndex("by_trip_id", (q: any) => q.eq("trip_id", args.tripId))
      .collect();

    await Promise.all(related.map((booking: any) => ctx.db.delete(booking._id)));
    await ctx.db.delete(args.tripId);

    return { success: true };
  },
});

// One-off repair for counts that drifted before seats were derived from bookings.
// Run with `npx convex run trips:recountSeats` (add --prod for production).
export const recountSeats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const trips = await ctx.db.query("trips").collect();
    const changed: string[] = [];
    for (const trip of trips) {
      await syncSeats(ctx, trip._id);
      const after = await ctx.db.get(trip._id);
      if (after && after.available_seats !== trip.available_seats) {
        changed.push(`${trip.origin} → ${trip.destination} ${trip.departure_date}: ${trip.available_seats} → ${after.available_seats} available`);
      }
    }
    return changed;
  },
});

// Safety net for trips nobody marked completed: runs from crons.ts.
// Buses can be late, so this waits auto_complete_hours (Settings) after the departure time set.
export const autoComplete = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { auto_complete_hours } = await getSettings(ctx);
    const cutoff = now() - auto_complete_hours * 3_600_000;
    const trips = await ctx.db.query("trips").collect();
    let completed = 0;
    for (const trip of trips) {
      if ((trip.status === "scheduled" || trip.status === "full") && departureMs(trip) < cutoff) {
        await ctx.db.patch(trip._id, { status: "completed", updated_at: now() });
        completed++;
      }
    }
    return { completed };
  },
});

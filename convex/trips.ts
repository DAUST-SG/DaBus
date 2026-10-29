import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { toPublicTrip } from "./lib/serializers";
import { activeCheckpointNames } from "./checkpoints";
import { now } from "./lib/time";

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
      // Hide archived trips from user-facing list unless explicitly requested
      if (trip.status === "archived" && args.status !== "archived") return false;
      const matchesOrigin =
        !origin || trip.origin.toLowerCase().includes(origin);
      const matchesDestination =
        !destination || trip.destination.toLowerCase().includes(destination);
      const matchesStatus = !args.status || trip.status === args.status;
      return matchesOrigin && matchesDestination && matchesStatus;
    });

    filtered.sort(sortTrips);
    return filtered.map(toPublicTrip);
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
    return {
      ...toPublicTrip(trip),
      pickup_checkpoints: await activeCheckpointNames(ctx, trip.origin),
      dropoff_checkpoints: await activeCheckpointNames(ctx, trip.destination),
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
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);
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
      const bookedSeats = trip.capacity - trip.available_seats;
      if (args.capacity < bookedSeats) {
        throw new ConvexError({
          status: 400,
          message: "Capacity cannot be lower than already-booked seats",
        });
      }
      patch.capacity = args.capacity;
      patch.available_seats = args.capacity - bookedSeats;
    }

    if (args.min_seats !== undefined || args.cutoff_hours !== undefined) {
      const minSeats = args.min_seats !== undefined ? args.min_seats : trip.min_seats;
      const cutoffHours = args.cutoff_hours !== undefined ? args.cutoff_hours : trip.cutoff_hours;
      validateMinSeats(minSeats, cutoffHours, (patch.capacity as number | undefined) ?? trip.capacity);
      patch.min_seats = minSeats ?? undefined;
      patch.cutoff_hours = cutoffHours ?? undefined;
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

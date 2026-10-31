import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { now } from "./lib/time";

// Cities are stored lowercased so "Dakar" and "dakar " match the same stops
const normalizeCity = (city: string) => city.trim().toLowerCase();

export const toPublicCheckpoint = (checkpoint: any) => ({
  id: checkpoint._id,
  name: checkpoint.name,
  city: checkpoint.city,
  active: checkpoint.active,
  position: checkpoint.position ?? null,
  minutes_after_departure: checkpoint.minutes_after_departure ?? null,
});

// Route order: by position, stops without one last (alphabetically)
const byRoute = (a: any, b: any) =>
  (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name);

const cityStops = async (ctx: any, city: string) => {
  const rows = await ctx.db
    .query("checkpoints")
    .withIndex("by_city", (q: any) => q.eq("city", normalizeCity(city)))
    .collect();
  return rows.sort(byRoute);
};

export const activeCheckpointNames = async (ctx: any, city: string): Promise<string[]> =>
  (await cityStops(ctx, city)).filter((c: any) => c.active).map((c: any) => c.name);

// "07:30" + 25 → "07:55" (wraps past midnight)
export const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Stop name → pickup time for a trip's origin stops that have a time set
export const pickupTimes = async (ctx: any, trip: { origin: string; departure_time: string }) => {
  const times: Record<string, string> = {};
  for (const stop of await cityStops(ctx, trip.origin)) {
    if (stop.minutes_after_departure != null) times[stop.name] = addMinutes(trip.departure_time, stop.minutes_after_departure);
  }
  return times;
};

// Stop name → route position, to list passengers in the order the bus picks them up
export const routeOrder = async (ctx: any, city: string) =>
  Object.fromEntries((await cityStops(ctx, city)).map((stop: any, index: number) => [stop.name, index]));

export const listAll = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await ctx.db.query("checkpoints").collect();
    rows.sort((a, b) => a.city.localeCompare(b.city) || byRoute(a, b));
    return rows.map(toPublicCheckpoint);
  },
});

export const create = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    name: v.string(),
    city: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);

    const name = args.name.trim();
    const city = normalizeCity(args.city);
    if (!name || !city) {
      throw new ConvexError({ status: 400, message: "Name and city are required" });
    }

    const existing = await ctx.db
      .query("checkpoints")
      .withIndex("by_city", (q) => q.eq("city", city))
      .collect();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ status: 409, message: "This checkpoint already exists in that city" });
    }

    const timestamp = now();
    const id = await ctx.db.insert("checkpoints", {
      name,
      city,
      active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return toPublicCheckpoint(await ctx.db.get(id));
  },
});

// ponytail: no delete; switching a stop off keeps past bookings' names meaningful
export const setActive = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    checkpointId: v.id("checkpoints"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) {
      throw new ConvexError({ status: 404, message: "Checkpoint not found" });
    }
    await ctx.db.patch(checkpoint._id, { active: args.active, updated_at: now() });
    return toPublicCheckpoint(await ctx.db.get(checkpoint._id));
  },
});

// Swap a stop with its neighbour in its city's route order
export const move = mutation({
  args: { sessionToken: v.optional(v.string()), checkpointId: v.id("checkpoints"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) {
      throw new ConvexError({ status: 404, message: "Checkpoint not found" });
    }
    const stops = await cityStops(ctx, checkpoint.city);
    const from = stops.findIndex((s: any) => s._id === checkpoint._id);
    const to = args.direction === "up" ? from - 1 : from + 1;
    if (to >= 0 && to < stops.length) [stops[from], stops[to]] = [stops[to], stops[from]];
    // Renumber the whole city so positions stay 0, 1, 2...
    for (const [index, stop] of stops.entries()) {
      if (stop.position !== index) await ctx.db.patch(stop._id, { position: index, updated_at: now() });
    }
    return { moved: true };
  },
});

export const setMinutes = mutation({
  args: { sessionToken: v.optional(v.string()), checkpointId: v.id("checkpoints"), minutes: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    if (args.minutes !== null && !(Number.isInteger(args.minutes) && args.minutes >= 0 && args.minutes <= 24 * 60)) {
      throw new ConvexError({ status: 400, message: "Minutes after departure must be a whole number from 0 to 1440" });
    }
    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) {
      throw new ConvexError({ status: 404, message: "Checkpoint not found" });
    }
    await ctx.db.patch(checkpoint._id, { minutes_after_departure: args.minutes ?? undefined, updated_at: now() });
    return toPublicCheckpoint(await ctx.db.get(checkpoint._id));
  },
});

// One-time: copies the stops that used to be hardcoded on the trip page.
// Run with `npx convex run checkpoints:seed` (add --prod for production).
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("checkpoints").first()) {
      return { seeded: false };
    }
    const timestamp = now();
    const stops = [
      { name: "Liberté 6", active: true },
      { name: "Sedima", active: true },
      { name: "Camberène", active: false },
    ];
    for (const stop of stops) {
      await ctx.db.insert("checkpoints", {
        ...stop,
        city: "dakar",
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
    return { seeded: true };
  },
});

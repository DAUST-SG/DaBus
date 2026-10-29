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
});

export const activeCheckpointNames = async (ctx: any, city: string): Promise<string[]> => {
  const rows = await ctx.db
    .query("checkpoints")
    .withIndex("by_city", (q: any) => q.eq("city", normalizeCity(city)))
    .collect();
  return rows
    .filter((c: any) => c.active)
    .map((c: any) => c.name)
    .sort((a: string, b: string) => a.localeCompare(b));
};

export const listAll = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await ctx.db.query("checkpoints").collect();
    rows.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
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

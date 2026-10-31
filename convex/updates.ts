import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { now } from "./lib/time";

// ponytail: newest few general notices only; admins delete the ones that no longer apply
const GENERAL_SHOWN = 5;

const toPublicUpdate = (u: any) => ({ id: u._id, trip_id: u.trip_id ?? null, message: u.message, created_at: u.created_at });

// What passengers see: the trip's own updates plus the latest general ones, newest first
export const updatesFor = async (ctx: any, tripId?: Id<"trips">) => {
  const general = await ctx.db
    .query("updates")
    .withIndex("by_trip_id", (q: any) => q.eq("trip_id", undefined))
    .order("desc")
    .take(GENERAL_SHOWN);
  const forTrip = tripId
    ? await ctx.db.query("updates").withIndex("by_trip_id", (q: any) => q.eq("trip_id", tripId)).collect()
    : [];
  return [...forTrip, ...general].sort((a, b) => b.created_at - a.created_at).map(toPublicUpdate);
};

export const general = query({
  args: {},
  handler: async (ctx) => updatesFor(ctx),
});

export const listAll = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await ctx.db.query("updates").order("desc").collect();
    return Promise.all(
      rows.map(async (u) => {
        const trip = u.trip_id ? await ctx.db.get(u.trip_id) : null;
        const author = await ctx.db.get(u.posted_by);
        return {
          ...toPublicUpdate(u),
          trip_label: trip ? `${trip.origin} → ${trip.destination}, ${trip.departure_date} ${trip.departure_time}` : null,
          posted_by: author?.full_name || author?.email || "Admin",
        };
      }),
    );
  },
});

export const post = mutation({
  args: { sessionToken: v.optional(v.string()), tripId: v.optional(v.id("trips")), message: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);
    const message = args.message.trim();
    if (!message || message.length > 1000) {
      throw new ConvexError({ status: 400, message: "Write an update of up to 1000 characters" });
    }
    if (args.tripId && !(await ctx.db.get(args.tripId))) {
      throw new ConvexError({ status: 404, message: "Trip not found" });
    }
    const id = await ctx.db.insert("updates", { trip_id: args.tripId, message, posted_by: admin._id, created_at: now() });
    return toPublicUpdate(await ctx.db.get(id));
  },
});

export const remove = mutation({
  args: { sessionToken: v.optional(v.string()), updateId: v.id("updates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.updateId);
    return { deleted: true };
  },
});

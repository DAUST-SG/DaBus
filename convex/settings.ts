import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/guards";
import { now } from "./lib/time";

// Starting values until an admin changes them in Settings
const DEFAULTS = {
  max_unpaid_per_phone: 3,
  max_bookings_per_window: 10,
  booking_window_minutes: 10,
  refund_cutoff_hours: 3,
  default_booking_close_minutes: 30,
  auto_complete_hours: 12,
};

export type Settings = typeof DEFAULTS;

export const getSettings = async (ctx: any): Promise<Settings> => {
  const row = await ctx.db.query("settings").first();
  return { ...DEFAULTS, ...(row ?? {}) };
};

const pick = (s: any): Settings => ({
  max_unpaid_per_phone: s.max_unpaid_per_phone,
  max_bookings_per_window: s.max_bookings_per_window,
  booking_window_minutes: s.booking_window_minutes,
  refund_cutoff_hours: s.refund_cutoff_hours,
  default_booking_close_minutes: s.default_booking_close_minutes,
  auto_complete_hours: s.auto_complete_hours,
});

export const get = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    return pick(await getSettings(ctx));
  },
});

// Public: students see the cancellation rule before cancelling
export const refundCutoffHours = query({
  args: {},
  handler: async (ctx) => (await getSettings(ctx)).refund_cutoff_hours,
});

export const update = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    max_unpaid_per_phone: v.number(),
    max_bookings_per_window: v.number(),
    booking_window_minutes: v.number(),
    refund_cutoff_hours: v.number(),
    default_booking_close_minutes: v.number(),
    auto_complete_hours: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { sessionToken: _, ...values } = args;
    for (const [key, value] of Object.entries(values)) {
      // Hours and minutes may be 0 ("at departure"); counts must be at least 1
      const zeroOk = key === "refund_cutoff_hours" || key === "default_booking_close_minutes";
      const ok = zeroOk ? value >= 0 : Number.isInteger(value) && value >= 1;
      if (!ok) {
        throw new ConvexError({ status: 400, message: `Invalid value for ${key.replace(/_/g, " ")}` });
      }
    }
    const row = await ctx.db.query("settings").first();
    if (row) {
      await ctx.db.patch(row._id, { ...values, updated_at: now() });
    } else {
      await ctx.db.insert("settings", { ...values, updated_at: now() });
    }
    return pick({ ...DEFAULTS, ...values });
  },
});

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getSettings } from "./settings";
import { departureMs, now } from "./lib/time";
import { sha256 } from "./lib/validation";

// ponytail: batch per run so one mutation stays small; the daily cron catches up over days
const BATCH = 500;

// Retention rule: personal_data_months (Settings, default 6) after a trip's departure, erase each
// booking's name, phone, email, ticket link and limit keys. Trip, amount, dates, stops,
// statuses and an anonymous rider_key stay, so revenue, refunds, the ledger and ridership
// studies are unaffected. Not reversible.
export const eraseOld = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { personal_data_months } = await getSettings(ctx);
    const cutoff = now() - personal_data_months * 30.44 * 24 * 3_600_000;
    const trips = await ctx.db.query("trips").collect();
    const oldTrips = new Set(trips.filter((t) => departureMs(t) < cutoff).map((t) => t._id));

    const bookings = await ctx.db.query("bookings").collect();
    const due = bookings.filter((b) => oldTrips.has(b.trip_id) && !b.personal_data_erased_at);
    if (args.dryRun) {
      return { wouldErase: due.length, olderThanMonths: personal_data_months };
    }
    // Same phone → same rider_key, so repeat riders can still be counted without knowing who they are.
    // ponytail: without RIDER_KEY_SECRET the data is still erased, just without a rider_key
    const secret = process.env.RIDER_KEY_SECRET;
    for (const booking of due.slice(0, BATCH)) {
      await ctx.db.patch(booking._id, {
        rider_key: secret && booking.phone_key ? (await sha256(`${secret}:${booking.phone_key}`)).slice(0, 32) : undefined,
        full_name: undefined,
        phone: undefined,
        email: undefined,
        phone_key: undefined,
        client_key: undefined,
        ticket_token: undefined,
        personal_data_erased_at: now(),
      });
    }
    return { erased: Math.min(due.length, BATCH), remaining: Math.max(0, due.length - BATCH) };
  },
});

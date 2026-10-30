import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { now, toIso } from "./lib/time";

// Reports DaBus sales and refunds to DaLedger, per DaLedger/docs/INTEGRATION.md.
// Bookings are flagged "pending" where they become paid or really refunded;
// flush() sends them, and the cron in crons.ts retries whatever is still pending.
// Needs LEDGER_URL (the ledger's .convex.site base) and LEDGER_INTAKE_KEY in Convex env.

const SOURCE = "dabus";
const BATCH = 50; // the ledger allows ~60 requests a minute per site

// Call inside a mutation when a booking moves to paid. Only real Naboopay payments
// are reported: the admin "Confirm" button sets paid without one.
export const flagSale = async (ctx: any, booking: Doc<"bookings">) => {
  if (!booking.payment_id || booking.ledger_sale) return;
  await ctx.db.patch(booking._id, { ledger_sale: "pending", paid_at: now() });
  await ctx.scheduler.runAfter(0, internal.ledger.flush, {});
};

// Call inside a mutation only when Naboopay actually returned the money.
// A sale the ledger never got from us has nothing to reverse, so it's skipped.
export const flagRefund = async (ctx: any, booking: Doc<"bookings">, reason: string) => {
  if (!booking.ledger_sale || booking.ledger_refund) return;
  await ctx.db.patch(booking._id, { ledger_refund: "pending", ledger_refund_reason: reason });
  await ctx.scheduler.runAfter(0, internal.ledger.flush, {});
};

// ponytail: full scan of bookings; add an index on ledger_sale/ledger_refund if this table gets large
export const pending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const bookings = await ctx.db.query("bookings").collect();
    const due = bookings
      .filter((b) => b.ledger_sale === "pending" || (b.ledger_refund === "pending" && b.ledger_sale === "done"))
      .slice(0, BATCH);
    return Promise.all(due.map(async (booking) => ({ booking, trip: await ctx.db.get(booking.trip_id) })));
  },
});

export const record = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    kind: v.union(v.literal("sale"), v.literal("refund")),
    state: v.union(v.literal("done"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookingId, {
      [args.kind === "sale" ? "ledger_sale" : "ledger_refund"]: args.state,
      ledger_error: args.error,
    });
  },
});

type Outcome = "done" | "failed" | "retry" | "slow_down";

const post = async (path: string, body: Record<string, unknown>): Promise<{ outcome: Outcome; error?: string }> => {
  const base = process.env.LEDGER_URL;
  const key = process.env.LEDGER_INTAKE_KEY;
  if (!base || !key) return { outcome: "retry", error: "LEDGER_URL or LEDGER_INTAKE_KEY not set" };

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Intake-Key": key },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return { outcome: "retry", error: `network: ${error}` };
  }

  const text = await response.text();
  // 201 recorded, 200 duplicate: both mean the ledger has it
  if (response.status === 200 || response.status === 201) return { outcome: "done" };
  if (response.status === 429) return { outcome: "slow_down", error: text };
  // Bad key / bad data: retrying the same request can't succeed, an admin must fix it
  if (response.status === 401 || response.status === 422) return { outcome: "failed", error: `${response.status}: ${text}` };
  // 404 on a refund = sale not in the ledger yet; 5xx = temporary
  return { outcome: "retry", error: `${response.status}: ${text}` };
};

export const flush = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!process.env.LEDGER_URL || !process.env.LEDGER_INTAKE_KEY) {
      console.warn("Ledger reporting is off: set LEDGER_URL and LEDGER_INTAKE_KEY in Convex env");
      return;
    }
    const items: { booking: Doc<"bookings">; trip: Doc<"trips"> | null }[] = await ctx.runQuery(
      internal.ledger.pending,
      {},
    );

    for (const { booking, trip } of items) {
      const bookingId = booking._id as Id<"bookings">;
      const kind = booking.ledger_sale === "pending" ? "sale" : "refund";
      const result =
        kind === "sale"
          ? await post("/intake/income", {
              source: SOURCE,
              externalId: bookingId,
              amount: booking.amount ?? trip?.price,
              paidAt: toIso(booking.paid_at ?? booking.updated_at),
              description: trip
                ? `Bus ticket ${trip.origin} → ${trip.destination}, ${trip.departure_date} ${trip.departure_time}`
                : "Bus ticket",
              naboopayReference: booking.payment_id,
            })
          : await post("/intake/income/refund", {
              source: SOURCE,
              externalId: bookingId,
              reason: booking.ledger_refund_reason || "Refunded",
            });

      if (result.outcome === "done" || result.outcome === "failed") {
        await ctx.runMutation(internal.ledger.record, {
          bookingId,
          kind,
          state: result.outcome,
          error: result.error,
        });
      }
      if (result.error) console.warn(`Ledger ${kind} for booking ${bookingId}: ${result.error}`);
      // Over the rate limit: stop here, the cron picks up the rest
      if (result.outcome === "slow_down") break;
    }
  },
});

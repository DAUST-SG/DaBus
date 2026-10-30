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
    target: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookingId, {
      [args.kind === "sale" ? "ledger_sale" : "ledger_refund"]: args.state,
      ledger_error: args.error,
      ...(args.state === "done" ? { ledger_target: args.target } : {}),
    });
  },
});

// After pointing LEDGER_URL (and its key) at a different ledger, queues again every sale
// and refund that ledger hasn't received, keeping each one's original amount and paidAt.
// Reports from before ledger_target existed went to the dev ledger, so they're included.
// Run with `npx convex run --prod ledger:resendToCurrentLedger`.
export const resendToCurrentLedger = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = process.env.LEDGER_URL;
    if (!current) throw new Error("Set LEDGER_URL to the new ledger first");
    const bookings = await ctx.db.query("bookings").collect();
    let queued = 0;
    for (const b of bookings) {
      if (b.ledger_sale !== "done" || b.ledger_target === current) continue;
      await ctx.db.patch(b._id, {
        ledger_sale: "pending",
        ledger_refund: b.ledger_refund ? "pending" : undefined,
        ledger_target: undefined,
        ledger_error: undefined,
      });
      queued++;
    }
    if (queued) await ctx.scheduler.runAfter(0, internal.ledger.flush, {});
    return { queued, ledger: current };
  },
});

type Outcome = "done" | "failed" | "retry" | "slow_down";

const post = async (
  path: string,
  body: Record<string, unknown>,
): Promise<{ outcome: Outcome; status?: number; error?: string }> => {
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
  const status = response.status;
  if (status === 200 || status === 201) return { outcome: "done", status };
  if (status === 429) return { outcome: "slow_down", status, error: text };
  // Bad key / bad data: retrying the same request can't succeed, an admin must fix it
  if (status === 401 || status === 422) return { outcome: "failed", status, error: text };
  // 404 on a refund = sale not in the ledger yet; 5xx = temporary
  return { outcome: "retry", status, error: text };
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
          error: result.error ? `HTTP ${result.status}: ${result.error}` : undefined,
          target: process.env.LEDGER_URL!,
        });
      }
      // One line per report so the ledger's response is visible in the Convex logs
      const line = `Ledger ${kind} for booking ${bookingId}: ${result.status ? `HTTP ${result.status}` : "not sent"} → ${result.outcome}${result.error ? ` (${result.error.slice(0, 300)})` : ""}`;
      if (result.outcome === "done") console.log(line);
      else console.warn(line);
      // Over the rate limit: stop here, the cron picks up the rest
      if (result.outcome === "slow_down") break;
    }
  },
});

// One-off backfill: queues every Naboopay-paid booking (paid or refunded since) created after
// `since` (ms) for a sale report, taking the real paid time from Naboopay. Refund reports are only
// queued where DaBus recorded a real refund (ledger_refund already set); older "refunded" flags may
// come from cancellations that never returned money.
// Run with `npx convex run --prod ledger:backfillSince '{"since": <ms>}'`.
export const backfillCandidates = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const bookings = await ctx.db.query("bookings").collect();
    return bookings.filter(
      (b) =>
        b.payment_id &&
        (b.payment_status === "paid" || b.payment_status === "refunded") &&
        (b.paid_at ?? b.created_at) >= args.since,
    );
  },
});

export const queueBackfill = internalMutation({
  args: { bookingId: v.id("bookings"), paidAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return;
    await ctx.db.patch(args.bookingId, {
      ledger_sale: "pending",
      ledger_refund: booking.ledger_refund ? "pending" : undefined,
      ledger_error: undefined,
      ledger_target: undefined,
      paid_at: booking.paid_at ?? args.paidAt,
    });
  },
});

export const backfillSince = internalAction({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const candidates: Doc<"bookings">[] = await ctx.runQuery(internal.ledger.backfillCandidates, args);
    let missingPaidAt = 0;
    for (const booking of candidates) {
      let paidAt: number | undefined;
      if (!booking.paid_at) {
        try {
          const tx = await fetch(
            `https://api.naboopay.com/api/v2/transactions/${encodeURIComponent(booking.payment_id!)}`,
            { headers: { Authorization: `Bearer ${process.env.NABOOPAY_API_KEY}`, Accept: "application/json" } },
          ).then((r) => r.json());
          const parsed = Date.parse(tx?.paid_at);
          // Naboopay uses 0001-01-01 for "never paid"
          if (parsed > Date.parse("2000-01-01")) paidAt = parsed;
        } catch {
          // fall back to updated_at at send time
        }
        if (!paidAt) missingPaidAt++;
      }
      await ctx.runMutation(internal.ledger.queueBackfill, { bookingId: booking._id, paidAt });
    }
    await ctx.scheduler.runAfter(0, internal.ledger.flush, {});
    return { queued: candidates.length, missingPaidAt };
  },
});

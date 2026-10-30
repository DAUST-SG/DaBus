import { httpAction, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { flagRefund, flagSale } from "./ledger";
import { syncSeats } from "./lib/seats";
import { now } from "./lib/time";
import { isPaid, isFailed } from "./lib/paymentStatus";


export const processWaveWebhook = mutation({
  args: {
    event_id: v.string(),
    booking_id: v.optional(v.id("bookings")),
    payment_id: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("webhook_events")
      .withIndex("by_source_event", (q: any) => q.eq("source", "wave").eq("event_id", args.event_id))
      .unique();

    if (existingEvent) {
      return { success: true, duplicate: true };
    }

    let booking = null;

    if (args.booking_id) {
      booking = await ctx.db.get(args.booking_id);
    }

    if (!booking && args.payment_id) {
      booking = await ctx.db
        .query("bookings")
        .withIndex("by_payment_id", (q: any) => q.eq("payment_id", args.payment_id))
        .unique();
    }

    if (!booking) {
      throw new ConvexError({ status: 404, message: "Booking not found for webhook" });
    }

    const paid = isPaid(args.status);
    await ctx.db.patch(booking._id, {
      status: paid ? "confirmed" : booking.status,
      payment_status: paid ? "paid" : booking.payment_status,
      payment_id: args.payment_id ?? booking.payment_id,
      updated_at: now(),
    });
    await syncSeats(ctx, booking.trip_id);

    await ctx.db.insert("webhook_events", {
      source: "wave",
      event_id: args.event_id,
      processed_at: now(),
    });

    return { success: true };
  },
});

export const processNaboopayWebhook = mutation({
  args: {
    event_id: v.string(),
    order_id: v.optional(v.string()),
    booking_id: v.optional(v.id("bookings")),
    transaction_status: v.string(),
  },
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("webhook_events")
      .withIndex("by_source_event", (q: any) => q.eq("source", "naboopay").eq("event_id", args.event_id))
      .unique();

    if (existingEvent) {
      return { success: true, duplicate: true };
    }

    let booking = null;
    if (args.booking_id) {
      booking = await ctx.db.get(args.booking_id);
    }

    if (!booking && args.order_id) {
      booking = await ctx.db
        .query("bookings")
        .withIndex("by_payment_id", (q: any) => q.eq("payment_id", args.order_id))
        .unique();
    }

    if (!booking) {
      await ctx.db.insert("webhook_events", {
        source: "naboopay",
        event_id: args.event_id,
        processed_at: now(),
      });
      return { success: true, ignored: true, reason: "booking_not_found" };
    }

    const status = args.transaction_status.toLowerCase();
    const paid = isPaid(status);
    const failed = isFailed(status);

    const nextStatus = paid ? "confirmed" : failed ? "cancelled" : booking.status;
    const nextPaymentStatus = paid ? "paid" : failed ? "refunded" : booking.payment_status;

    await ctx.db.patch(booking._id, {
      status: nextStatus,
      payment_status: nextPaymentStatus,
      payment_id: args.order_id ?? booking.payment_id,
      updated_at: now(),
    });

    const reported = await ctx.db.get(booking._id);
    if (reported && paid && booking.payment_status !== "paid") {
      await flagSale(ctx, reported);
    }
    if (reported && failed && booking.payment_status === "paid") {
      await flagRefund(ctx, reported, "Payment reversed by Naboopay");
    }

    // Covers both a failed payment freeing a seat and a late payment on an expired booking
    await syncSeats(ctx, booking.trip_id);

    await ctx.db.insert("webhook_events", {
      source: "naboopay",
      event_id: args.event_id,
      processed_at: now(),
    });

    return { success: true };
  },
});

export const handleWaveWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get("x-wave-secret") || request.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized webhook" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const payload = (await request.json()) as Record<string, any>;
  const status = String(payload.status ?? payload.payment_status ?? "");
  const eventId = String(payload.id ?? payload.event_id ?? payload.reference ?? crypto.randomUUID());
  const bookingId = payload.booking_id ?? payload.metadata?.booking_id;
  const paymentId = payload.payment_id ?? payload.transaction_id;

  await ctx.runMutation("webhooks:processWaveWebhook" as any, {
    event_id: eventId,
    booking_id: bookingId,
    payment_id: paymentId,
    status,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

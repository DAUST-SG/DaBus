import { httpAction, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { now } from "./lib/time";

const isPaid = (status: string) => {
  const normalized = status.toLowerCase();
  return (
    normalized === "paid" ||
    normalized === "paid_and_blocked" ||
    normalized === "completed" ||
    normalized === "success"
  );
};

const isFailed = (status: string) => {
  const normalized = status.toLowerCase();
  return (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired" ||
    normalized === "error"
  );
};

const restoreSeatIfNeeded = async (ctx: any, booking: any) => {
  const trip = await ctx.db.get(booking.trip_id);
  if (!trip || trip.available_seats >= trip.capacity) {
    return;
  }

  const available = trip.available_seats + 1;
  await ctx.db.patch(trip._id, {
    available_seats: available,
    status: trip.status === "completed" || trip.status === "cancelled"
      ? trip.status
      : available >= trip.capacity
        ? "scheduled"
        : trip.status,
    updated_at: now(),
  });
};

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
      throw new ConvexError({ status: 404, message: "Booking not found for webhook" });
    }

    const status = args.transaction_status.toLowerCase();
    const paid = isPaid(status);
    const failed = isFailed(status);
    const wasCancelable = booking.status === "pending" || booking.status === "confirmed";

    const nextStatus = paid ? "confirmed" : failed ? "cancelled" : booking.status;
    const nextPaymentStatus = paid ? "paid" : failed ? "refunded" : booking.payment_status;

    await ctx.db.patch(booking._id, {
      status: nextStatus,
      payment_status: nextPaymentStatus,
      payment_id: args.order_id ?? booking.payment_id,
      updated_at: now(),
    });

    if (failed && wasCancelable) {
      await restoreSeatIfNeeded(ctx, booking);
    }

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

import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { flagRefund } from "./ledger";
import { onBookingPaid } from "./tickets";
import { syncSeats } from "./lib/seats";
import { requireServer } from "./lib/guards";
import { now } from "./lib/time";
import { isPaid, isFailed } from "./lib/paymentStatus";


// Called only by our Naboopay webhook route, after it verified Naboopay's signature
export const processNaboopayWebhook = mutation({
  args: {
    serverSecret: v.string(),
    event_id: v.string(),
    order_id: v.optional(v.string()),
    booking_id: v.optional(v.id("bookings")),
    transaction_status: v.string(),
  },
  handler: async (ctx, args) => {
    requireServer(args.serverSecret);
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
      await onBookingPaid(ctx, reported);
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

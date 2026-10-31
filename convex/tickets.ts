import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { flagSale } from "./ledger";
import { generateSessionToken } from "./lib/validation";
import { now } from "./lib/time";
import { requireServer } from "./lib/guards";

// Everything that should happen once when a booking becomes paid: report the sale to the
// ledger and email the ticket. Called from the Naboopay webhook and from payment syncs.
export const onBookingPaid = async (ctx: any, booking: Doc<"bookings">) => {
  await flagSale(ctx, booking);
  await ctx.scheduler.runAfter(0, internal.ticketEmail.sendTicketEmail, { bookingId: booking._id });
};

// Short reference shown on tickets and read out at boarding, e.g. "J57F3K2A"
export const ticketRef = (bookingId: string) => bookingId.slice(-8).toUpperCase();

const toTicket = (booking: Doc<"bookings">, trip: Doc<"trips"> | null) => ({
  booking_id: booking._id,
  ref: ticketRef(booking._id),
  token: booking.ticket_token,
  full_name: booking.full_name,
  status: booking.status,
  payment_status: booking.payment_status,
  has_payment: !!booking.payment_id,
  amount: booking.amount ?? trip?.price,
  pickup_location: booking.pickup_location,
  dropoff_location: booking.dropoff_location,
  trip: trip && {
    origin: trip.origin,
    destination: trip.destination,
    departure_date: trip.departure_date,
    departure_time: trip.departure_time,
    status: trip.status,
  },
});

export type Ticket = ReturnType<typeof toTicket>;

// Public on purpose: the token is the access. It returns only what the ticket shows
// (no phone or email).
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (args.token.length < 32) return null;
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_ticket_token", (q) => q.eq("ticket_token", args.token))
      .unique();
    if (!booking) return null;
    return toTicket(booking, await ctx.db.get(booking.trip_id));
  },
});

export const pendingPayment = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_ticket_token", (q) => q.eq("ticket_token", args.token))
      .unique();
    // Only while the booking still holds its seat; late payments on expired ones come via the webhook
    if (!booking || booking.status !== "pending" || booking.payment_status !== "pending" || !booking.payment_id) return null;
    return booking.payment_id;
  },
});

// The ticket page calls this (through our API, with the server secret) while a payment shows
// as pending, so a student back from Naboopay sees "confirmed" without waiting for the webhook.
export const checkPayment = action({
  args: { serverSecret: v.string(), token: v.string() },
  handler: async (ctx, args): Promise<{ checked: boolean; status?: string }> => {
    requireServer(args.serverSecret);
    const orderId: string | null = await ctx.runQuery(internal.tickets.pendingPayment, { token: args.token });
    const apiKey = process.env.NABOOPAY_API_KEY;
    if (!orderId || !apiKey) return { checked: false };
    const response: Response = await fetch(`https://api.naboopay.com/api/v2/transactions/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) return { checked: false };
    const status = String((await response.json())?.transaction_status || "").trim();
    if (status) {
      await ctx.runMutation(internal.admin.applyPaymentByTicket, { ticketToken: args.token, transaction_status: status });
    }
    return { checked: true, status };
  },
});

export const emailContext = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;
    const user = booking.user_id ? await ctx.db.get(booking.user_id) : null;
    return {
      ticket: toTicket(booking, await ctx.db.get(booking.trip_id)),
      email: booking.email || user?.email,
      alreadyEmailed: !!booking.ticket_emailed_at,
    };
  },
});

export const markEmailed = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookingId, { ticket_emailed_at: now() });
  },
});

// One-off: gives bookings made before tickets existed their ticket link.
// Run with `npx convex run tickets:backfillTokens` (add --prod for production).
export const backfillTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bookings = await ctx.db.query("bookings").collect();
    let added = 0;
    for (const booking of bookings) {
      if (!booking.ticket_token) {
        await ctx.db.patch(booking._id, { ticket_token: generateSessionToken() as string });
        added++;
      }
    }
    return { added };
  },
});

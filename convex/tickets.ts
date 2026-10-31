import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
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
  await ctx.scheduler.runAfter(0, internal.tickets.sendTicketEmail, { bookingId: booking._id });
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
    if (!booking || booking.payment_status !== "pending" || !booking.payment_id) return null;
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

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const sendTicketEmail = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.tickets.emailContext, args);
    if (!data || data.alreadyEmailed || !data.email || !data.ticket.token || !data.ticket.trip) return;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.DABUS_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
    const base = process.env.APP_BASE_URL;
    if (!apiKey || !from || !base) {
      console.warn("Ticket email not sent: set RESEND_API_KEY, DABUS_FROM_EMAIL and APP_BASE_URL in Convex env");
      return;
    }

    const { ticket } = data;
    const trip = ticket.trip!;
    const link = `${base.replace(/\/$/, "")}/ticket/${ticket.token}`;
    const first = (ticket.full_name || "").trim().split(/\s+/)[0] || "";
    const day = new Date(`${trip.departure_date}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar",
    });
    const stops = [
      ticket.pickup_location && `Pickup: <strong>${escapeHtml(ticket.pickup_location)}</strong>`,
      ticket.dropoff_location && `Drop-off: <strong>${escapeHtml(ticket.dropoff_location)}</strong>`,
    ].filter(Boolean);
    const html = `
      <p>Hi ${escapeHtml(first)},</p>
      <p>Your seat is confirmed. Here is your DaBus ticket:</p>
      <p style="font-size:16px">
        <strong>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</strong><br>
        ${escapeHtml(day)} at ${escapeHtml(trip.departure_time)} (Dakar time)<br>
        ${stops.join("<br>")}${stops.length ? "<br>" : ""}
        Ticket: <strong>${ticket.ref}</strong>
      </p>
      <p>👉 <a href="${link}"><strong>View or download your ticket</strong></a></p>
      <p>Show it to the driver when you board.</p>
      <p>See you on the bus!<br>The DaBus team — DAUST Student Government</p>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject: `Your DaBus ticket: ${trip.origin} → ${trip.destination}, ${day}`,
        html,
      }),
    });
    if (!response.ok) {
      // The ticket page still works; the failure is in the logs
      console.error(`Ticket email failed for booking ${args.bookingId}: ${await response.text()}`);
      return;
    }
    await ctx.runMutation(internal.tickets.markEmailed, args);
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

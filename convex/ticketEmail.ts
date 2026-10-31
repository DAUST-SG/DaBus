"use node";

// Node runtime: building the PDF (pdf-lib, qrcode) needs Node's Buffer
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { buildTicketPdf } from "./lib/ticketPdf";

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
      <p>Your seat is confirmed. Your ticket is attached as a PDF: it works without internet, so you can show it at the bus even with no connection.</p>
      <p style="font-size:16px">
        <strong>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</strong><br>
        ${escapeHtml(day)} at ${escapeHtml(trip.departure_time)} (Dakar time)<br>
        ${stops.join("<br>")}${stops.length ? "<br>" : ""}
        Ticket: <strong>${ticket.ref}</strong>
      </p>
      <p>You can also <a href="${link}"><strong>open your ticket online</strong></a>.</p>
      <p>Show it to the driver when you board.</p>
      <p>See you on the bus!<br>The DaBus team — DAUST Student Government</p>`;

    // Attach the same PDF as "Download ticket"; if it can't be built, still send the link
    let attachments: { filename: string; content: string }[] = [];
    try {
      const pdf = await buildTicketPdf(ticket, link);
      attachments = [{ filename: `DaBus-ticket-${ticket.ref}.pdf`, content: Buffer.from(pdf).toString("base64") }];
    } catch (error) {
      console.error(`Ticket PDF not attached for booking ${args.bookingId}: ${error}`);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject: `Your DaBus ticket: ${trip.origin} → ${trip.destination}, ${day}`,
        html,
        attachments,
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


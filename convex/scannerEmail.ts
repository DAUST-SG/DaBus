import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Sends the chosen passenger their private scan link for one trip (see boarding:setScanner)
export const send = internalAction({
  args: { tripId: v.id("trips"), token: v.string() },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.boarding.scannerEmailContext, { tripId: args.tripId });
    // Skip if the admin picked someone else before this ran
    if (!data || !data.email || data.token !== args.token) return;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.DABUS_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
    const base = process.env.APP_BASE_URL;
    if (!apiKey || !from || !base) {
      console.warn("Scan link email not sent: set RESEND_API_KEY, DABUS_FROM_EMAIL and APP_BASE_URL in Convex env");
      return;
    }

    const { trip } = data;
    const link = `${base.replace(/\/$/, "")}/scan/${args.token}`;
    const day = new Date(`${trip.departure_date}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar",
    });
    const html = `
      <p>Hi ${escapeHtml(data.first_name)},</p>
      <p>The DaBus team asked you to check tickets for your trip:</p>
      <p style="font-size:16px"><strong>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</strong><br>
        ${escapeHtml(day)} at ${escapeHtml(trip.departure_time)} (Dakar time)</p>
      <p>When passengers board, <a href="${link}"><strong>open the scanner</strong></a> on your phone and scan each ticket's QR code.
        It shows who is valid and who hasn't boarded yet.</p>
      <p>This link is only for you and only for this trip. It stops working when the trip ends.</p>
      <p>Thank you!<br>The DaBus team — DAUST Student Government</p>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject: `Check tickets for DaBus ${trip.origin} → ${trip.destination}, ${day}`,
        html,
      }),
    });
    if (!response.ok) {
      console.error(`Scan link email failed for trip ${args.tripId}: ${await response.text()}`);
    }
  },
});

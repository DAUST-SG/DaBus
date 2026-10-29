import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { now } from "./lib/time";

// Trips store date and time as Dakar local time, which is UTC+0 all year
const departureMs = (trip: Doc<"trips">) =>
  Date.parse(`${trip.departure_date}T${trip.departure_time}:00Z`);

const isPaidBooking = (b: Doc<"bookings">) => b.payment_status === "paid" && b.status !== "cancelled";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Trips to look at now:
// - inside their cutoff window and not checked yet, or
// - auto-cancelled by an earlier run that didn't finish (retry the refunds)
export const dueTrips = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const trips = await ctx.db.query("trips").collect();
    return trips.filter((trip) => {
      if (trip.min_seats_checked_at || !trip.min_seats || !trip.cutoff_hours) return false;
      if (trip.min_seats_cancelled_at) return true;
      if (trip.status !== "scheduled" && trip.status !== "full") return false;
      const departure = departureMs(trip);
      return departure > args.now && departure - trip.cutoff_hours * 3_600_000 <= args.now;
    });
  },
});

export const tripBookings = internalQuery({
  args: { tripId: v.id("trips") },
  handler: (ctx, args) =>
    ctx.db
      .query("bookings")
      .withIndex("by_trip_id", (q) => q.eq("trip_id", args.tripId))
      .collect(),
});

export const adminEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u.role === "admin").map((u) => u.email);
  },
});

export const markChecked = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tripId, { min_seats_checked_at: now() });
  },
});

// Stops new bookings first; refunds happen afterwards in the action
export const cancelTrip = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const timestamp = now();
    await ctx.db.patch(args.tripId, {
      status: "cancelled",
      min_seats_cancelled_at: timestamp,
      updated_at: timestamp,
    });
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_trip_id", (q) => q.eq("trip_id", args.tripId))
      .collect();
    const unpaid = bookings.filter((b) => b.status !== "cancelled" && b.payment_status !== "paid");
    for (const booking of unpaid) {
      await ctx.db.patch(booking._id, { status: "cancelled", updated_at: timestamp });
    }
    return unpaid.map((b) => b._id);
  },
});

export const markRefunded = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      payment_status: "refunded",
      updated_at: now(),
    });
  },
});

const naboopay = async (path: string) => {
  const apiKey = process.env.NABOOPAY_API_KEY;
  if (!apiKey) throw new Error("NABOOPAY_API_KEY is not set in Convex");
  const response = await fetch(`https://api.naboopay.com/api/v2/${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new Error(String(body?.message || body?.error || body?.detail || text || `HTTP ${response.status}`));
  }
  return body;
};

const sendReport = async (subject: string, html: string, to: string[]) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || to.length === 0) {
    console.warn(`Admin email not sent (Resend not configured or no admins): ${subject}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!response.ok) {
    console.error(`Admin email failed: ${await response.text()}`);
  }
};

type Row = { name: string; phone: string; note?: string };

const rowsHtml = (rows: Row[]) =>
  rows.length === 0
    ? "<p>None.</p>"
    : `<ul>${rows
        .map((r) => `<li>${escapeHtml(r.name)} — ${escapeHtml(r.phone)}${r.note ? ` (${escapeHtml(r.note)})` : ""}</li>`)
        .join("")}</ul>`;

const toRow = (b: Doc<"bookings">, note?: string): Row => ({
  name: b.full_name || "Unknown",
  phone: b.phone || "no phone",
  note,
});

const checkTrip = async (ctx: any, trip: Doc<"trips">) => {
  const tripId = trip._id as Id<"trips">;
  let cancelledUnpaidIds: Id<"bookings">[] = [];

  // A retry after a crash skips straight to the remaining refunds
  if (!trip.min_seats_cancelled_at) {
    // Pick up last-minute payments before counting
    const before: Doc<"bookings">[] = await ctx.runQuery(internal.minSeats.tripBookings, { tripId });
    for (const booking of before) {
      if (booking.status !== "pending" || !booking.payment_id) continue;
      try {
        const tx = await naboopay(`transactions/${encodeURIComponent(booking.payment_id)}`);
        const status = String(tx?.transaction_status || "").trim();
        if (status) {
          await ctx.runMutation(internal.admin.syncBookingFromNaboopayInternal, {
            bookingId: booking._id,
            transaction_status: status,
          });
        }
      } catch (error) {
        console.warn(`Could not sync booking ${booking._id} before min-seats check: ${error}`);
      }
    }

    const counted: Doc<"bookings">[] = await ctx.runQuery(internal.minSeats.tripBookings, { tripId });
    const paidCount = counted.filter(isPaidBooking).length;
    if (paidCount >= trip.min_seats!) {
      await ctx.runMutation(internal.minSeats.markChecked, { tripId });
      return;
    }
    cancelledUnpaidIds = await ctx.runMutation(internal.minSeats.cancelTrip, { tripId });
  }

  const bookings: Doc<"bookings">[] = await ctx.runQuery(internal.minSeats.tripBookings, { tripId });
  const refunded: Row[] = [];
  const failed: Row[] = [];
  for (const booking of bookings.filter(isPaidBooking)) {
    if (!booking.payment_id) {
      failed.push(toRow(booking, "no Naboopay payment on record — refund manually"));
      continue;
    }
    try {
      await naboopay(`refund/${encodeURIComponent(booking.payment_id)}`);
      await ctx.runMutation(internal.minSeats.markRefunded, { bookingId: booking._id });
      refunded.push(toRow(booking));
    } catch (error) {
      failed.push(toRow(booking, `refund failed: ${error instanceof Error ? error.message : error}`));
    }
  }

  // Booked but never paid: cancelled without a refund (empty on a retry run)
  const unpaid = bookings.filter((b) => cancelledUnpaidIds.includes(b._id)).map((b) => toRow(b));

  await ctx.runMutation(internal.minSeats.markChecked, { tripId });

  const route = `${trip.origin} → ${trip.destination}`;
  const when = `${trip.departure_date} at ${trip.departure_time}`;
  const paidTotal = refunded.length + failed.length;
  const subject = `DaBus: ${route} on ${when} was cancelled (${paidTotal}/${trip.min_seats} seats)`;
  const html = `
    <p><strong>${escapeHtml(route)}</strong>, ${escapeHtml(when)}, was cancelled automatically:
    only ${paidTotal} paid seat${paidTotal === 1 ? "" : "s"}, minimum ${trip.min_seats},
    checked ${trip.cutoff_hours} hour${trip.cutoff_hours === 1 ? "" : "s"} before departure.</p>
    <p>Please let these students know.</p>
    <h3>Refunded (${refunded.length})</h3>${rowsHtml(refunded)}
    <h3>Refund NOT done — handle manually (${failed.length})</h3>${rowsHtml(failed)}
    <h3>Booked but unpaid, cancelled (${unpaid.length})</h3>${rowsHtml(unpaid)}
  `;
  console.log(`${subject}. Refunded ${refunded.length}, failed ${failed.length}, unpaid ${unpaid.length}.`);
  const admins: string[] = await ctx.runQuery(internal.minSeats.adminEmails, {});
  await sendReport(subject, html, admins);
};

export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const trips: Doc<"trips">[] = await ctx.runQuery(internal.minSeats.dueTrips, { now: Date.now() });
    // One trip at a time; a failure on one trip must not block the others
    for (const trip of trips) {
      try {
        await checkTrip(ctx, trip);
      } catch (error) {
        console.error(`Min-seats check failed for trip ${trip._id}: ${error}`);
      }
    }
  },
});

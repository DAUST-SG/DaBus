import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const userRole = v.union(v.literal("student"), v.literal("admin"));
const tripStatus = v.union(
  v.literal("scheduled"),
  v.literal("full"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("archived"),
);
const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("completed"),
);
const paymentStatus = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("refunded"),
);

export default defineSchema({
  users: defineTable({
    auth_user_id: v.optional(v.string()),
    email: v.string(),
    full_name: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: userRole,
    password_hash: v.optional(v.string()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
    legacy_id: v.optional(v.string()),
  })
    .index("by_auth_user_id", ["auth_user_id"])
    .index("by_email", ["email"]),

  sessions: defineTable({
    token: v.string(),
    user_id: v.id("users"),
    expires_at: v.number(),
    created_at: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user_id", ["user_id"]),

  magic_links: defineTable({
    email: v.string(),
    token_hash: v.string(),
    expires_at: v.number(),
    used_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token_hash", ["token_hash"]),

  trips: defineTable({
    origin: v.string(),
    destination: v.string(),
    departure_date: v.string(),
    departure_time: v.string(),
    capacity: v.number(),
    available_seats: v.number(),
    price: v.number(),
    status: tripStatus,
    created_by: v.optional(v.id("users")),
    // Auto-cancel: if fewer than min_seats are paid cutoff_hours before departure,
    // the trip is cancelled and paid bookings refunded (see convex/minSeats.ts)
    min_seats: v.optional(v.number()),
    cutoff_hours: v.optional(v.number()),
    min_seats_cancelled_at: v.optional(v.number()),
    min_seats_checked_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
    legacy_id: v.optional(v.string()),
  })
    .index("by_departure_date", ["departure_date"])
    .index("by_status", ["status"]),

  bookings: defineTable({
    trip_id: v.id("trips"),
    user_id: v.optional(v.id("users")),
    status: bookingStatus,
    payment_status: paymentStatus,
    payment_id: v.optional(v.string()),
    payment_link: v.optional(v.string()),
    full_name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    pickup_location: v.optional(v.string()),
    dropoff_location: v.optional(v.string()),
    // Price charged through Naboopay, saved at booking time (trip price can change later)
    amount: v.optional(v.number()),
    paid_at: v.optional(v.number()),
    // DaLedger reporting state, see convex/ledger.ts
    ledger_sale: v.optional(v.union(v.literal("pending"), v.literal("done"), v.literal("failed"))),
    ledger_refund: v.optional(v.union(v.literal("pending"), v.literal("done"), v.literal("failed"))),
    ledger_refund_reason: v.optional(v.string()),
    ledger_error: v.optional(v.string()),
    // LEDGER_URL the sale/refund was accepted by, so they can be re-sent after switching ledgers
    ledger_target: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    legacy_id: v.optional(v.string()),
  })
    .index("by_trip_id", ["trip_id"])
    .index("by_user_id", ["user_id"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"])
    .index("by_payment_id", ["payment_id"]),

  // Shared pickup/drop-off stops, matched to a trip by its origin/destination city
  checkpoints: defineTable({
    name: v.string(),
    city: v.string(),
    active: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_city", ["city"]),

  webhook_events: defineTable({
    source: v.string(),
    event_id: v.string(),
    processed_at: v.number(),
  }).index("by_source_event", ["source", "event_id"]),
});

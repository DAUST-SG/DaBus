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
    // Bookings close this many minutes before departure (settings default if unset);
    // bookings_closed is the admin's manual close, kept until reopened
    booking_close_minutes: v.optional(v.number()),
    bookings_closed: v.optional(v.boolean()),
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
    // For booking limits: last 9 digits of the phone, and a hash of the booker's IP
    phone_key: v.optional(v.string()),
    client_key: v.optional(v.string()),
    // Private, unguessable id for the ticket page (/ticket/<token>); emailed once when paid
    ticket_token: v.optional(v.string()),
    ticket_emailed_at: v.optional(v.number()),
    // Ticket scanned at the bus door (convex/boarding.ts); kept after erasure as attendance
    boarded_at: v.optional(v.number()),
    boarded_by: v.optional(v.id("users")),
    // Set when name/phone/email were erased under the retention rule (convex/privacy.ts)
    personal_data_erased_at: v.optional(v.number()),
    // Kept after erasure: keyed hash of phone_key (RIDER_KEY_SECRET), equal for the same phone
    rider_key: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    legacy_id: v.optional(v.string()),
  })
    .index("by_trip_id", ["trip_id"])
    .index("by_user_id", ["user_id"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"])
    .index("by_payment_id", ["payment_id"])
    .index("by_phone_key", ["phone_key"])
    .index("by_client_key", ["client_key"])
    .index("by_ticket_token", ["ticket_token"]),

  // Shared pickup/drop-off stops, matched to a trip by its origin/destination city
  checkpoints: defineTable({
    name: v.string(),
    city: v.string(),
    active: v.boolean(),
    // Route order within the city (lowest first; unset stops go last)
    position: v.optional(v.number()),
    // Pickup time = trip departure time + this many minutes; unset = no time shown
    minutes_after_departure: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_city", ["city"]),

  // Single row of admin-editable rules; see convex/settings.ts for defaults
  settings: defineTable({
    max_unpaid_per_phone: v.number(),
    max_bookings_per_window: v.number(),
    booking_window_minutes: v.number(),
    refund_cutoff_hours: v.number(),
    default_booking_close_minutes: v.optional(v.number()),
    auto_complete_hours: v.optional(v.number()),
    personal_data_months: v.optional(v.number()),
    updated_at: v.number(),
  }),

  // Notices from the DaBus team: for one trip, or for everyone when trip_id is empty
  updates: defineTable({
    trip_id: v.optional(v.id("trips")),
    message: v.string(),
    posted_by: v.id("users"),
    created_at: v.number(),
  }).index("by_trip_id", ["trip_id"]),

  webhook_events: defineTable({
    source: v.string(),
    event_id: v.string(),
    processed_at: v.number(),
  }).index("by_source_event", ["source", "event_id"]),
});

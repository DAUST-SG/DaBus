# Recreate This Backend With Convex

## Scope of What Exists Today

This backend is a TypeScript Express API using Supabase (Auth + Postgres via service role key).

Core domains:

- Auth (`/api/auth`)
- Trips (`/api/trips`)
- Bookings (`/api/bookings`)
- Admin (`/api/admin`)
- Webhooks placeholder (`/api/webhooks/wave`)
- Excel exports for admin

Main files:

- `src/index.ts`
- `src/controllers/*.ts`
- `src/routes/*.ts`
- `src/middlewares/auth.ts`
- `src/supabase/schema.sql`
- `src/services/adminInit.ts`
- `src/services/excelService.ts`

## Current Data Model (Supabase)

From `src/supabase/schema.sql` and TS types:

- `users`
  - `id`, `email`, `full_name`, `phone`, `role`, timestamps
- `trips`
  - `origin`, `destination`, `departure_date`, `departure_time`, `capacity`, `available_seats`, `price`, `status`, `created_by`, timestamps
- `bookings`
  - `trip_id`, `status`, `payment_status`, `payment_id`, `full_name`, `phone`, timestamps
  - Code also writes `payment_link`, so include it in Convex even though SQL file omits it.
- `payments` exists in TypeScript types only, not in SQL routes logic (optional in migration unless you want clean payment audit).

Enums used by code:

- User role: `student | admin`
- Trip status: `scheduled | full | completed | cancelled`
- Booking status: `pending | confirmed | cancelled | completed`
- Payment status: `pending | paid | refunded`

## Existing API Behavior to Preserve

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me` (JWT required)
- `register` controller exists but is not exposed in routes.

### Trips

- Public list/filter trips and get trip by ID.
- Admin-only create/update/delete trips.

### Bookings

- Public booking creation with `trip_id + full_name + phone`.
- Authenticated user can list own bookings, read booking by ID, and cancel.
- Seat restoration/decrement uses DB functions.
- Payment link chosen from env by trip price (`WAVE_LINK_2500`, `WAVE_LINK_3000`).

### Admin

- Promote user route protected by shared secret.
- Stats endpoint.
- Paginated bookings + status update.
- Trips listing.
- Excel exports for trips/bookings/full report.

### Webhook

- `/api/webhooks/wave` is currently a placeholder.

## Convex Architecture Mapping

## 1) Convex schema (`convex/schema.ts`)

Define tables (Convex docs call them tables, similar to collections):

- `users`
  - `authUserId` (from Convex Auth identity subject)
  - `email`, `fullName`, `phone`
  - `role`
  - `createdAt`, `updatedAt`
- `trips`
  - same business fields as current backend
  - `createdBy` references `users._id`
- `bookings`
  - `tripId` references `trips._id`
  - `userId` optional (allow guest booking to match current behavior)
  - `status`, `paymentStatus`, `paymentId`, `paymentLink`
  - `fullName`, `phone`
  - `createdAt`, `updatedAt`
- Optional: `payments` table if you want reconciled transaction history.

Recommended indexes:

- `users` by `authUserId`, by `email`
- `trips` by `departureDate`, by `status`
- `bookings` by `tripId`, by `userId`, by `status`, by `createdAt`

## 2) Auth and authorization

Use Convex Auth (`ctx.auth.getUserIdentity()`):

- Create helper:
  - `requireIdentity(ctx)` for authenticated access.
  - `requireAdmin(ctx)` for role check.
- On first login, upsert a user profile document in `users`.
- Replace custom JWT middleware (`src/middlewares/auth.ts`) with Convex identity + role checks in each function.

## 3) Function split (queries/mutations/actions/httpAction)

Map existing endpoints:

- `trips:list` -> query
- `trips:getById` -> query
- `trips:create/update/delete` -> mutations with `requireAdmin`
- `bookings:create` -> mutation (guest or authed)
- `bookings:myBookings` -> query with auth
- `bookings:getById` -> query with ownership/admin guard
- `bookings:cancel` -> mutation
- `admin:stats` -> query with admin guard
- `admin:listBookings` -> query with pagination
- `admin:updateBookingStatus` -> mutation
- `admin:listTrips` -> query
- `admin:promoteUser` -> mutation or `httpAction` with shared secret
- `exports:*` -> `actions` (generate files and return URL/blob) or move export to frontend.
- `webhooks:wave` -> `httpAction`

## 4) Replace SQL RPC seat functions with atomic Convex logic

Supabase RPC currently adjusts available seats.  
In Convex mutations:

- Load trip
- Validate seat counts and booking status transitions
- Patch both `bookings` and `trips` in one mutation

This gives transactional consistency without SQL procedures.

## 5) Excel exports

Current backend streams XLSX directly from Express response.

Convex options:

- Option A: Keep a tiny Node service only for XLSX export.
- Option B: Use Convex Action + file storage (if dependency/runtime constraints fit).
- Option C: Move export generation to frontend/admin client.

For a pure Convex stack, Option B or C is cleaner.

## 6) Webhooks

Implement Wave webhook as Convex `httpAction`:

- Verify signature/secret.
- Resolve booking/payment.
- Update `paymentStatus` and `status`.
- Apply idempotency key (store event ID) to avoid duplicate processing.

## Suggested Convex Folder Layout

```txt
convex/
  schema.ts
  auth.ts
  users.ts
  trips.ts
  bookings.ts
  admin.ts
  webhooks.ts
  exports.ts
  lib/
    guards.ts
    time.ts
    validation.ts
```

## Migration Steps (Practical Order)

1. Initialize Convex project and configure auth provider.
2. Implement `schema.ts` with indexes.
3. Build `users` bootstrap/upsert logic from identity.
4. Implement trips queries/mutations.
5. Implement booking flow with atomic seat management.
6. Implement admin role checks + admin functions.
7. Implement webhook `httpAction`.
8. Implement exports (or decide to keep them outside Convex).
9. Write one-time migration script from Supabase to Convex.
10. Switch frontend API calls from Express routes to Convex functions.
11. Run parallel validation (old vs new) on key scenarios.
12. Decommission Express/Supabase service-role backend.

## Data Migration Mapping

Map IDs and preserve references:

- `users.id` (uuid) -> store as `legacyId` in Convex user document if needed.
- `trips.id` -> `legacyId`.
- `bookings.id` -> `legacyId`.
- For joins, resolve `legacyId` to Convex `_id` during import.

Import order:

1. Users
2. Trips
3. Bookings
4. Optional payments

## Behavior Gaps You Should Decide During Recreation

These are present in current code and should be fixed or intentionally preserved:

- `register` exists but route is missing.
- `getMyBookings` filters by `trip_id = userId` (likely bug; should be booking owner field).
- `bookings` SQL table in schema omits `payment_link`, but controller uses it.
- Role/permission checks are partly bypassed by use of Supabase service role key in backend.

## Minimal Convex MVP Checklist

- Public trip browsing
- Login + profile + role
- Guest booking creation with payment link
- Admin booking status workflow
- Seat consistency on confirm/cancel
- Admin stats + lists
- Webhook endpoint

If these pass, the Convex rewrite is functionally equivalent for primary operations.


/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as checkpoints from "../checkpoints.js";
import type * as crons from "../crons.js";
import type * as ledger from "../ledger.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_paymentStatus from "../lib/paymentStatus.js";
import type * as lib_seats from "../lib/seats.js";
import type * as lib_serializers from "../lib/serializers.js";
import type * as lib_ticketPdf from "../lib/ticketPdf.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validation from "../lib/validation.js";
import type * as minSeats from "../minSeats.js";
import type * as privacy from "../privacy.js";
import type * as settings from "../settings.js";
import type * as ticketEmail from "../ticketEmail.js";
import type * as tickets from "../tickets.js";
import type * as trips from "../trips.js";
import type * as updates from "../updates.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  bookings: typeof bookings;
  checkpoints: typeof checkpoints;
  crons: typeof crons;
  ledger: typeof ledger;
  "lib/guards": typeof lib_guards;
  "lib/paymentStatus": typeof lib_paymentStatus;
  "lib/seats": typeof lib_seats;
  "lib/serializers": typeof lib_serializers;
  "lib/ticketPdf": typeof lib_ticketPdf;
  "lib/time": typeof lib_time;
  "lib/validation": typeof lib_validation;
  minSeats: typeof minSeats;
  privacy: typeof privacy;
  settings: typeof settings;
  ticketEmail: typeof ticketEmail;
  tickets: typeof tickets;
  trips: typeof trips;
  updates: typeof updates;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

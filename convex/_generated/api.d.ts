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
import type * as http from "../http.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_paymentStatus from "../lib/paymentStatus.js";
import type * as lib_serializers from "../lib/serializers.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validation from "../lib/validation.js";
import type * as trips from "../trips.js";
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
  http: typeof http;
  "lib/guards": typeof lib_guards;
  "lib/paymentStatus": typeof lib_paymentStatus;
  "lib/serializers": typeof lib_serializers;
  "lib/time": typeof lib_time;
  "lib/validation": typeof lib_validation;
  trips: typeof trips;
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

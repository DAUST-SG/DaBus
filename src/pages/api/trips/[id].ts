import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

// "" or null from the form clears the value; a missing field leaves it unchanged
const optionalNumber = (v: unknown) => (v === "" || v === null ? null : v === undefined ? undefined : Number(v));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "");
  if (!id) {
    return sendError(res, 400, "Trip id is required");
  }

  if (req.method === "GET") {
    try {
      const data = await convexQuery("trips:getById", {
        tripId: id,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to load trip");
    }
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return sendError(res, 401, "Unauthorized");
      }

      const data = await convexMutation("trips:update", {
        sessionToken: token,
        tripId: id,
        origin: req.body?.origin,
        destination: req.body?.destination,
        departure_date: req.body?.departure_date,
        departure_time: req.body?.departure_time,
        capacity: req.body?.capacity,
        price: req.body?.price,
        min_seats: optionalNumber(req.body?.min_seats),
        cutoff_hours: optionalNumber(req.body?.cutoff_hours),
        booking_close_minutes: optionalNumber(req.body?.booking_close_minutes),
        bookings_closed: typeof req.body?.bookings_closed === "boolean" ? req.body.bookings_closed : undefined,
        status: req.body?.status,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to update trip");
    }
  }

  if (req.method === "DELETE") {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return sendError(res, 401, "Unauthorized");
      }

      const data = await convexMutation("trips:remove", {
        sessionToken: token,
        tripId: id,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to delete trip");
    }
  }

  return methodNotAllowed(req, res, ["GET", "PUT", "PATCH", "DELETE"]);
}

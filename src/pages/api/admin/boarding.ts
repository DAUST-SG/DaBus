import type { NextApiRequest, NextApiResponse } from "next";
import { getBearerToken, methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

// GET ?trip_id= → who should board; POST { trip_id, code } → check a ticket in;
// DELETE ?trip_id=&booking_id= → undo; PUT { trip_id, booking_id | null } → choose the passenger scanner
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST", "DELETE", "PUT"].includes(req.method || "")) {
    return methodNotAllowed(req, res, ["GET", "POST", "DELETE", "PUT"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  const tripId = String(req.query.trip_id || req.body?.trip_id || "");
  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("boarding:tripSummary", { sessionToken: token, tripId }));
    }
    if (req.method === "POST") {
      return sendSuccess(res, await convexMutation("boarding:checkIn", { sessionToken: token, tripId, code: String(req.body?.code || "") }));
    }
    if (req.method === "PUT") {
      return sendSuccess(res, await convexMutation("boarding:setScanner", { sessionToken: token, tripId, bookingId: req.body?.booking_id || null }));
    }
    return sendSuccess(res, await convexMutation("boarding:undo", { sessionToken: token, tripId, bookingId: String(req.query.booking_id || "") }));
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Boarding check failed");
  }
}

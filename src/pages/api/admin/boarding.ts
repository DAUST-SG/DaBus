import type { NextApiRequest, NextApiResponse } from "next";
import { getBearerToken, methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

// GET ?trip_id= → who should board; POST { trip_id, code } → check a ticket in; DELETE ?booking_id= → undo
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return methodNotAllowed(req, res, ["GET", "POST", "DELETE"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("boarding:tripSummary", { sessionToken: token, tripId: String(req.query.trip_id || "") }));
    }
    if (req.method === "POST") {
      return sendSuccess(
        res,
        await convexMutation("boarding:checkIn", {
          sessionToken: token,
          tripId: String(req.body?.trip_id || ""),
          code: String(req.body?.code || ""),
        }),
      );
    }
    return sendSuccess(res, await convexMutation("boarding:undo", { sessionToken: token, bookingId: String(req.query.booking_id || "") }));
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Boarding check failed");
  }
}

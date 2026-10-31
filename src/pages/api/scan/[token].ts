import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

// The passenger scanner's API: the scan link's token is the access (see boarding.ts authorize)
// GET → who should board; POST { code } → check a ticket in; DELETE ?booking_id= → undo
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST", "DELETE"].includes(req.method || "")) {
    return methodNotAllowed(req, res, ["GET", "POST", "DELETE"]);
  }

  const scanToken = String(req.query.token || "");
  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("boarding:tripSummary", { scanToken }));
    }
    if (req.method === "POST") {
      return sendSuccess(res, await convexMutation("boarding:checkIn", { scanToken, code: String(req.body?.code || "") }));
    }
    return sendSuccess(res, await convexMutation("boarding:undo", { scanToken, bookingId: String(req.query.booking_id || "") }));
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Boarding check failed");
  }
}

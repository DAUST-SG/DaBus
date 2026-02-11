import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexQuery } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  try {
    const data = await convexQuery("admin:listBookings", {
      sessionToken: token,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: req.query.cursor ? String(req.query.cursor) : undefined,
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to load admin bookings");
  }
}

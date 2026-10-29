import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const data = await convexQuery("trips:list", {
        origin: req.query.origin ? String(req.query.origin) : undefined,
        destination: req.query.destination ? String(req.query.destination) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to load trips");
    }
  }

  if (req.method === "POST") {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return sendError(res, 401, "Unauthorized");
      }

      const data = await convexMutation("trips:create", {
        sessionToken: token,
        origin: String(req.body?.origin || ""),
        destination: String(req.body?.destination || ""),
        departure_date: String(req.body?.departure_date || ""),
        departure_time: String(req.body?.departure_time || ""),
        capacity: Number(req.body?.capacity || 0),
        price: Number(req.body?.price || 0),
        min_seats: req.body?.min_seats ? Number(req.body.min_seats) : undefined,
        cutoff_hours: req.body?.cutoff_hours ? Number(req.body.cutoff_hours) : undefined,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to create trip");
    }
  }

  return methodNotAllowed(req, res, ["GET", "POST"]);
}

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
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(req, res, ["GET", "PUT"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("settings:get", { sessionToken: token }));
    }
    const data = await convexMutation("settings:update", {
      sessionToken: token,
      max_unpaid_per_phone: Number(req.body?.max_unpaid_per_phone),
      max_bookings_per_window: Number(req.body?.max_bookings_per_window),
      booking_window_minutes: Number(req.body?.booking_window_minutes),
      refund_cutoff_hours: Number(req.body?.refund_cutoff_hours),
      default_booking_close_minutes: Number(req.body?.default_booking_close_minutes),
      auto_complete_hours: Number(req.body?.auto_complete_hours),
      personal_data_months: Number(req.body?.personal_data_months),
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to save settings");
  }
}

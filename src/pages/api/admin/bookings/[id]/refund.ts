import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexQuery, convexMutation } from "@/server/convexClient";
import { NaboopayError } from "@/server/naboopay";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  const bookingId = String(req.query.id || "");
  if (!bookingId) {
    return sendError(res, 400, "Booking id is required");
  }

  try {
    // Fetch booking + trip details
    const { booking, trip } = await convexQuery<{
      booking: { _id: string; payment_id?: string; payment_status: string; status: string; trip_id: string };
      trip: { _id: string; departure_date: string; departure_time: string } | null;
    }>("admin:getBookingById", {
      sessionToken: token,
      bookingId,
    });

    if (booking.payment_status !== "paid") {
      return sendError(res, 400, "Booking is not paid");
    }

    if (!booking.payment_id) {
      return sendError(res, 400, "No payment ID associated with this booking");
    }

    if (!trip) {
      return sendError(res, 404, "Trip not found");
    }

    // Check 3-hour window
    const departureDatetime = new Date(`${trip.departure_date}T${trip.departure_time}`);
    const nowPlus3h = new Date(Date.now() + 3 * 60 * 60 * 1000);
    if (departureDatetime <= nowPlus3h) {
      return sendError(res, 400, "Too late to refund — trip departs in less than 3 hours");
    }

    // Call Naboopay refund API
    const apiKey = process.env.NABOOPAY_API_KEY;
    if (!apiKey) {
      return sendError(res, 500, "Naboopay is not configured");
    }

    const refundResponse = await fetch(
      `https://api.naboopay.com/api/v2/refund/${booking.payment_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!refundResponse.ok) {
      let message = "Naboopay refund request failed";
      try {
        const body = await refundResponse.json();
        message = body?.message || body?.error || body?.detail || message;
      } catch {
        // ignore parse errors
      }
      throw new NaboopayError(refundResponse.status, String(message));
    }

    // Update booking to cancelled + refunded
    const updated = await convexMutation("admin:updateBookingStatus", {
      sessionToken: token,
      bookingId,
      status: "cancelled",
    });

    return sendSuccess(res, updated);
  } catch (error) {
    if (error instanceof NaboopayError) {
      return sendError(res, error.status >= 500 ? 502 : error.status, error.message);
    }
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to refund booking");
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexQuery, convexMutation } from "@/server/convexClient";
import { NaboopayError, refundNaboopayTransaction } from "@/server/naboopay";

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
    const { booking } = await convexQuery<{
      booking: { _id: string; payment_id?: string; payment_status: string; status: string; trip_id: string };
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

    // Admins can refund at any time; the refund window in Settings only limits students
    await refundNaboopayTransaction(booking.payment_id);

    // Update booking to cancelled + refunded
    const updated = await convexMutation("admin:updateBookingStatus", {
      sessionToken: token,
      bookingId,
      status: "cancelled",
      refundedViaNaboopay: true,
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

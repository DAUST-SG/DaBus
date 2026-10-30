import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";
import { getNaboopayTransaction, NaboopayError } from "@/server/naboopay";

// Cancels a booking that was marked paid but never actually paid (e.g. confirmed by mistake)
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
    const { booking } = await convexQuery<{ booking: { payment_id?: string } }>("admin:getBookingById", {
      sessionToken: token,
      bookingId,
    });

    // Ask Naboopay first: never cancel without refund a booking that was really paid
    const transaction = booking.payment_id ? await getNaboopayTransaction(booking.payment_id) : null;

    const updated = await convexMutation("admin:markUnpaid", {
      sessionToken: token,
      bookingId,
      transaction_status: transaction?.transaction_status,
    });
    return sendSuccess(res, updated);
  } catch (error) {
    if (error instanceof NaboopayError) {
      return sendError(res, error.status >= 500 ? 502 : error.status, error.message);
    }
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to cancel booking");
  }
}

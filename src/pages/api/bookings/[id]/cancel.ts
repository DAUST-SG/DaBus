import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery, serverSecret } from "@/server/convexClient";
import { NaboopayError, refundNaboopayTransaction } from "@/server/naboopay";

// Student cancellation. Unpaid: cancel. Paid: refund through Naboopay first, then cancel,
// so a booking is never marked refunded without the money going back.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }
  const bookingId = String(req.query.id || "");

  try {
    const check = await convexQuery<{ allowed: boolean; needsRefund: boolean; message?: string; payment_id?: string }>(
      "bookings:cancellationCheck",
      { sessionToken: token, bookingId },
    );
    if (!check.allowed) {
      return sendError(res, 400, check.message || "This booking can't be cancelled");
    }

    if (!check.needsRefund) {
      const data = await convexMutation("bookings:cancel", { sessionToken: token, bookingId });
      return sendSuccess(res, data);
    }

    await refundNaboopayTransaction(check.payment_id!);
    const data = await convexMutation("bookings:cancel", {
      serverSecret: serverSecret(),
      bookingId,
      refundedViaNaboopay: true,
    });
    return sendSuccess(res, data, "Booking cancelled. Your refund is on its way.");
  } catch (error) {
    if (error instanceof NaboopayError) {
      return sendError(res, 502, `The refund couldn't be processed (${error.message}). Your booking is still active; please contact the DaBus team.`);
    }
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Cancellation failed");
  }
}

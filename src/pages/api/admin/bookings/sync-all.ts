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

type SyncCandidate = {
  id: string;
  payment_id?: string;
  status: string;
  payment_status: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    const candidates = await convexQuery<SyncCandidate[]>("admin:listBookingsForSync", {
      sessionToken: token,
    });

    const summary = {
      total: candidates.length,
      updated: 0,
      unchanged: 0,
      errors: 0,
      details: [] as Array<{
        id: string;
        ok: boolean;
        changed?: boolean;
        previousStatus?: string;
        newStatus?: string;
        remoteStatus?: string;
        error?: string;
      }>,
    };

    for (const candidate of candidates) {
      if (!candidate.payment_id) {
        continue;
      }
      try {
        const transaction = await getNaboopayTransaction(candidate.payment_id);
        const result = await convexMutation<{
          changed: boolean;
          remoteStatus: string;
          previousStatus?: string;
          booking: { status: string };
        }>("admin:syncBookingFromNaboopay", {
          sessionToken: token,
          bookingId: candidate.id,
          transaction_status: transaction.transaction_status,
        });

        if (result.changed) {
          summary.updated += 1;
          summary.details.push({
            id: candidate.id,
            ok: true,
            changed: true,
            previousStatus: result.previousStatus,
            newStatus: result.booking.status,
            remoteStatus: result.remoteStatus,
          });
        } else {
          summary.unchanged += 1;
          summary.details.push({
            id: candidate.id,
            ok: true,
            changed: false,
            remoteStatus: result.remoteStatus,
          });
        }
      } catch (err) {
        summary.errors += 1;
        const message =
          err instanceof NaboopayError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Sync failed";
        summary.details.push({ id: candidate.id, ok: false, error: message });
      }
    }

    return sendSuccess(res, summary);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to sync bookings");
  }
}

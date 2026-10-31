import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexAction, convexQuery, serverSecret } from "@/server/convexClient";

// Public: the token in the URL is the access. ?check=1 asks Naboopay for a still-pending
// payment first, so a student back from paying sees "confirmed" without waiting for the webhook.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  const token = String(req.query.token || "");
  try {
    if (req.query.check === "1") {
      await convexAction("tickets:checkPayment", { serverSecret: serverSecret(), token }).catch(() => undefined);
    }
    const ticket = await convexQuery("tickets:byToken", { token });
    if (!ticket) {
      return sendError(res, 404, "Ticket not found");
    }
    return sendSuccess(res, ticket);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to load ticket");
  }
}

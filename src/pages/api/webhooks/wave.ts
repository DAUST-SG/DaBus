import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation } from "@/server/convexClient";

const verifyWebhookSecret = (req: NextApiRequest) => {
  const expected = process.env.WAVE_WEBHOOK_SECRET;
  if (!expected) {
    return true;
  }
  const provided = req.headers["x-wave-secret"] || req.headers["x-webhook-secret"];
  return provided === expected;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  if (!verifyWebhookSecret(req)) {
    return sendError(res, 401, "Unauthorized webhook");
  }

  try {
    const payload = req.body || {};
    const data = await convexMutation("webhooks:processWaveWebhook", {
      event_id: String(payload.id || payload.event_id || payload.reference || crypto.randomUUID()),
      booking_id: payload.booking_id || payload.metadata?.booking_id,
      payment_id: payload.payment_id || payload.transaction_id,
      status: String(payload.status || payload.payment_status || ""),
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Webhook processing failed");
  }
}

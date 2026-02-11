import type { NextApiRequest, NextApiResponse } from "next";
import {
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation } from "@/server/convexClient";
import { verifyNaboopaySignature } from "@/server/naboopay";

const readSignature = (req: NextApiRequest) => {
  const raw = req.headers["x-signature"];
  if (Array.isArray(raw)) {
    return raw[0] || "";
  }
  return raw || "";
};

const buildEventId = (payload: Record<string, unknown>) => {
  const explicit = payload.event_id;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit;
  }

  const orderId = String(payload.order_id || "unknown-order");
  const status = String(payload.transaction_status || payload.status || "unknown-status");
  const stamp = String(payload.updated_at || payload.paid_at || payload.created_at || Date.now());
  return `${orderId}:${status}:${stamp}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const secret = process.env.NABOOPAY_WEBHOOK_SECRET;
  if (!secret) {
    return sendError(res, 500, "Webhook secret is not configured");
  }

  const payload = (req.body || {}) as Record<string, unknown>;
  const signature = readSignature(req);

  if (!signature || !verifyNaboopaySignature(payload, signature, secret)) {
    return sendError(res, 401, "Invalid signature");
  }

  try {
    const data = await convexMutation("webhooks:processNaboopayWebhook", {
      event_id: buildEventId(payload),
      order_id: payload.order_id ? String(payload.order_id) : undefined,
      booking_id: payload.booking_id || (payload.metadata as Record<string, unknown> | undefined)?.booking_id,
      transaction_status: String(payload.transaction_status || payload.status || ""),
    });

    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Webhook processing failed");
  }
}

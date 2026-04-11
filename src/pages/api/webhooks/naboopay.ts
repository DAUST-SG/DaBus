import type { NextApiRequest, NextApiResponse } from "next";
import {
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation } from "@/server/convexClient";
import { verifyNaboopaySignature } from "@/server/naboopay";

export const config = {
  api: {
    bodyParser: false,
  },
};

const readSignature = (req: NextApiRequest) => {
  const headerKeys = [
    "x-signature",
    "x-webhook-signature",
    "x-naboopay-signature",
    "signature",
    "x-naboo-signature",
    "naboopay-signature",
    "naboo-signature",
  ] as const;

  for (const key of headerKeys) {
    const raw = req.headers[key];
    if (Array.isArray(raw) && raw[0]) {
      return raw[0];
    }
    if (typeof raw === "string" && raw) {
      return raw;
    }
  }

  return "";
};

const readRawBody = async (req: NextApiRequest) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const parseWebhookPayload = (rawBody: string) => {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
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
  if (req.method === "GET" || req.method === "HEAD") {
    return sendSuccess(res, { ok: true, source: "naboopay" });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["GET", "HEAD", "POST"]);
  }

  const secret = process.env.NABOOPAY_WEBHOOK_SECRET;
  if (!secret) {
    return sendError(res, 500, "Webhook secret is not configured");
  }

  const rawBody = await readRawBody(req);
  const payload = parseWebhookPayload(rawBody);
  if (!payload) {
    return sendError(res, 400, "Invalid JSON payload");
  }

  const signature = readSignature(req);

  if (!signature || !verifyNaboopaySignature(rawBody, signature, secret)) {
    return sendError(res, 401, "Invalid signature");
  }

  try {
    const data = await convexMutation("webhooks:processNaboopayWebhook", {
      event_id: buildEventId(payload),
      order_id: payload.order_id ? String(payload.order_id) : undefined,
      transaction_status: String(payload.transaction_status || payload.status || ""),
    });

    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Webhook processing failed");
  }
}

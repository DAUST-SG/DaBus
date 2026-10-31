import type { NextApiRequest, NextApiResponse } from "next";
import {
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, serverSecret } from "@/server/convexClient";
import { sendMagicLinkEmail } from "@/server/magicLink";

const MAGIC_LINK_EXPIRY_MINUTES = 20;

const normalizeNextPath = (value: unknown) => {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
};

const resolveBaseUrl = (req: NextApiRequest) => {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase) {
    return envBase;
  }

  // Set APP_BASE_URL in production; the Host header is only a fallback for local dev
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || "http";
  const host = String(req.headers.host || "localhost:3000");
  return `${protocol}://${host}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    const nextPath = normalizeNextPath(req.body?.next);
    const requested = await convexMutation<{ email: string; token: string }>("auth:requestStudentMagicLink", {
      serverSecret: serverSecret(),
      email: String(req.body?.email || ""),
    });

    const baseUrl = resolveBaseUrl(req);
    const magicLink = `${baseUrl}/magic-link?token=${encodeURIComponent(requested.token)}&next=${encodeURIComponent(nextPath)}`;

    const delivered = await sendMagicLinkEmail({
      to: requested.email,
      magicLink,
      expiresMinutes: MAGIC_LINK_EXPIRY_MINUTES,
    });

    if (delivered.sent) {
      return sendSuccess(res, {
        delivered: true,
      }, "Magic link sent. Check your inbox.");
    }

    if (process.env.NODE_ENV !== "production") {
      return sendSuccess(res, {
        delivered: false,
        dev_magic_link: magicLink,
      }, "Email provider not configured; using development link.");
    }

    return sendError(res, 500, "Unable to send magic link email");
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to request magic link");
  }
}

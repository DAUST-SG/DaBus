import { createHash } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export type SuccessPayload<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ErrorPayload = {
  success: false;
  error: string;
};

export const sendSuccess = <T>(
  res: NextApiResponse<SuccessPayload<T>>,
  data: T,
  message?: string,
) => {
  res.status(200).json({ success: true, data, message });
};

export const sendError = (
  res: NextApiResponse<ErrorPayload>,
  status: number,
  error: string,
) => {
  res.status(status).json({ success: false, error });
};

export const methodNotAllowed = (
  req: NextApiRequest,
  res: NextApiResponse,
  allowed: string[],
) => {
  res.setHeader("Allow", allowed);
  sendError(res as NextApiResponse<ErrorPayload>, 405, `Method ${req.method} not allowed`);
};

export const getBearerToken = (req: NextApiRequest) => {
  const raw = req.headers.authorization;
  if (!raw) {
    return undefined;
  }

  const [scheme, value] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return undefined;
  }

  return value;
};

export const parseConvexError = (error: unknown) => {
  const fallback = { status: 500, message: "Internal server error" };
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message || fallback.message;
  const topLevel = parseJsonError(message);
  const topLevelMessage = topLevel?.message ?? message;

  const nestedConvex = extractNestedConvexError(topLevelMessage);
  if (nestedConvex) {
    return nestedConvex;
  }

  if (topLevel?.status || topLevel?.message) {
    return {
      status: topLevel.status || (topLevelMessage.toLowerCase().includes("unauthorized") ? 401 : 500),
      message: topLevel.message || topLevelMessage || fallback.message,
    };
  }

  const statusMatch = message.match(/"status"\s*:\s*(\d{3})/);
  if (statusMatch) {
    return {
      status: Number(statusMatch[1]),
      message: extractConvexMessage(message) ?? fallback.message,
    };
  }

  return {
    status: message.toLowerCase().includes("unauthorized") ? 401 : 500,
    message: extractConvexMessage(message) ?? message,
  };
};

const extractConvexMessage = (message: string) => {
  const match = message.match(/"message"\s*:\s*"([^"]+)"/);
  return match ? match[1] : undefined;
};

const parseJsonError = (input: string): { status?: number; message?: string } | null => {
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const status = typeof (parsed as { status?: unknown }).status === "number"
      ? ((parsed as { status?: number }).status as number)
      : undefined;
    const message = typeof (parsed as { message?: unknown }).message === "string"
      ? ((parsed as { message?: string }).message as string)
      : undefined;
    return { status, message };
  } catch {
    return null;
  }
};

const extractNestedConvexError = (input: string): { status: number; message: string } | null => {
  if (!input.includes("ConvexError")) {
    return null;
  }

  const marker = "ConvexError:";
  const markerIndex = input.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const rawTail = input.slice(markerIndex + marker.length).trim();
  const normalizedTail = rawTail.replace(/\\"/g, "\"");

  const candidate = [rawTail, normalizedTail].find((tail) => tail.startsWith("{") && tail.endsWith("}"));
  if (!candidate) {
    return null;
  }

  const parsed = parseJsonError(candidate);
  if (!parsed?.status && !parsed?.message) {
    return null;
  }

  return {
    status: parsed.status || 500,
    message: parsed.message || "Internal server error",
  };
};

// Hash of the caller's IP for booking limits, so no raw IP is stored. On Vercel the first
// x-forwarded-for entry is the real client address.
export const clientKey = (req: NextApiRequest) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "";
  return ip ? createHash("sha256").update(`dabus:${ip}`).digest("hex").slice(0, 32) : undefined;
};

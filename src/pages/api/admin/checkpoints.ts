import type { NextApiRequest, NextApiResponse } from "next";
import {
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST", "PATCH"].includes(req.method || "")) {
    return methodNotAllowed(req, res, ["GET", "POST", "PATCH"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    if (req.method === "GET") {
      const data = await convexQuery("checkpoints:listAll", { sessionToken: token });
      return sendSuccess(res, data);
    }

    if (req.method === "POST") {
      const data = await convexMutation("checkpoints:create", {
        sessionToken: token,
        name: String(req.body?.name || ""),
        city: String(req.body?.city || ""),
      });
      return sendSuccess(res, data);
    }

    if (req.body?.direction) {
      return sendSuccess(res, await convexMutation("checkpoints:move", {
        sessionToken: token,
        checkpointId: String(req.body.id || ""),
        direction: req.body.direction === "up" ? "up" : "down",
      }));
    }
    if (req.body && "minutes_after_departure" in req.body) {
      const minutes = req.body.minutes_after_departure;
      return sendSuccess(res, await convexMutation("checkpoints:setMinutes", {
        sessionToken: token,
        checkpointId: String(req.body.id || ""),
        minutes: minutes === "" || minutes === null ? null : Number(minutes),
      }));
    }
    const data = await convexMutation("checkpoints:setActive", {
      sessionToken: token,
      checkpointId: String(req.body?.id || ""),
      active: Boolean(req.body?.active),
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to update checkpoints");
  }
}

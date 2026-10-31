import type { NextApiRequest, NextApiResponse } from "next";
import { getBearerToken, methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return methodNotAllowed(req, res, ["GET", "POST", "DELETE"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("updates:listAll", { sessionToken: token }));
    }
    if (req.method === "POST") {
      return sendSuccess(
        res,
        await convexMutation("updates:post", {
          sessionToken: token,
          tripId: req.body?.trip_id || undefined,
          message: String(req.body?.message || ""),
        }),
      );
    }
    return sendSuccess(res, await convexMutation("updates:remove", { sessionToken: token, updateId: String(req.query.id || "") }));
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to save update");
  }
}

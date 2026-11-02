import type { NextApiRequest, NextApiResponse } from "next";
import { getBearerToken, methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexMutation, convexQuery } from "@/server/convexClient";

// GET → recent problems and who gets alerts; PUT { alert_emails } → change who gets alerts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(req, res, ["GET", "PUT"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    if (req.method === "GET") {
      return sendSuccess(res, await convexQuery("problems:recent", { sessionToken: token }));
    }
    return sendSuccess(
      res,
      await convexMutation("problems:setAlertEmails", { sessionToken: token, alert_emails: String(req.body?.alert_emails || "") }),
    );
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to load alerts");
  }
}

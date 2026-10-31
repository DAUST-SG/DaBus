import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, parseConvexError, sendError, sendSuccess } from "@/server/api";
import { convexQuery } from "@/server/convexClient";

// General notices from the DaBus team, shown on the home page
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  try {
    return sendSuccess(res, await convexQuery("updates:general", {}));
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to load updates");
  }
}

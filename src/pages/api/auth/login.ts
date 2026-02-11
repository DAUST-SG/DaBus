import type { NextApiRequest, NextApiResponse } from "next";
import { sendError, sendSuccess, methodNotAllowed, parseConvexError } from "@/server/api";
import { convexMutation } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    const { email, password } = req.body || {};
    const data = await convexMutation<{ token: string; user: unknown }>("auth:login", {
      email: String(email || ""),
      password: String(password || ""),
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Login failed");
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { sendError, sendSuccess, methodNotAllowed, parseConvexError } from "@/server/api";
import { convexMutation } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    const { email, password, full_name, phone } = req.body || {};
    const data = await convexMutation<{ token: string; user: unknown }>("auth:register", {
      email: String(email || ""),
      password: String(password || ""),
      full_name: String(full_name || ""),
      phone: String(phone || ""),
    });
    return sendSuccess(res, data);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Registration failed");
  }
}

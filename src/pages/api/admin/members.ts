import type { NextApiRequest, NextApiResponse } from "next";
import {
    getBearerToken,
    methodNotAllowed,
    parseConvexError,
    sendError,
    sendSuccess,
} from "@/server/api";
import { convexMutation } from "@/server/convexClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return methodNotAllowed(req, res, ["POST"]);
    }

    const token = getBearerToken(req);
    if (!token) {
        return sendError(res, 401, "Unauthorized");
    }

    try {
        const { email, password, full_name, phone } = req.body || {};
        const data = await convexMutation("admin:addAdmin", {
            sessionToken: token,
            email: String(email || ""),
            password: String(password || ""),
            full_name: String(full_name || ""),
            phone: String(phone || ""),
        });
        return sendSuccess(res, data);
    } catch (error) {
        const parsed = parseConvexError(error);
        return sendError(res, parsed.status, parsed.message || "Failed to add admin");
    }
}

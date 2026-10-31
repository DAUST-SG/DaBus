import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, sendError } from "@/server/api";
import { convexQuery } from "@/server/convexClient";
import type { Ticket } from "../../../../../convex/tickets";
import { buildTicketPdf } from "../../../../../convex/lib/ticketPdf";

const resolveBaseUrl = (req: NextApiRequest) =>
  process.env.APP_BASE_URL || `${String(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  const token = String(req.query.token || "");
  const ticket = await convexQuery<Ticket | null>("tickets:byToken", { token }).catch(() => null);
  if (!ticket || !ticket.trip) {
    return sendError(res, 404, "Ticket not found");
  }
  if (ticket.payment_status !== "paid" || ticket.status === "cancelled") {
    return sendError(res, 409, "This ticket isn't valid (not paid, or cancelled)");
  }

  const bytes = await buildTicketPdf(ticket, `${resolveBaseUrl(req)}/ticket/${token}`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="DaBus-ticket-${ticket.ref}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).send(Buffer.from(bytes));
}

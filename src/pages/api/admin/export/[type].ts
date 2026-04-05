import type { NextApiRequest, NextApiResponse } from "next";
import { getBearerToken, methodNotAllowed, parseConvexError, sendError } from "@/server/api";
import { toCsv } from "@/server/csv";
import { convexQuery } from "@/server/convexClient";

type ExportType = "trips" | "bookings" | "report";

const isExportType = (value: string): value is ExportType =>
  value === "trips" || value === "bookings" || value === "report";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, "Unauthorized");
  }

  const type = String(req.query.type || "");
  if (!isExportType(type)) {
    return sendError(res, 400, "Invalid export type");
  }

  try {
    let csv = "";

    if (type === "trips") {
      const trips = await convexQuery<Array<Record<string, unknown>>>("admin:listTrips", {
        sessionToken: token,
      });
      csv = toCsv(trips);
    }

    if (type === "bookings") {
      const tripIdFilter = req.query.trip_id ? String(req.query.trip_id) : null;
      const paidOnly = req.query.paid_only === "true";

      const bookings = await convexQuery<Array<Record<string, unknown>>>("admin:listBookings", {
        sessionToken: token,
        limit: 5000,
      });

      const filtered = bookings.filter((b: any) => {
        if (b.status === "cancelled") return false;
        if (paidOnly && b.payment_status !== "paid") return false;
        if (tripIdFilter && String(b.trip_id) !== tripIdFilter) return false;
        return true;
      });

      const simplified = filtered.map((b: any) => {
        const parts = String(b.full_name || "").trim().split(/\s+/);
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        return {
          first_name: firstName,
          last_name: lastName,
          phone: b.phone || "",
          pickup_location: b.pickup_location || "",
          payment_status: b.payment_status,
          booking_status: b.status,
          email: b.email || "",
        };
      });
      csv = toCsv(simplified);
    }

    if (type === "report") {
      const [stats, trips, bookings] = await Promise.all([
        convexQuery<Record<string, unknown>>("admin:stats", { sessionToken: token }),
        convexQuery<Array<Record<string, unknown>>>("admin:listTrips", { sessionToken: token }),
        convexQuery<Array<Record<string, unknown>>>("admin:listBookings", {
          sessionToken: token,
          limit: 5000,
        }),
      ]);

      const lines = [
        "[stats]",
        toCsv([stats]),
        "",
        "[trips]",
        toCsv(trips),
        "",
        "[bookings]",
        toCsv(bookings),
      ];
      csv = lines.join("\n");
    }

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename=\"${type}_export.csv\"`);
    res.status(200).send(csv);
  } catch (error) {
    const parsed = parseConvexError(error);
    return sendError(res, parsed.status, parsed.message || "Failed to export data");
  }
}

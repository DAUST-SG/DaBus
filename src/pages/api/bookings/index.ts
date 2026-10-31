import type { NextApiRequest, NextApiResponse } from "next";
import {
  clientKey,
  getBearerToken,
  methodNotAllowed,
  parseConvexError,
  sendError,
  sendSuccess,
} from "@/server/api";
import { convexMutation, convexQuery, serverSecret } from "@/server/convexClient";
import { createNaboopayTransaction, NaboopayError } from "@/server/naboopay";

const resolveBaseUrl = (req: NextApiRequest) => {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase) {
    return envBase;
  }

  // Set APP_BASE_URL in production; the Host header is only a fallback for local dev
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || "http";
  const host = String(req.headers.host || "localhost:3000");
  return `${protocol}://${host}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return sendError(res, 401, "Unauthorized");
      }

      const data = await convexQuery("bookings:myBookings", {
        sessionToken: token,
      });
      return sendSuccess(res, data);
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to load bookings");
    }
  }

  if (req.method === "POST") {
    try {
      const token = getBearerToken(req);
      const email = String(req.body?.email || "").trim();

      const created = await convexMutation<{ booking: { id: string; trip_id: string; full_name?: string; phone?: string; email?: string; pickup_location?: string; ticket_token?: string } }>("bookings:create", {
        serverSecret: serverSecret(),
        clientKey: clientKey(req),
        sessionToken: token || undefined,
        trip_id: String(req.body?.trip_id || ""),
        full_name: String(req.body?.full_name || ""),
        phone: String(req.body?.phone || ""),
        email: email || undefined,
        pickup_location: req.body?.pickup_location ? String(req.body.pickup_location) : undefined,
        dropoff_location: req.body?.dropoff_location ? String(req.body.dropoff_location) : undefined,
      });

      const bookingId = String(created?.booking?.id || "");
      const tripId = String(created?.booking?.trip_id || req.body?.trip_id || "");

      try {
        // For logged-in users, fetch their profile; for guests, skip
        const [me, trip] = await Promise.all([
          token
            ? convexQuery<{ email: string; full_name: string }>("auth:me", { sessionToken: token })
            : Promise.resolve(null),
          convexQuery<{ origin: string; destination: string; departure_date: string; departure_time: string; price: number }>(
            "trips:getById",
            { tripId },
          ),
        ]);

        const baseUrl = resolveBaseUrl(req);
        // Back from Naboopay, students land on their ticket, which confirms the payment
        const successUrl = `${baseUrl}/ticket/${encodeURIComponent(String(created.booking.ticket_token || ""))}?payment=success`;
        const errorUrl = `${baseUrl}/trips/${encodeURIComponent(tripId)}?payment=error`;

        const checkout = await createNaboopayTransaction({
          amount: Number(trip.price),
          productName: `${trip.origin} → ${trip.destination} (${trip.departure_date} ${trip.departure_time})`,
          customer: {
            name: String(created.booking.full_name || me?.full_name || "Guest"),
            email: email || String(me?.email || ""),
            phone: String(created.booking.phone || ""),
          },
          successUrl,
          errorUrl,
        });

        const updatedBooking = await convexMutation("bookings:attachPaymentTransaction", {
          serverSecret: serverSecret(),
          bookingId,
          payment_id: checkout.order_id,
          payment_link: checkout.checkout_url,
        });

        return sendSuccess(res, {
          booking: updatedBooking,
          payment: {
            order_id: checkout.order_id,
            checkout_url: checkout.checkout_url,
            transaction_status: checkout.transaction_status || "pending",
          },
        });
      } catch (paymentError) {
        if (bookingId) {
          // For guest bookings without a token, cancel without session
          await convexMutation("bookings:cancel", {
            serverSecret: serverSecret(),
            bookingId,
          }).catch(() => undefined);
        }

        if (paymentError instanceof NaboopayError) {
          return sendError(res, paymentError.status, paymentError.message);
        }

        const parsedPayment = parseConvexError(paymentError);
        return sendError(res, parsedPayment.status, parsedPayment.message || "Payment initialization failed");
      }
    } catch (error) {
      const parsed = parseConvexError(error);
      return sendError(res, parsed.status, parsed.message || "Failed to create booking");
    }
  }

  return methodNotAllowed(req, res, ["GET", "POST"]);
}

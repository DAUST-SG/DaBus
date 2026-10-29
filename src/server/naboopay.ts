import { createHmac, timingSafeEqual } from "node:crypto";

export class NaboopayError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "NaboopayError";
    this.status = status;
  }
}

export type NaboopayCreateTransactionInput = {
  amount: number;
  productName: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  successUrl: string;
  errorUrl: string;
};

export type NaboopayCreateTransactionResult = {
  order_id: string;
  checkout_url: string;
  transaction_status?: string;
};

export const createNaboopayTransaction = async (
  input: NaboopayCreateTransactionInput,
): Promise<NaboopayCreateTransactionResult> => {
  const apiKey = process.env.NABOOPAY_API_KEY;
  if (!apiKey) {
    throw new NaboopayError(500, "Naboopay is not configured");
  }

  const response = await fetch("https://api.naboopay.com/api/v2/transactions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method_of_payment: ["wave", "orange_money"],
      products: [
        {
          name: input.productName,
          category: "general",
          price: input.amount,
          quantity: 1,
        },
      ],
      customer: {
        name: input.customer.name,
        // Email is optional for guests; leave it out rather than send ""
        email: input.customer.email || undefined,
        phone: input.customer.phone,
      },
      success_url: input.successUrl,
      error_url: input.errorUrl,
      fees_customer_side: true,
    }),
  });

  let payload: any = null;
  let rawText = "";
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.detail ||
      rawText ||
      "Naboopay transaction request failed";
    throw new NaboopayError(response.status, String(message));
  }

  const orderId = String(payload?.order_id || "").trim();
  const checkoutUrl = String(payload?.checkout_url || "").trim();
  if (!orderId || !checkoutUrl) {
    throw new NaboopayError(502, "Invalid Naboopay response: missing order_id or checkout_url");
  }

  return {
    order_id: orderId,
    checkout_url: checkoutUrl,
    transaction_status: typeof payload?.transaction_status === "string" ? payload.transaction_status : undefined,
  };
};

export type NaboopayTransaction = {
  order_id: string;
  transaction_status: string;
  amount?: number;
  paid_at?: string;
  updated_at?: string;
};

export const getNaboopayTransaction = async (orderId: string): Promise<NaboopayTransaction> => {
  const apiKey = process.env.NABOOPAY_API_KEY;
  if (!apiKey) {
    throw new NaboopayError(500, "Naboopay is not configured");
  }
  if (!orderId) {
    throw new NaboopayError(400, "Missing Naboopay order_id");
  }

  const response = await fetch(
    `https://api.naboopay.com/api/v2/transactions/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  let payload: any = null;
  let rawText = "";
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.detail ||
      rawText ||
      "Naboopay transaction lookup failed";
    throw new NaboopayError(response.status, String(message));
  }

  const transactionStatus = String(payload?.transaction_status || "").trim();
  if (!transactionStatus) {
    throw new NaboopayError(502, "Naboopay response missing transaction_status");
  }

  return {
    order_id: String(payload?.order_id || orderId),
    transaction_status: transactionStatus,
    amount: typeof payload?.amount === "number" ? payload.amount : undefined,
    paid_at: typeof payload?.paid_at === "string" ? payload.paid_at : undefined,
    updated_at: typeof payload?.updated_at === "string" ? payload.updated_at : undefined,
  };
};

export const verifyNaboopaySignature = (
  payload: string | Record<string, unknown>,
  signature: string,
  secretKey: string,
) => {
  const rawPayload = typeof payload === "string" ? payload : JSON.stringify(payload);
  const providedRaw = signature.trim().replace(/^sha256=/i, "");
  const expectedHex = createHmac("sha256", secretKey)
    .update(rawPayload)
    .digest("hex");
  const expectedBase64 = createHmac("sha256", secretKey)
    .update(rawPayload)
    .digest("base64");

  const safeCompare = (expected: string, actual: string) => {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(actual, "utf8");
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(actualBuffer, expectedBuffer);
  };

  const providedHex = providedRaw.toLowerCase();
  return safeCompare(expectedHex, providedHex) || safeCompare(expectedBase64, providedRaw);
};

const resolveConvexUrl = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  }
  return url;
};

type ConvexFunctionType = "query" | "mutation" | "action";

const invoke = async <T>(
  type: ConvexFunctionType,
  name: string,
  args: Record<string, unknown>,
) => {
  const response = await fetch(`${resolveConvexUrl()}/api/${type}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path: name,
      args,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  // Convex puts our ConvexError message in errorData; errorMessage is only "Server Error" in production
  const errorMessage =
    payload?.errorData?.message ||
    payload?.errorMessage ||
    payload?.message ||
    (typeof payload?.error === "string" ? payload.error : undefined) ||
    `Convex ${type} failed`;
  const errorStatus = Number(payload?.errorData?.status || payload?.statusCode || 500);

  if (!response.ok) {
    throw new Error(JSON.stringify({ status: errorStatus, message: errorMessage }));
  }

  if (payload?.status === "error") {
    throw new Error(JSON.stringify({ status: errorStatus, message: errorMessage }));
  }

  if (payload && "value" in payload) {
    return payload.value as T;
  }

  return payload as T;
};

export const convexQuery = async <T>(name: string, args: Record<string, unknown>) =>
  invoke<T>("query", name, args);

export const convexMutation = async <T>(name: string, args: Record<string, unknown>) =>
  invoke<T>("mutation", name, args);

export const convexAction = async <T>(name: string, args: Record<string, unknown>) =>
  invoke<T>("action", name, args);

// Proves to Convex that a call comes from this server (see requireServer in convex/lib/guards.ts)
export const serverSecret = () => {
  const secret = process.env.CONVEX_SERVER_SECRET;
  if (!secret) {
    throw new Error("CONVEX_SERVER_SECRET is not set");
  }
  return secret;
};

import { ConvexError } from "convex/values";

const unauthorized = (message = "Unauthorized") => {
  throw new ConvexError({ status: 401, message });
};

const forbidden = (message = "Forbidden") => {
  throw new ConvexError({ status: 403, message });
};

export const getSessionUser = async (ctx: any, sessionToken?: string | null) => {
  if (!sessionToken) {
    return null;
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", sessionToken))
    .unique();

  if (!session) {
    return null;
  }

  if (session.expires_at < Date.now()) {
    await ctx.db.delete(session._id);
    return null;
  }

  const user = await ctx.db.get(session.user_id);
  return user ?? null;
};

export const getIdentityUser = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_user_id", (q: any) => q.eq("auth_user_id", identity.subject))
    .unique();

  return user ?? null;
};

export const getCurrentUser = async (ctx: any, sessionToken?: string | null) => {
  const identityUser = await getIdentityUser(ctx);
  if (identityUser) {
    return identityUser;
  }
  return getSessionUser(ctx, sessionToken);
};

export const requireUser = async (ctx: any, sessionToken?: string | null) => {
  const user = await getCurrentUser(ctx, sessionToken);
  if (!user) {
    unauthorized();
  }
  return user;
};

export const requireAdmin = async (ctx: any, sessionToken?: string | null) => {
  const user = await requireUser(ctx, sessionToken);
  if (user.role !== "admin") {
    forbidden();
  }
  return user;
};

export const requireBookingOwnerOrAdmin = async (
  ctx: any,
  booking: any,
  sessionToken?: string | null,
) => {
  const user = await requireUser(ctx, sessionToken);
  if (user.role === "admin") {
    return user;
  }
  if (!booking.user_id || booking.user_id !== user._id) {
    forbidden("You are not allowed to access this booking");
  }
  return user;
};

// For functions only our own Next.js server may call. It holds CONVEX_SERVER_SECRET (set in
// both Vercel and Convex); the public Convex URL alone is not enough to call them.
export const isServerCall = (secret?: string | null) => {
  const expected = process.env.CONVEX_SERVER_SECRET;
  return !!expected && !!secret && secret === expected;
};

export const requireServer = (secret?: string | null) => {
  if (!isServerCall(secret)) {
    forbidden("Not allowed");
  }
};

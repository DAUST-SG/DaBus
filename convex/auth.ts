import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib/guards";
import { toPublicUser } from "./lib/serializers";
import { now, sessionExpiryMs } from "./lib/time";
import {
  assertAllowedStudentEmail,
  assertRequiredText,
  assertStrongPassword,
  assertValidEmail,
  createPasswordHash,
  generateSessionToken,
  normalizeEmail,
  normalizePhone,
  sha256,
  verifyPassword,
} from "./lib/validation";

const badRequest = (message: string) => {
  throw new ConvexError({ status: 400, message });
};

const forbidden = (message: string) => {
  throw new ConvexError({ status: 403, message });
};

const unauthorized = (message: string) => {
  throw new ConvexError({ status: 401, message });
};

const MAGIC_LINK_TTL_MS = 1000 * 60 * 20;

const formatStudentName = (email: string) => {
  const localPart = email.split("@")[0] || "student";
  const words = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "Student";
  }

  return words
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    full_name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const email = normalizeEmail(args.email);
      assertValidEmail(email);
      assertStrongPassword(args.password);
      assertRequiredText(args.full_name, "Full name");
      assertRequiredText(args.phone, "Phone");

      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!adminEmail || email !== adminEmail) {
        forbidden("Password registration is restricted to admin accounts");
      }

      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();

      if (existing) {
        badRequest("An account with this email already exists");
      }

      const passwordHash = await createPasswordHash(args.password);
      const timestamp = now();

      const userId = await ctx.db.insert("users", {
        email,
        full_name: args.full_name.trim(),
        phone: normalizePhone(args.phone),
        role: "admin",
        password_hash: passwordHash,
        created_at: timestamp,
        updated_at: timestamp,
      });

      const token = generateSessionToken();
      await ctx.db.insert("sessions", {
        token,
        user_id: userId,
        expires_at: sessionExpiryMs(),
        created_at: timestamp,
      });

      const user = await ctx.db.get(userId);
      return {
        token,
        user: toPublicUser(user),
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      badRequest(error instanceof Error ? error.message : "Registration failed");
    }
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();

    if (user?.role && user.role !== "admin") {
      forbidden("Students must sign in with a magic link");
    }

    if (!user?.password_hash) {
      unauthorized("Invalid email or password");
    }

    const valid = await verifyPassword(args.password, user.password_hash);
    if (!valid) {
      unauthorized("Invalid email or password");
    }

    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      token,
      user_id: user._id,
      expires_at: sessionExpiryMs(),
      created_at: now(),
    });

    return {
      token,
      user: toPublicUser(user),
    };
  },
});

export const requestStudentMagicLink = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const email = normalizeEmail(args.email);
      assertValidEmail(email);
      assertAllowedStudentEmail(email);

      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (existingUser?.role === "admin") {
        forbidden("Admins must sign in with password");
      }

      const existingLinks = await ctx.db
        .query("magic_links")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .collect();
      await Promise.all(existingLinks.map((link: any) => ctx.db.delete(link._id)));

      const token = generateSessionToken();
      const timestamp = now();
      await ctx.db.insert("magic_links", {
        email,
        token_hash: await sha256(token),
        expires_at: timestamp + MAGIC_LINK_TTL_MS,
        created_at: timestamp,
      });

      return {
        email,
        token,
        expires_at: timestamp + MAGIC_LINK_TTL_MS,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      badRequest(error instanceof Error ? error.message : "Failed to request magic link");
    }
  },
});

export const consumeStudentMagicLink = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const rawToken = args.token.trim();
      if (!rawToken) {
        unauthorized("Invalid or expired magic link");
      }

      const tokenHash = await sha256(rawToken);
      const link = await ctx.db
        .query("magic_links")
        .withIndex("by_token_hash", (q: any) => q.eq("token_hash", tokenHash))
        .unique();

      if (!link || link.used_at) {
        unauthorized("Invalid or expired magic link");
      }

      const timestamp = now();
      if (link.expires_at < timestamp) {
        await ctx.db.delete(link._id);
        unauthorized("Invalid or expired magic link");
      }

      const email = normalizeEmail(link.email);
      assertAllowedStudentEmail(email);

      let user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();

      if (user?.role === "admin") {
        forbidden("Admins must sign in with password");
      }

      if (!user) {
        const userId = await ctx.db.insert("users", {
          email,
          full_name: formatStudentName(email),
          phone: "",
          role: "student",
          created_at: timestamp,
          updated_at: timestamp,
        });
        user = await ctx.db.get(userId);
      }

      await ctx.db.patch(link._id, {
        used_at: timestamp,
      });

      const token = generateSessionToken();
      await ctx.db.insert("sessions", {
        token,
        user_id: user._id,
        expires_at: sessionExpiryMs(),
        created_at: timestamp,
      });

      return {
        token,
        user: toPublicUser(user),
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      unauthorized("Invalid or expired magic link");
    }
  },
});

export const me = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    return toPublicUser(user);
  },
});

export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.sessionToken))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});

export const bootstrapIdentityUser = mutation({
  args: {
    full_name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new ConvexError({ status: 401, message: "Unauthorized" });
    }

    const email = normalizeEmail(identity.email ?? "");
    if (!email) {
      throw new ConvexError({ status: 400, message: "Identity email is required" });
    }

    const byAuthId = await ctx.db
      .query("users")
      .withIndex("by_auth_user_id", (q: any) => q.eq("auth_user_id", identity.subject))
      .unique();

    if (byAuthId) {
      return toPublicUser(byAuthId);
    }

    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();

    if (byEmail) {
      await ctx.db.patch(byEmail._id, {
        auth_user_id: identity.subject,
        updated_at: now(),
      });
      const linked = await ctx.db.get(byEmail._id);
      return toPublicUser(linked);
    }

    try {
      assertAllowedStudentEmail(email);
    } catch (error) {
      badRequest(error instanceof Error ? error.message : "Invalid student email");
    }

    const timestamp = now();
    const userId = await ctx.db.insert("users", {
      auth_user_id: identity.subject,
      email,
      full_name: args.full_name?.trim() || identity.name || "Student",
      phone: normalizePhone(args.phone ?? ""),
      role: "student",
      created_at: timestamp,
      updated_at: timestamp,
    });

    const user = await ctx.db.get(userId);
    return toPublicUser(user);
  },
});

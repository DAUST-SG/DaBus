import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { requireAdmin, requireServer } from "./lib/guards";
import { assertValidEmail, normalizeEmail } from "./lib/validation";
import { now } from "./lib/time";
import { getSettings } from "./settings";
import { sendReport } from "./minSeats";

// Failures nobody would otherwise see. Each one is kept for the admin list
// (Settings → Alerts) and emailed, at most once per kind per hour so an outage
// doesn't flood anyone's inbox.

const KINDS = {
  payment: "Naboopay checkout failed",
  webhook: "Naboopay payment notice failed",
  refund: "Refund failed",
  ledger: "DaLedger report failed",
  email: "Email not sent",
  min_seats: "Minimum seats check failed",
} as const;
export type ProblemKind = keyof typeof KINDS;
const kind = v.union(...(Object.keys(KINDS) as ProblemKind[]).map((k) => v.literal(k)));

const HOUR = 3_600_000;
const KEEP = 30 * 24 * HOUR;

// Call inside a mutation; from an action use internal.problems.report
export const recordProblem = async (ctx: any, kind: ProblemKind, message: string) => {
  // ponytail: scans this kind's rows from the last hour; fine unless one kind fails thousands of times an hour
  const lastAlert = await ctx.db
    .query("problems")
    .withIndex("by_kind", (q: any) => q.eq("kind", kind).gt("created_at", now() - HOUR))
    .filter((q: any) => q.eq(q.field("alerted"), true))
    .first();
  const alerted = !lastAlert;
  await ctx.db.insert("problems", { kind, message: message.slice(0, 1000), alerted, created_at: now() });
  if (alerted) await ctx.scheduler.runAfter(0, internal.problems.alert, { kind, message });

  const old = await ctx.db.query("problems").withIndex("by_created_at", (q: any) => q.lt("created_at", now() - KEEP)).take(20);
  for (const row of old) await ctx.db.delete(row._id);
};

export const report = internalMutation({
  args: { kind, message: v.string() },
  handler: async (ctx, args) => recordProblem(ctx, args.kind, args.message),
});

// For the Next.js API routes (Naboopay checkout, webhook, student refunds)
export const reportFromServer = mutation({
  args: { serverSecret: v.string(), kind, message: v.string() },
  handler: async (ctx, args) => {
    requireServer(args.serverSecret);
    await recordProblem(ctx, args.kind, args.message);
  },
});

export const recipients = internalQuery({
  args: {},
  handler: async (ctx) => {
    const listed = ((await getSettings(ctx)) as { alert_emails?: string }).alert_emails;
    if (listed) return listed.split(",").map((e) => e.trim()).filter(Boolean);
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u.role === "admin").map((u) => u.email);
  },
});

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const alert = internalAction({
  args: { kind, message: v.string() },
  handler: async (ctx, args) => {
    const to: string[] = await ctx.runQuery(internal.problems.recipients, {});
    const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
    await sendReport(
      `DaBus problem: ${KINDS[args.kind]}`,
      `<p><strong>${KINDS[args.kind]}</strong></p>
       <p style="font-family:monospace;white-space:pre-wrap">${escapeHtml(args.message)}</p>
       <p>More problems of this kind in the next hour are listed but not emailed.${
         base ? ` See them in <a href="${base}/admin">Admin → Settings → Alerts</a>.` : ""
       }</p>`,
      to,
    );
  },
});

// Admin → Settings → Alerts
export const recent = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await ctx.db.query("problems").withIndex("by_created_at").order("desc").take(50);
    return {
      alert_emails: ((await getSettings(ctx)) as { alert_emails?: string }).alert_emails || "",
      problems: rows.map((p) => ({
        id: p._id,
        kind: p.kind,
        label: KINDS[p.kind as ProblemKind] || p.kind,
        message: p.message,
        alerted: p.alerted,
        created_at: new Date(p.created_at).toISOString(),
      })),
    };
  },
});

export const setAlertEmails = mutation({
  args: { sessionToken: v.optional(v.string()), alert_emails: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const emails = args.alert_emails.split(/[,\s;]+/).map(normalizeEmail).filter(Boolean);
    for (const email of emails) {
      try {
        assertValidEmail(email);
      } catch {
        throw new ConvexError({ status: 400, message: `Not an email address: ${email}` });
      }
    }
    const alert_emails = [...new Set(emails)].join(", ");
    const row = await ctx.db.query("settings").first();
    if (row) await ctx.db.patch(row._id, { alert_emails, updated_at: now() });
    else await ctx.db.insert("settings", { ...(await getSettings(ctx)), alert_emails, updated_at: now() });
    return { alert_emails };
  },
});

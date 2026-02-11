import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/guards";
import { toPublicUser } from "./lib/serializers";

export const me = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    return toPublicUser(user);
  },
});

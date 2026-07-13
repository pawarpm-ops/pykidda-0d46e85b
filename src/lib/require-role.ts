// Server-only role guard. Import inside a createServerFn handler that already
// runs `requireSupabaseAuth`, then call with the request context.
//
//   import { requireRole } from "@/lib/require-role";
//   ...handler(async ({ context }) => {
//     await requireRole(context, ["admin", "super_admin"]);
//   })
//
// Throws a plain, non-leaky error if the caller is not authorized.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "student" | "teacher" | "admin" | "super_admin";

export type RoleGuardContext = {
  supabase: SupabaseClient;
  userId: string;
};

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireRole(
  ctx: RoleGuardContext,
  allowed: AppRole[],
): Promise<AppRole> {
  if (!ctx.userId) throw new ForbiddenError("Not authenticated");

  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);

  if (error) throw new ForbiddenError();

  const roles = ((data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
  const match = roles.find((r) => allowed.includes(r));
  if (!match) throw new ForbiddenError();
  return match;
}

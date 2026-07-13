import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, ForbiddenError, type AppRole } from "@/lib/require-role";

const ROLES: AppRole[] = ["student", "teacher", "admin", "super_admin"];

type AssignInput = {
  targetUserId: string;
  role: AppRole;
  action: "grant" | "revoke";
};

function validate(input: unknown): AssignInput {
  const v = input as Partial<AssignInput> | null;
  if (!v || typeof v.targetUserId !== "string" || v.targetUserId.length < 8) {
    throw new ForbiddenError("Invalid target user");
  }
  if (!ROLES.includes(v.role as AppRole)) {
    throw new ForbiddenError("Invalid role");
  }
  if (v.action !== "grant" && v.action !== "revoke") {
    throw new ForbiddenError("Invalid action");
  }
  return v as AssignInput;
}

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    // Extra defense in depth: verify caller is super_admin server-side before
    // even calling the RPC (the RPC also enforces this).
    await requireRole(context, ["super_admin"]);

    const { error } = await context.supabase.rpc("assign_user_role", {
      _target_user: data.targetUserId,
      _role: data.role,
      _action: data.action,
    });
    if (error) {
      // Never leak raw DB errors to the client
      throw new ForbiddenError(
        error.message.includes("last super_admin")
          ? "Cannot revoke the last super_admin"
          : "You do not have permission to perform this action",
      );
    }
    return { ok: true as const };
  });

export const listUserRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["admin", "super_admin"]);
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role, created_at");
    if (error) throw new ForbiddenError();
    return data ?? [];
  });

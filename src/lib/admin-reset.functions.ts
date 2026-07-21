// Admin-only server function that resets all student activity data feeding
// the teacher dashboard. Delegates the actual delete to a SECURITY DEFINER
// database function that re-checks the admin role.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetTeacherDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("reset_teacher_dashboard_data");
    if (error) throw new Error(error.message);
    return data as { ok: boolean; cleared: Record<string, number> };
  });

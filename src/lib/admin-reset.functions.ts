// Server function to reset all student activity data visible on the teacher
// dashboard. Admin-only. Verifies caller role under RLS before switching to
// the admin client for the actual deletes.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetTeacherDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Authorize as admin using the caller's RLS-scoped client.
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Wipe activity/scoring tables that feed the dashboard. Profiles,
    // homework, questions and users are intentionally preserved.
    const tables = [
      "mock_results",
      "streak_activity_logs",
      "student_streaks",
      "leaderboard_scores",
      "student_badges",
      "admin_activity_logs",
    ] as const;

    const counts: Record<string, number> = {};
    for (const t of tables) {
      // Use an always-true filter so PostgREST performs a real DELETE.
      const { error, count } = await supabaseAdmin
        .from(t)
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`Failed to clear ${t}: ${error.message}`);
      counts[t] = count ?? 0;
    }

    return { ok: true, cleared: counts };
  });

// Server-side leaderboard sync. Ranking is based on the student's SCHEDULED
// mock-test scores only — not normal mock tests, practice questions, or
// homework. The score is computed server-side from the source-of-truth
// ai_mock_attempts / ai_mock_tests tables via the admin client (client-side
// writes to leaderboard_scores are forbidden by RLS so the computed score
// cannot be tampered with).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncMyScoreServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull this user's attempts that belong to a scheduled ai_mock_test.
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("percentage, test_id, ai_mock_tests!inner(test_kind)")
      .eq("user_id", userId)
      .eq("ai_mock_tests.test_kind", "scheduled");
    if (aErr) throw new Error(aErr.message);

    const rows = (attempts ?? []) as Array<{ percentage: number | null; test_id: string }>;
    const bestByTest = new Map<string, number>();
    for (const r of rows) {
      const pct = r.percentage ?? 0;
      const cur = bestByTest.get(r.test_id) ?? 0;
      if (pct > cur) bestByTest.set(r.test_id, pct);
    }
    // Score = sum of best percentage per scheduled test attempted.
    // (This rewards attempting more scheduled tests AND scoring higher.)
    let score = 0;
    let mockBest = 0;
    for (const pct of bestByTest.values()) {
      score += pct;
      if (pct > mockBest) mockBest = pct;
    }
    const mocksTaken = bestByTest.size;

    // Display name from the JWT claims (server-trusted).
    const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
    const email = (claims?.email as string | undefined) ?? "";
    const displayName =
      (meta?.full_name as string | undefined) ??
      (meta?.name as string | undefined) ??
      email.split("@")[0] ??
      "Anonymous";
    const avatarUrl = (meta?.avatar_url as string | undefined) ?? null;

    const { error: upErr } = await supabaseAdmin.from("leaderboard_scores").upsert(
      {
        user_id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        score,
        solved_count: mocksTaken,
        mock_best: mockBest,
        mocks_taken: mocksTaken,
      },
      { onConflict: "user_id" },
    );
    if (upErr) throw new Error(upErr.message);

    return { score, solvedCount: mocksTaken, mockBest, mocksTaken };
  });

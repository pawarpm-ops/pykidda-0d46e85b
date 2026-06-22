// Server-side leaderboard sync. Computes the user's score from the
// source-of-truth DB tables (practice_attempts, mock_results) — never from
// client-supplied values — and writes it to leaderboard_scores via the
// admin client (client-side writes to leaderboard_scores are forbidden
// by RLS so the computed score cannot be tampered with).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUESTIONS } from "./questions";

export const syncMyScoreServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    // Read user's own attempts via RLS-scoped client (owner-only).
    const [{ data: practice, error: pErr }, { data: mocks, error: mErr }] = await Promise.all([
      supabase.from("practice_attempts").select("question_id,solved").eq("user_id", userId),
      supabase.from("mock_results").select("percentage").eq("user_id", userId),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (mErr) throw new Error(mErr.message);

    const solvedIds = new Set<string>();
    for (const a of practice ?? []) if (a.solved) solvedIds.add(a.question_id);

    let practiceScore = 0;
    for (const id of solvedIds) {
      const q = QUESTIONS.find((x) => x.id === id);
      if (q) practiceScore += q.marks;
    }
    const mockBest = (mocks ?? []).length ? Math.max(...(mocks ?? []).map((m) => m.percentage)) : 0;
    const mockBonus = Math.round(mockBest / 5);
    const score = practiceScore + mockBonus;

    // Display name from the JWT claims (server-trusted).
    const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
    const email = (claims?.email as string | undefined) ?? "";
    const displayName =
      (meta?.full_name as string | undefined) ??
      (meta?.name as string | undefined) ??
      email.split("@")[0] ??
      "Anonymous";
    const avatarUrl = (meta?.avatar_url as string | undefined) ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("leaderboard_scores").upsert(
      {
        user_id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        score,
        solved_count: solvedIds.size,
        mock_best: mockBest,
        mocks_taken: (mocks ?? []).length,
      },
      { onConflict: "user_id" },
    );
    if (upErr) throw new Error(upErr.message);

    return { score, solvedCount: solvedIds.size, mockBest, mocksTaken: (mocks ?? []).length };
  });

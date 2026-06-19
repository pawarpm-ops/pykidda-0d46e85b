// Leaderboard sync + queries. Computes a user's total score from local progress
// and upserts it into the public.leaderboard_scores table.
import { supabase } from "@/integrations/supabase/client";
import { QUESTIONS } from "./questions";
import { getProgress } from "./progress";

export type LeaderboardRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
  solved_count: number;
  mock_best: number;
  mocks_taken: number;
  updated_at: string;
};

/**
 * Compute total score: sum of `marks` for each uniquely-solved practice question
 * + bonus = round((mock_best / 5)) so a perfect mock gives +20 bonus.
 */
export function computeMyScore(userId: string) {
  const s = getProgress(userId);
  const solvedIds = new Set<string>();
  for (const a of s.practice) if (a.solved) solvedIds.add(a.questionId);

  let practiceScore = 0;
  for (const id of solvedIds) {
    const q = QUESTIONS.find((x) => x.id === id);
    if (q) practiceScore += q.marks;
  }
  const mockBest = s.mocks.length ? Math.max(...s.mocks.map((m) => m.percentage)) : 0;
  const mockBonus = Math.round(mockBest / 5);
  return {
    score: practiceScore + mockBonus,
    solvedCount: solvedIds.size,
    mockBest,
    mocksTaken: s.mocks.length,
  };
}

export async function syncMyScore() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return;

  const { score, solvedCount, mockBest, mocksTaken } = computeMyScore(user.id);

  // Display name: profile.display_name → user_metadata → email prefix
  const meta = user.user_metadata as Record<string, unknown> | null;
  const displayName =
    (meta?.full_name as string | undefined) ??
    (meta?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Anonymous";
  const avatarUrl = (meta?.avatar_url as string | undefined) ?? null;

  await supabase
    .from("leaderboard_scores")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        score,
        solved_count: solvedCount,
        mock_best: mockBest,
        mocks_taken: mocksTaken,
      },
      { onConflict: "user_id" },
    );
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard_scores")
    .select("*")
    .order("score", { ascending: false })
    .order("solved_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

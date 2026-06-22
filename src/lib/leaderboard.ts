// Leaderboard queries. Score writes are performed server-side via
// `syncMyScoreServer` (src/lib/leaderboard.functions.ts) so users cannot
// fabricate their own score by calling the Data API directly.
import { supabase } from "@/integrations/supabase/client";
import { syncMyScoreServer } from "./leaderboard.functions";

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

export async function syncMyScore() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session?.user) return;
  try {
    await syncMyScoreServer();
  } catch (e) {
    // Non-fatal: leaderboard sync failures shouldn't block the UI.
    console.error("syncMyScore failed", e);
  }
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

import { supabase } from "@/integrations/supabase/client";

export type StreakActivityType =
  | "login"
  | "practice_question_solved"
  | "practice_set_completed"
  | "mock_test_attempted"
  | "coding_question_solved"
  | "daily_challenge_completed";

export type StreakRank = {
  days: number;
  name: string;
  icon: string;
  color: string; // gradient css
  glow: string;
};

export const STREAK_RANKS: StreakRank[] = [
  { days: 1, name: "Python Starter", icon: "🐣", color: "linear-gradient(135deg,#38bdf8,#22d3ee)", glow: "#22d3ee" },
  { days: 3, name: "Code Spark", icon: "✨", color: "linear-gradient(135deg,#fde047,#f59e0b)", glow: "#f59e0b" },
  { days: 5, name: "Syntax Explorer", icon: "🧭", color: "linear-gradient(135deg,#a78bfa,#7c3aed)", glow: "#7c3aed" },
  { days: 7, name: "Python Learner", icon: "📘", color: "linear-gradient(135deg,#34d399,#059669)", glow: "#10b981" },
  { days: 10, name: "Logic Builder", icon: "🧠", color: "linear-gradient(135deg,#f472b6,#db2777)", glow: "#ec4899" },
  { days: 15, name: "Code Ninja", icon: "🥷", color: "linear-gradient(135deg,#64748b,#0f172a)", glow: "#334155" },
  { days: 21, name: "Python Warrior", icon: "⚔️", color: "linear-gradient(135deg,#f97316,#dc2626)", glow: "#f97316" },
  { days: 30, name: "Debug Master", icon: "🔧", color: "linear-gradient(135deg,#22d3ee,#3b82f6)", glow: "#3b82f6" },
  { days: 45, name: "Algorithm Ace", icon: "🎯", color: "linear-gradient(135deg,#c084fc,#9333ea)", glow: "#a855f7" },
  { days: 60, name: "Python Champion", icon: "🏆", color: "linear-gradient(135deg,#facc15,#f59e0b)", glow: "#eab308" },
  { days: 90, name: "Coding Legend", icon: "🐉", color: "linear-gradient(135deg,#f43f5e,#7c3aed)", glow: "#e11d48" },
  { days: 120, name: "Python Wizard", icon: "🧙", color: "linear-gradient(135deg,#818cf8,#4338ca)", glow: "#6366f1" },
  { days: 180, name: "Streak King", icon: "👑", color: "linear-gradient(135deg,#fde047,#f97316)", glow: "#facc15" },
  { days: 365, name: "Python Immortal", icon: "🌟", color: "linear-gradient(135deg,#fbbf24,#ef4444,#8b5cf6)", glow: "#f59e0b" },
];

export function getCurrentRank(streak: number): StreakRank {
  let current = { days: 0, name: "Just Starting", icon: "🌱", color: "linear-gradient(135deg,#94a3b8,#475569)", glow: "#64748b" };
  for (const r of STREAK_RANKS) {
    if (streak >= r.days) current = r;
  }
  return current;
}

export function getNextRank(streak: number): StreakRank | null {
  return STREAK_RANKS.find((r) => r.days > streak) ?? null;
}

export type StreakState = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  today_completed: boolean;
};

export async function fetchMyStreak(): Promise<StreakState | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("student_streaks")
    .select("current_streak, longest_streak, last_activity_date, today_completed")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!data) return { current_streak: 0, longest_streak: 0, last_activity_date: null, today_completed: false };
  return data;
}

export async function recordStreakActivity(
  activity: StreakActivityType,
  referenceId?: string,
): Promise<{ current_streak: number; longest_streak: number; is_new_day: boolean; unlocked_rank: StreakRank | null } | null> {
  const { data, error } = await supabase.rpc("record_streak_activity", {
    _activity_type: activity,
    _reference_id: referenceId,
  });
  if (error || !data || !data[0]) return null;
  const row = data[0] as { current_streak: number; longest_streak: number; today_completed: boolean; is_new_day: boolean };
  const prevRank = getCurrentRank(row.current_streak - (row.is_new_day ? 1 : 0));
  const currRank = getCurrentRank(row.current_streak);
  const unlocked = row.is_new_day && currRank.name !== prevRank.name && currRank.days > 0 ? currRank : null;
  // dispatch UI event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pk:streak-updated", {
        detail: { ...row, unlocked_rank: unlocked },
      }),
    );
  }
  return { current_streak: row.current_streak, longest_streak: row.longest_streak, is_new_day: row.is_new_day, unlocked_rank: unlocked };
}

export async function fetchMyStreakLogs(days = 120): Promise<Array<{ activity_date: string }>> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("streak_activity_logs")
    .select("activity_date")
    .eq("user_id", u.user.id)
    .gte("activity_date", since.toISOString().slice(0, 10))
    .order("activity_date", { ascending: false });
  return data ?? [];
}

export type StreakLeaderRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

export async function fetchStreakLeaderboard(limit = 50): Promise<StreakLeaderRow[]> {
  const { data: streaks } = await supabase
    .from("student_streaks")
    .select("user_id, current_streak, longest_streak, last_activity_date")
    .order("current_streak", { ascending: false })
    .order("longest_streak", { ascending: false })
    .limit(limit);
  if (!streaks || streaks.length === 0) return [];
  const ids = streaks.map((s) => s.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  return streaks.map((s) => ({
    user_id: s.user_id,
    current_streak: s.current_streak,
    longest_streak: s.longest_streak,
    last_activity_date: s.last_activity_date,
    display_name: map.get(s.user_id)?.display_name ?? null,
    avatar_url: map.get(s.user_id)?.avatar_url ?? null,
  }));
}

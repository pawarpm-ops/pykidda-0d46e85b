import { supabase } from "@/integrations/supabase/client";

export type BadgeCategory =
  | "getting_started"
  | "consistency"
  | "practice"
  | "debugging"
  | "homework"
  | "mock"
  | "exploration";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "legendary";
export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type BadgeProgress = {
  badge_key: string;
  badge_name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  rarity: BadgeRarity;
  is_secret: boolean;
  target_value: number | null;
  motivational_message: string | null;
  unlock_hint: string | null;
  sort_order: number;
  current_value: number;
  progress_pct: number;
  earned: boolean;
  earned_at: string | null;
};

export type NextBadgeTarget = {
  badge_key: string;
  badge_name: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  target_value: number;
  current_value: number;
  progress_pct: number;
  unlock_hint: string | null;
  motivational_message: string | null;
};

export type AwardedBadge = {
  badge_key: string;
  badge_name: string;
  description: string;
  icon: string;
  earned_at: string;
};

/** Ask the server to (re-)evaluate badges and award new ones. */
export async function evaluateAndAwardBadges(eventType?: string): Promise<AwardedBadge[]> {
  const { data, error } = await supabase.rpc("evaluate_and_award_badges", {
    _event_type: eventType ?? (null as unknown as string),
  });
  if (error) {
    console.warn("[badges] evaluate failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as AwardedBadge[];
  if (rows.length > 0 && typeof window !== "undefined") {
    for (const b of rows) {
      window.dispatchEvent(new CustomEvent("pk:badge-earned", { detail: b }));
    }
  }
  return rows;
}

export async function getBadgeProgress(userId?: string): Promise<BadgeProgress[]> {
  const { data, error } = await supabase.rpc("get_badge_progress", {
    _user_id: userId ?? (null as unknown as string),
  });
  if (error) {
    console.warn("[badges] progress failed:", error.message);
    return [];
  }
  return (data ?? []) as BadgeProgress[];
}

export async function getNextBadgeTargets(limit = 3): Promise<NextBadgeTarget[]> {
  const { data, error } = await supabase.rpc("get_next_badge_targets", { _limit: limit });
  if (error) {
    console.warn("[badges] next targets failed:", error.message);
    return [];
  }
  return (data ?? []) as NextBadgeTarget[];
}

export type AdminBadgeOverview = {
  total_students: number;
  most_earned: Array<{
    badge_key: string;
    badge_name: string;
    icon: string;
    tier: BadgeTier;
    category: BadgeCategory;
    earned_count: number;
  }>;
  rarest: Array<{
    badge_key: string;
    badge_name: string;
    icon: string;
    tier: BadgeTier;
    category: BadgeCategory;
    earned_count: number;
  }>;
  recent: Array<{
    badge_key: string;
    badge_name: string;
    icon: string;
    tier: BadgeTier;
    earned_at: string;
    student_name: string;
  }>;
};

export async function getAdminBadgeOverview(): Promise<AdminBadgeOverview | null> {
  const { data, error } = await supabase.rpc("admin_badge_overview");
  if (error) {
    console.warn("[badges] admin overview failed:", error.message);
    return null;
  }
  return (data ?? null) as AdminBadgeOverview | null;
}

// -------- Presentation helpers --------

export const TIER_STYLES: Record<BadgeTier, { ring: string; gradient: string; text: string; label: string }> = {
  bronze:    { ring: "ring-amber-700/40",  gradient: "from-amber-700 via-amber-500 to-yellow-600", text: "text-amber-900 dark:text-amber-200", label: "Bronze" },
  silver:    { ring: "ring-slate-400/40",  gradient: "from-slate-400 via-zinc-200 to-slate-500",   text: "text-slate-700 dark:text-slate-200", label: "Silver" },
  gold:      { ring: "ring-yellow-500/50", gradient: "from-yellow-500 via-amber-300 to-orange-500",text: "text-amber-800 dark:text-amber-200", label: "Gold" },
  platinum:  { ring: "ring-cyan-400/50",   gradient: "from-cyan-300 via-sky-200 to-indigo-400",    text: "text-sky-800 dark:text-sky-200",     label: "Platinum" },
  legendary: { ring: "ring-fuchsia-500/60",gradient: "from-fuchsia-600 via-pink-500 to-amber-400", text: "text-fuchsia-800 dark:text-fuchsia-200", label: "Legendary" },
};

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary",
};

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  getting_started: "Getting Started",
  consistency:     "Consistency",
  practice:        "Practice Mastery",
  debugging:       "Debugging & Growth",
  homework:        "Homework",
  mock:            "Mock Tests",
  exploration:     "Exploration",
};

// legacy shape kept for backwards compatibility
export type BadgeRow = {
  badge_key: string;
  badge_name: string;
  description: string;
  icon: string;
  rule_type: string;
  threshold: number | null;
  sort_order: number;
  earned: boolean;
  earned_at: string | null;
};

export async function listBadgesForStudent(studentId: string): Promise<BadgeRow[]> {
  const { data, error } = await supabase.rpc("list_badges_for_student", { _student_id: studentId });
  if (error) { console.warn("[badges] list failed:", error.message); return []; }
  return (data ?? []) as BadgeRow[];
}

export async function listMyBadges(): Promise<BadgeRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  return listBadgesForStudent(u.user.id);
}

import { supabase } from "@/integrations/supabase/client";

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

export type AwardedBadge = {
  badge_key: string;
  badge_name: string;
  description: string;
  icon: string;
  earned_at: string;
};

/**
 * Ask the server to (re-)evaluate badge rules against real DB state
 * and award any newly-earned badges. Returns freshly awarded rows.
 */
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

export async function listBadgesForStudent(studentId: string): Promise<BadgeRow[]> {
  const { data, error } = await supabase.rpc("list_badges_for_student", {
    _student_id: studentId,
  });
  if (error) {
    console.warn("[badges] list failed:", error.message);
    return [];
  }
  return (data ?? []) as BadgeRow[];
}

export async function listMyBadges(): Promise<BadgeRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  return listBadgesForStudent(u.user.id);
}

import { supabase } from "@/integrations/supabase/client";

export type PublicProfileSettings = {
  showAvatar: boolean;
  showClass: boolean;
  showStreak: boolean;
  showBadges: boolean;
  showCertificates: boolean;
  showLeaderboardRank: boolean;
  showCompletedUnits: boolean;
};

export const DEFAULT_PUBLIC_SETTINGS: PublicProfileSettings = {
  showAvatar: true,
  showClass: false,
  showStreak: true,
  showBadges: true,
  showCertificates: false,
  showLeaderboardRank: true,
  showCompletedUnits: true,
};

export type PublicProfilePayload = {
  public_profile_id: string;
  student_unique_id?: string | null;
  display_name: string;
  bio?: string | null;
  settings: PublicProfileSettings;
  joined_at: string;
  avatar_url?: string | null;
  college_name?: string | null;
  current_streak?: number;
  longest_streak?: number;
  leaderboard_rank?: number | null;
  leaderboard_score?: number;
  units_completed?: number[];
  practice_solved?: number;
  mocks_taken?: number;
  mock_best?: number;
  badges?: {
    streak_7: boolean;
    streak_30: boolean;
    solver_10: boolean;
    solver_25: boolean;
    mock_ace: boolean;
  };
};

export async function fetchPublicProfile(publicId: string): Promise<PublicProfilePayload | null> {
  const { data, error } = await supabase.rpc("get_public_student_profile", { _public_id: publicId });
  if (error) throw error;
  return (data as PublicProfilePayload | null) ?? null;
}

export function publicProfileUrl(publicId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/u/${publicId}`;
  }
  return `/u/${publicId}`;
}

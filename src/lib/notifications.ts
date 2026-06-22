// Announcements + per-user unread tracking.
import { supabase } from "@/integrations/supabase/client";

export type Announcement = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high";
  target_user_id: string | null;
  created_at: string;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function listReadIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.announcement_id));
}

export async function markRead(userId: string, announcementId: string) {
  await supabase.from("announcement_reads").upsert(
    { user_id: userId, announcement_id: announcementId },
    { onConflict: "announcement_id,user_id" },
  );
}

export async function markAllRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  await supabase
    .from("announcement_reads")
    .upsert(
      ids.map((announcement_id) => ({ user_id: userId, announcement_id })),
      { onConflict: "announcement_id,user_id" },
    );
}

export async function createAnnouncement(input: {
  authorId: string;
  title: string;
  body: string;
  priority?: "low" | "normal" | "high";
  targetUserId?: string | null;
}) {
  const { error } = await supabase.from("announcements").insert({
    author_id: input.authorId,
    title: input.title,
    body: input.body,
    priority: input.priority ?? "normal",
    target_user_id: input.targetUserId ?? null,
  });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

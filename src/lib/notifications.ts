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
  scheduled_at: string | null;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function listReadIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .is("dismissed_at", null);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.announcement_id));
}

export async function listDismissedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .not("dismissed_at", "is", null);
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

export async function dismissAnnouncement(userId: string, announcementId: string) {
  const { error } = await supabase.from("announcement_reads").upsert(
    { user_id: userId, announcement_id: announcementId, dismissed_at: new Date().toISOString() },
    { onConflict: "announcement_id,user_id" },
  );
  if (error) throw error;
}

export async function dismissAllAnnouncements(userId: string, ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert(
      ids.map((announcement_id) => ({ user_id: userId, announcement_id, dismissed_at: now })),
      { onConflict: "announcement_id,user_id" },
    );
  if (error) throw error;
}

export async function createAnnouncement(input: {
  authorId: string;
  title: string;
  body: string;
  priority?: "low" | "normal" | "high";
  targetUserId?: string | null;
  scheduledAt?: string | null;
}) {
  const { error } = await supabase.from("announcements").insert({
    author_id: input.authorId,
    title: input.title,
    body: input.body,
    priority: input.priority ?? "normal",
    target_user_id: input.targetUserId ?? null,
    scheduled_at: input.scheduledAt ?? null,
  } as never);
  if (error) throw error;
}


export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

// Threaded replies under a mock_test_attempt_comments row.
// Both admin (as teacher) and the student can reply. RLS gates who can read/write.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReplyRow = {
  id: string;
  comment_id: string;
  author_id: string;
  author_role: "teacher" | "student";
  body: string;
  created_at: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function CommentThread({
  commentId,
  currentUserId,
  viewerRole,
}: {
  commentId: string;
  currentUserId: string;
  viewerRole: "teacher" | "student";
}) {
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("mock_test_attempt_comment_replies" as never) as any)
      .select("*")
      .eq("comment_id", commentId)
      .order("created_at", { ascending: true });
    setReplies(((data ?? []) as ReplyRow[]) ?? []);
    setLoading(false);
  }, [commentId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    const body = draft.trim();
    if (!body || !currentUserId) return;
    setPosting(true);
    try {
      const { error } = await (supabase
        .from("mock_test_attempt_comment_replies" as never) as any)
        .insert({
          comment_id: commentId,
          author_id: currentUserId,
          author_role: viewerRole,
          body,
        });
      if (error) throw error;
      setDraft("");
      await load();
    } catch (e) {
      console.error("post reply", e);
      alert("Could not post reply. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Conversation
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading replies…</p>
      ) : replies.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No replies yet.</p>
      ) : (
        <ul className="space-y-2">
          {replies.map((r) => {
            const isTeacher = r.author_role === "teacher";
            return (
              <li
                key={r.id}
                className={`rounded-md border p-3 text-sm ${
                  isTeacher
                    ? "border-primary/30 bg-primary/5"
                    : "border-accent/30 bg-accent/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    {isTeacher ? "👩‍🏫 Teacher" : "🧑‍🎓 Student"}
                    {r.author_id === currentUserId ? " · you" : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmt(r.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md border border-border bg-background/40 p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={
            viewerRole === "teacher"
              ? "Reply as teacher…"
              : "Reply to your teacher…"
          }
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={post}
            disabled={posting || draft.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {posting ? "Posting…" : "Post reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

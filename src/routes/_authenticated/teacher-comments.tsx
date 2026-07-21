// Student-facing view of teacher comments on their mock test attempts.
// Read-only: teachers send comments via the admin "Add comment" button.
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_TESTS } from "@/lib/questions";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, EmptyState } from "@/components/ui/state";

export const Route = createFileRoute("/_authenticated/teacher-comments")({
  head: () => ({
    meta: [
      { title: "Teacher Comments · PyKidda" },
      {
        name: "description",
        content: "Read teacher feedback on your mock test attempts.",
      },
    ],
  }),
  component: TeacherCommentsPage,
});

type CommentRow = {
  id: string;
  attempt_kind: "normal" | "scheduled";
  attempt_id: string;
  student_id: string;
  teacher_id: string;
  test_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
};

type AiTestRow = { id: string; title: string };

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function TeacherCommentsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data } = await (supabase
        .from("mock_test_attempt_comments" as never) as any)
        .select("*")
        .eq("student_id", uid)
        .order("updated_at", { ascending: false });
      const rows = (data ?? []) as CommentRow[];
      setComments(rows);

      const aiIds = Array.from(
        new Set(rows.filter((r) => r.attempt_kind === "scheduled").map((r) => r.test_id)),
      );
      const tMap: Record<string, string> = {};
      if (aiIds.length > 0) {
        const { data: tests } = await (supabase
          .from("ai_mock_tests" as never) as any)
          .select("id,title")
          .in("id", aiIds);
        ((tests ?? []) as AiTestRow[]).forEach((t) => {
          tMap[t.id] = t.title;
        });
      }
      for (const r of rows) {
        if (r.attempt_kind === "normal") {
          const m = MOCK_TESTS.find((t) => t.id === r.test_id);
          if (m) tMap[r.test_id] = m.name;
        }
      }
      setTitles(tMap);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover-glow mb-3"
          aria-label="Go back"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-3xl font-bold">💬 Teacher Comments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feedback from your teachers on your mock test attempts.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !userId ? (
        <p className="text-sm text-muted-foreground">Please sign in.</p>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No teacher comments yet. Once a teacher adds a comment on one of your mock
            test attempts, it will show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-accent/30 bg-accent/5 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                    {c.attempt_kind === "scheduled" ? "Scheduled mock test" : "Normal mock test"}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">
                    {titles[c.test_id] ?? c.test_id}
                  </h2>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Updated {fmt(c.updated_at)}
                </span>
              </div>

              <div className="mt-3 rounded-md border border-border bg-background/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  👩‍🏫 Teacher's comment
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{c.comment_text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
    </div>
  );
}

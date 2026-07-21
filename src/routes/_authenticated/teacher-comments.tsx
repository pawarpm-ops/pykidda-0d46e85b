// Student-facing view of teacher comments on their mock test attempts.
// Read-only: teachers send comments via the admin "Add comment" button.
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquare, ExternalLink, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_TESTS } from "@/lib/questions";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state";

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
    return new Date(dt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dt;
  }
}

function relative(dt: string) {
  try {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function CommentSkeleton() {
  return (
    <li
      className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm motion-safe:animate-pulse"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-3/6 rounded bg-muted" />
      </div>
    </li>
  );
}

function TeacherCommentsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getUser();
        const uid = session.user?.id ?? null;
        if (cancelled) return;
        setUserId(uid);
        if (!uid) {
          setLoading(false);
          return;
        }
        const { data, error: err } = await (supabase
          .from("mock_test_attempt_comments" as never) as any)
          .select("*")
          .eq("student_id", uid)
          .order("updated_at", { ascending: false });
        if (err) throw err;
        const rows = (data ?? []) as CommentRow[];
        if (cancelled) return;
        setComments(rows);

        const aiIds = Array.from(
          new Set(
            rows
              .filter((r) => r.attempt_kind === "scheduled")
              .map((r) => r.test_id),
          ),
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
        if (cancelled) return;
        setTitles(tMap);
      } catch (e) {
        console.error("load teacher comments", e);
        if (!cancelled) setError("We couldn't load your teacher comments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const grouped = useMemo(() => {
    const t: CommentRow[] = [];
    const w: CommentRow[] = [];
    const older: CommentRow[] = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    for (const c of comments) {
      const diff = now - new Date(c.updated_at).getTime();
      if (diff < day) t.push(c);
      else if (diff < 7 * day) w.push(c);
      else older.push(c);
    }
    return { today: t, week: w, older };
  }, [comments]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 pb-24">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background mb-3"
            aria-label="Go back"
          >
            <ArrowLeft size={16} aria-hidden /> Back
          </button>
          <PageHeader
            eyebrow="Feedback"
            title="Teacher Comments"
            description="Feedback from your teachers on your mock test attempts."
          />
        </header>

        {loading ? (
          <ul className="space-y-4" aria-busy="true" aria-live="polite">
            <CommentSkeleton />
            <CommentSkeleton />
          </ul>
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : !userId ? (
          <LoadingState label="Checking your session…" />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" aria-hidden />}
            title="No comments yet"
            description="Once a teacher adds a comment on one of your mock test attempts, it will show up here."
          />
        ) : (
          <div className="space-y-8" aria-live="polite">
            {(
              [
                ["Today", grouped.today],
                ["This week", grouped.week],
                ["Earlier", grouped.older],
              ] as const
            ).map(([label, rows]) =>
              rows.length === 0 ? null : (
                <section key={label} aria-labelledby={`grp-${label}`}>
                  <h2
                    id={`grp-${label}`}
                    className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {label}
                  </h2>
                  <ul className="space-y-3">
                    {rows.map((c) => {
                      const title = titles[c.test_id] ?? "Mock test";
                      const kindLabel =
                        c.attempt_kind === "scheduled"
                          ? "Scheduled mock test"
                          : "Normal mock test";
                      const resultHref =
                        c.attempt_kind === "normal"
                          ? `/mock-tests/${c.test_id}/result`
                          : `/mock-tests`;
                      return (
                        <li key={c.id}>
                          <article
                            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-accent/40 focus-within:border-accent/60"
                            aria-labelledby={`c-${c.id}-title`}
                          >
                            <header className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
                                  <GraduationCap
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  />
                                  {kindLabel}
                                </p>
                                <h3
                                  id={`c-${c.id}-title`}
                                  className="mt-1 text-base font-semibold break-words"
                                >
                                  {title}
                                </h3>
                              </div>
                              <time
                                dateTime={c.updated_at}
                                title={fmt(c.updated_at)}
                                className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                              >
                                {relative(c.updated_at)}
                              </time>
                            </header>

                            <div className="mt-3 rounded-md border border-border bg-background/60 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Teacher's comment
                              </p>
                              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {c.comment_text}
                              </p>
                            </div>

                            <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">
                                Updated{" "}
                                <time dateTime={c.updated_at}>
                                  {fmt(c.updated_at)}
                                </time>
                              </span>
                              <Link
                                to={resultHref}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                aria-label={`View ${title}`}
                              >
                                View test
                                <ExternalLink
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                              </Link>
                            </footer>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}

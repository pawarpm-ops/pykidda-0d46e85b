// Teacher grading interface for scheduled mock tests.
// Lists all attempts; opens a per-attempt panel with the auto-graded answers
// preloaded, per-question mark override + teacher comment, plus an overall
// feedback field. Save keeps the draft, Publish releases marks to the student
// and updates the leaderboard.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import {
  listAttemptsForReview,
  getAttemptForGrading,
  saveGrading,
} from "@/lib/ai-mock-grading.functions";

export const Route = createFileRoute("/_authenticated/admin_/ai-mock_/$testId/grading")({
  head: () => ({
    meta: [
      { title: "Grade scheduled mock · PY Kidda Admin" },
      { name: "description", content: "Review and grade student submissions for scheduled mock tests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GradingPage,
  ssr: false,
});

type Attempt = {
  id: string;
  user_id: string;
  submitted_at: string | null;
  time_taken_sec: number | null;
  submission_type: string | null;
  violation_reason: string | null;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  grade: string | null;
  grading_status: string;
  auto_marks_obtained: number | null;
  auto_percentage: number | null;
  reviewed_at: string | null;
};

type Profile = { display_name: string | null; student_unique_id: string | null; avatar_url: string | null };

type Question = {
  id: string;
  order_index: number;
  type: string;
  prompt: string;
  options: unknown;
  correct_answer: string;
  starter_code: string | null;
  code_tests: unknown;
  marks: number;
  explanation: string | null;
};

type AttemptAnswer = {
  question_id: string;
  response: string;
  marks_awarded: number;
  marks_total: number;
  correct: boolean;
  auto_marks_awarded?: number;
  teacher_comment?: string;
  code_passed?: number | null;
  code_total?: number | null;
  correct_answer?: string;
  explanation?: string;
};

function GradingPage() {
  const { testId } = Route.useParams();
  const [test, setTest] = useState<{ id: string; title: string; total_marks: number; question_count: number } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_review" | "in_review" | "published">("pending_review");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listAttemptsForReview({ data: { test_id: testId } });
      setTest(res.test as any);
      setAttempts(res.attempts as Attempt[]);
      setProfiles(res.profiles as Record<string, Profile>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load attempts");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [testId]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return attempts;
    return attempts.filter((a) => a.grading_status === statusFilter);
  }, [attempts, statusFilter]);

  const counts = useMemo(() => ({
    pending_review: attempts.filter((a) => a.grading_status === "pending_review").length,
    in_review: attempts.filter((a) => a.grading_status === "in_review").length,
    published: attempts.filter((a) => a.grading_status === "published").length,
  }), [attempts]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Manual grading</p>
            <h1 className="mt-1 text-2xl font-bold">{test?.title ?? "Scheduled mock test"}</h1>
            {test && (
              <p className="text-xs text-muted-foreground mt-1">
                {test.question_count} questions · {test.total_marks} marks
              </p>
            )}
          </div>
          <Link to="/admin/ai-mock" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">← Back to tests</Link>
        </div>

        <div className="mt-6 flex gap-2 flex-wrap text-xs">
          {(["pending_review", "in_review", "published", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1.5 font-medium transition ${
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {s === "all" ? "All" : s === "pending_review" ? `Pending (${counts.pending_review})` : s === "in_review" ? `In review (${counts.in_review})` : `Published (${counts.published})`}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading submissions…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No submissions in this state.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((a) => {
                  const p = profiles[a.user_id];
                  const active = selectedId === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedId(a.id)}
                        className={`w-full text-left px-3 py-3 rounded-md transition ${active ? "bg-primary/10" : "hover:bg-secondary"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">{p?.display_name ?? "Student"}</span>
                          <StatusChip status={a.grading_status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {p?.student_unique_id ?? "—"} · Auto {a.auto_percentage ?? 0}%
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Submitted {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"}
                        </p>
                        {a.violation_reason && (
                          <p className="text-[11px] text-destructive mt-0.5">⚠️ {a.violation_reason}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section>
            {selectedId ? (
              <AttemptEditor
                key={selectedId}
                attemptId={selectedId}
                onPublished={() => { refresh(); }}
                onSaved={() => { refresh(); }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                Select a submission on the left to start grading.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cfg =
    status === "published"
      ? { bg: "bg-[oklch(0.65_0.16_145)]/20", text: "text-[oklch(0.45_0.16_145)]", label: "Published" }
      : status === "in_review"
        ? { bg: "bg-[oklch(0.65_0.16_85)]/20", text: "text-[oklch(0.45_0.16_85)]", label: "Draft" }
        : { bg: "bg-secondary", text: "text-muted-foreground", label: "Pending" };
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

function AttemptEditor({ attemptId, onPublished, onSaved }: { attemptId: string; onPublished: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState<null | "save" | "publish">(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getAttemptForGrading({ data: { attempt_id: attemptId } });
        setAttempt(res.attempt as Attempt);
        setQuestions(res.questions as Question[]);
        setProfile(res.profile as Profile);
        setFeedback(((res.attempt as any).teacher_feedback as string) ?? "");
        const map: Record<string, AttemptAnswer> = {};
        for (const a of ((res.attempt as any).answers as AttemptAnswer[]) ?? []) {
          map[a.question_id] = { ...a, teacher_comment: a.teacher_comment ?? "" };
        }
        setAnswers(map);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load attempt");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  const totals = useMemo(() => {
    let total = 0;
    let awarded = 0;
    for (const q of questions) {
      total += q.marks;
      const a = answers[q.id];
      awarded += Math.max(0, Math.min(q.marks, a?.marks_awarded ?? 0));
    }
    return { awarded, total, pct: total > 0 ? Math.round((awarded / total) * 100) : 0 };
  }, [answers, questions]);

  const save = async (publish: boolean) => {
    setSaving(publish ? "publish" : "save");
    try {
      const per_question = questions.map((q) => ({
        question_id: q.id,
        marks_awarded: Math.max(0, Math.min(q.marks, Number(answers[q.id]?.marks_awarded ?? 0))),
        teacher_comment: answers[q.id]?.teacher_comment ?? "",
      }));
      const res = await saveGrading({
        data: { attempt_id: attemptId, per_question, teacher_feedback: feedback, publish },
      });
      toast.success(publish ? `Published: ${res.marks_obtained}/${res.total_marks} (${res.percentage}%)` : "Draft saved");
      publish ? onPublished() : onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading || !attempt) return <div className="p-8 text-center text-sm text-muted-foreground">Loading attempt…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">{profile?.display_name ?? "Student"}</h2>
            <p className="text-xs text-muted-foreground">{profile?.student_unique_id ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Submitted {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "—"}
              {attempt.time_taken_sec ? ` · ${Math.round(attempt.time_taken_sec / 60)} min taken` : ""}
              {attempt.submission_type && attempt.submission_type !== "manual" ? ` · ${attempt.submission_type}` : ""}
            </p>
            {attempt.violation_reason && (
              <p className="text-xs text-destructive mt-1">⚠️ Violation: {attempt.violation_reason}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{totals.awarded}/{totals.total}</p>
            <p className="text-xs text-muted-foreground">{totals.pct}% · Auto: {attempt.auto_percentage ?? 0}%</p>
            <StatusChip status={attempt.grading_status} />
          </div>
        </div>
      </div>

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-sm">
                  Q{i + 1} <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">{q.type}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto: {a?.auto_marks_awarded ?? 0}/{q.marks}
                  {a?.code_total != null ? ` · ${a.code_passed}/${a.code_total} tests` : ""}
                </p>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{q.prompt}</p>

              {Array.isArray(q.options) && q.options.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  {(q.options as unknown[]).map((opt, oi) => (
                    <li key={oi}>
                      <span className="font-mono mr-2">{String.fromCharCode(65 + oi)}.</span>
                      {String(opt)}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border bg-secondary/30 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Student's answer</p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{a?.response || "(blank)"}</pre>
                </div>
                <div className="rounded-md border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/5 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.16_145)]">Model answer</p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{q.correct_answer || "(none)"}</pre>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Marks awarded</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={q.marks}
                      step={0.5}
                      value={a?.marks_awarded ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: { ...(prev[q.id] ?? { question_id: q.id, response: "", marks_awarded: 0, marks_total: q.marks, correct: false }), marks_awarded: v },
                        }));
                      }}
                      className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                    />
                    <span className="text-xs text-muted-foreground">/ {q.marks}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Comment to student</label>
                  <textarea
                    rows={2}
                    value={a?.teacher_comment ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: { ...(prev[q.id] ?? { question_id: q.id, response: "", marks_awarded: 0, marks_total: q.marks, correct: false }), teacher_comment: v },
                      }));
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    placeholder="Optional per-question feedback…"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Overall feedback</label>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="A summary message the student will see with their score…"
        />
      </div>

      <div className="sticky bottom-4 z-10 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <p className="text-sm">
          Total: <b>{totals.awarded}/{totals.total}</b> ({totals.pct}%)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={!!saving}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {saving === "save" ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => {
              if (!confirm("Publish these marks to the student? This will update the leaderboard.")) return;
              save(true);
            }}
            disabled={!!saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving === "publish" ? "Publishing…" : "Publish to student"}
          </button>
        </div>
      </div>
    </div>
  );
}

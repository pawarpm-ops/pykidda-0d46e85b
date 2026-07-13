import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  adminGetHomework,
  adminUpdateHomework,
  adminAddQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminReorderQuestions,
  adminListSubmissions,
  adminGetSubmissionDetail,
  adminGradeAnswer,
  adminFinalizeCheck,
} from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/admin/homework/$id")({
  head: () => ({
    meta: [
      { title: "Edit Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomeworkEditor,
  ssr: false,
});

type QuestionType = "coding" | "short_answer" | "mcq" | "descriptive" | "practice";
type Difficulty = "easy" | "medium" | "hard";

type Question = {
  id: string;
  homework_id: string;
  question_order: number;
  question_type: QuestionType;
  title: string;
  description: string;
  marks: number;
  difficulty: Difficulty;
  input_format: string | null;
  output_format: string | null;
  sample_input: string | null;
  sample_output: string | null;
  test_cases: unknown;
  hints: string | null;
  mcq_options: string[] | null;
  mcq_correct: string | null;
  starter_code: string | null;
};

function AdminHomeworkEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetHomework);
  const updateFn = useServerFn(adminUpdateHomework);

  const [tab, setTab] = useState<"edit" | "submissions">("edit");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-homework", id],
    queryFn: () => getFn({ data: { id } }),
  });

  // Homework form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    due_at: "",
    allow_late_submission: true,
    status: "draft" as "draft" | "published" | "closed",
  });
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data || seeded) return;
    setSeeded(true);
    const h = data.homework;
    setForm({
      title: h.title ?? "",
      description: h.description ?? "",
      instructions: h.instructions ?? "",
      due_at: h.due_at ? new Date(h.due_at).toISOString().slice(0, 16) : "",
      allow_late_submission: h.allow_late_submission ?? true,
      status: h.status,
    });
  }, [data, seeded]);

  async function saveHomework(status?: "draft" | "published" | "closed") {
    setSaving(true);
    try {
      await updateFn({
        data: {
          id,
          title: form.title,
          description: form.description,
          instructions: form.instructions || null,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          allow_late_submission: form.allow_late_submission,
          status: status ?? form.status,
        },
      });
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 2000);
      if (status) setForm((f) => ({ ...f, status }));
      await refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8">Loading…</main>
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link to="/admin/homework" className="text-sm text-muted-foreground hover:text-accent">
          ← Back to homework list
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {form.title || "Untitled homework"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Status: <span className="font-semibold capitalize">{form.status}</span> ·{" "}
              {data.questions.length} questions · {Number(data.homework.total_marks)} marks
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            {(["edit", "submissions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  tab === t
                    ? "font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
                style={tab === t ? { backgroundImage: "var(--gradient-sunrise)" } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === "edit" && (
          <div className="mt-6 flex flex-col gap-6">
            {/* Homework metadata */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Homework details</h2>
              <div className="mt-3 grid gap-3">
                <Field label="Title">
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </Field>
                <Field label="Instructions (optional)">
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Due date & time">
                    <input
                      type="datetime-local"
                      value={form.due_at}
                      onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.allow_late_submission}
                      onChange={(e) => setForm({ ...form, allow_late_submission: e.target.checked })}
                    />
                    Allow late submissions
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => saveHomework()}
                    disabled={saving}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Save draft
                  </button>
                  {form.status !== "published" && (
                    <button
                      onClick={() => saveHomework("published")}
                      disabled={saving || data.questions.length === 0}
                      className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
                      style={{ backgroundImage: "var(--gradient-sunrise)" }}
                    >
                      Publish
                    </button>
                  )}
                  {form.status === "published" && (
                    <button
                      onClick={() => saveHomework("closed")}
                      disabled={saving}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      Close homework
                    </button>
                  )}
                  {form.status === "closed" && (
                    <button
                      onClick={() => saveHomework("published")}
                      disabled={saving}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      Re-open
                    </button>
                  )}
                  {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
                  {data.questions.length === 0 && form.status !== "published" && (
                    <span className="text-xs text-muted-foreground">Add at least one question to publish.</span>
                  )}
                </div>
              </div>
            </section>

            {/* Questions */}
            <QuestionsEditor
              homeworkId={id}
              questions={data.questions as Question[]}
              onChanged={refetch}
            />
          </div>
        )}

        {tab === "submissions" && (
          <SubmissionsPanel homeworkId={id} questions={data.questions as Question[]} />
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function QuestionsEditor({
  homeworkId,
  questions,
  onChanged,
}: {
  homeworkId: string;
  questions: Question[];
  onChanged: () => void;
}) {
  const addFn = useServerFn(adminAddQuestion);
  const delFn = useServerFn(adminDeleteQuestion);
  const reorderFn = useServerFn(adminReorderQuestions);

  const [expanded, setExpanded] = useState<string | null>(null);

  async function addQuestion() {
    const nextOrder = (questions.at(-1)?.question_order ?? 0) + 1;
    const res = await addFn({
      data: {
        homework_id: homeworkId,
        question_order: nextOrder,
        question_type: "coding",
        title: "New question",
        description: "",
        marks: 1,
        difficulty: "easy",
        test_cases: [],
      },
    });
    setExpanded(res.id);
    await onChanged();
  }

  async function removeQuestion(qid: string) {
    if (!confirm("Delete this question?")) return;
    await delFn({ data: { id: qid } });
    await onChanged();
  }

  async function move(qid: string, direction: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === qid);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= questions.length) return;
    const a = questions[idx];
    const b = questions[swap];
    await reorderFn({
      data: {
        order: [
          { id: a.id, question_order: b.question_order },
          { id: b.id, question_order: a.question_order },
        ],
      },
    });
    await onChanged();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Questions ({questions.length})</h2>
        <button
          onClick={addQuestion}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          + Add question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No questions yet. Add one to get started.</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button
                  onClick={() => move(q.id, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-xs disabled:opacity-30 hover:bg-secondary"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(q.id, 1)}
                  disabled={i === questions.length - 1}
                  className="rounded p-0.5 text-xs disabled:opacity-30 hover:bg-secondary"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <button
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="font-mono text-xs text-muted-foreground">Q{i + 1}</span>{" "}
                <span className="text-sm font-semibold">{q.title || "Untitled"}</span>
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {q.question_type.replace("_", " ")} · {q.difficulty} · {Number(q.marks)} marks
                </span>
              </button>
              <button
                onClick={() => removeQuestion(q.id)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-destructive hover:border-destructive/60"
              >
                Delete
              </button>
            </div>
            {expanded === q.id && (
              <QuestionForm
                q={q}
                onSaved={async () => {
                  await onChanged();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuestionForm({ q, onSaved }: { q: Question; onSaved: () => void }) {
  const updateFn = useServerFn(adminUpdateQuestion);
  const [state, setState] = useState({
    title: q.title,
    description: q.description,
    question_type: q.question_type as QuestionType,
    difficulty: q.difficulty,
    marks: Number(q.marks),
    input_format: q.input_format ?? "",
    output_format: q.output_format ?? "",
    sample_input: q.sample_input ?? "",
    sample_output: q.sample_output ?? "",
    hints: q.hints ?? "",
    starter_code: q.starter_code ?? "",
    mcq_options: (q.mcq_options ?? []).join("\n"),
    mcq_correct: q.mcq_correct ?? "",
    test_cases: JSON.stringify(q.test_cases ?? [], null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      let testCases: unknown[] = [];
      try {
        testCases = state.test_cases.trim() ? JSON.parse(state.test_cases) : [];
        if (!Array.isArray(testCases)) throw new Error("Test cases must be a JSON array");
      } catch (e) {
        throw new Error("Invalid test cases JSON: " + (e as Error).message);
      }
      await updateFn({
        data: {
          id: q.id,
          title: state.title,
          description: state.description,
          question_type: state.question_type,
          difficulty: state.difficulty,
          marks: state.marks,
          input_format: state.input_format || null,
          output_format: state.output_format || null,
          sample_input: state.sample_input || null,
          sample_output: state.sample_output || null,
          hints: state.hints || null,
          starter_code: state.starter_code || null,
          mcq_options: state.mcq_options
            ? state.mcq_options.split("\n").map((s) => s.trim()).filter(Boolean)
            : null,
          mcq_correct: state.mcq_correct || null,
          test_cases: testCases as never,
        },
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const isCoding = state.question_type === "coding" || state.question_type === "practice";
  const isMcq = state.question_type === "mcq";

  return (
    <div className="border-t border-border p-4">
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            placeholder="Question title"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={state.question_type}
            onChange={(e) => setState({ ...state, question_type: e.target.value as QuestionType })}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="coding">Coding</option>
            <option value="short_answer">Short answer</option>
            <option value="mcq">MCQ</option>
            <option value="descriptive">Descriptive</option>
            <option value="practice">Practice</option>
          </select>
          <select
            value={state.difficulty}
            onChange={(e) => setState({ ...state, difficulty: e.target.value as Difficulty })}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <input
            type="number"
            min={0}
            step={0.5}
            value={state.marks}
            onChange={(e) => setState({ ...state, marks: Number(e.target.value) })}
            className="w-24 rounded-md border border-border bg-background px-2 py-2 text-sm"
            placeholder="Marks"
          />
        </div>
        <textarea
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          rows={4}
          placeholder="Problem statement / description"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {isCoding && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                value={state.input_format}
                onChange={(e) => setState({ ...state, input_format: e.target.value })}
                rows={2}
                placeholder="Input format"
                className="rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
              />
              <textarea
                value={state.output_format}
                onChange={(e) => setState({ ...state, output_format: e.target.value })}
                rows={2}
                placeholder="Output format"
                className="rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
              />
              <textarea
                value={state.sample_input}
                onChange={(e) => setState({ ...state, sample_input: e.target.value })}
                rows={3}
                placeholder="Sample input"
                className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
              <textarea
                value={state.sample_output}
                onChange={(e) => setState({ ...state, sample_output: e.target.value })}
                rows={3}
                placeholder="Sample output"
                className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            </div>
            <textarea
              value={state.starter_code}
              onChange={(e) => setState({ ...state, starter_code: e.target.value })}
              rows={4}
              placeholder="Starter code (optional)"
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Hidden test cases (JSON array)
              </label>
              <textarea
                value={state.test_cases}
                onChange={(e) => setState({ ...state, test_cases: e.target.value })}
                rows={5}
                placeholder='[{"input":"...","expected":"..."}]'
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Never sent to students. Used later for automated checking.
              </p>
            </div>
          </>
        )}

        {isMcq && (
          <div className="grid gap-3 sm:grid-cols-2">
            <textarea
              value={state.mcq_options}
              onChange={(e) => setState({ ...state, mcq_options: e.target.value })}
              rows={4}
              placeholder="One option per line"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={state.mcq_correct}
              onChange={(e) => setState({ ...state, mcq_correct: e.target.value })}
              placeholder="Correct option (exact match)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        <textarea
          value={state.hints}
          onChange={(e) => setState({ ...state, hints: e.target.value })}
          rows={2}
          placeholder="Hints (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {saving ? "Saving…" : "Save question"}
          </button>
          {err && <span className="text-xs text-destructive">{err}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Submissions & grading panel
// ============================================================

function SubmissionsPanel({
  homeworkId,
  questions,
}: {
  homeworkId: string;
  questions: Question[];
}) {
  const listFn = useServerFn(adminListSubmissions);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hw-subs", homeworkId],
    queryFn: () => listFn({ data: { homework_id: homeworkId } }),
  });
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);

  if (isLoading) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6">
      {(!data || data.length === 0) && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold">No submissions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Students will appear here after they submit.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((s) => {
          const name = s.profile?.display_name ?? s.profile?.full_name ?? s.student_id.slice(0, 8);
          const badge = statusBadgeAdmin(s.status, s.is_late);
          return (
            <li key={s.id}>
              <button
                onClick={() => setOpenSubmissionId(s.id)}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:border-accent/60"
              >
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.submitted_at
                      ? `Submitted ${new Date(s.submitted_at).toLocaleString()}`
                      : "Not submitted"}
                  </p>
                </div>
                {s.total_marks_obtained != null && (
                  <span className="text-xs text-muted-foreground">
                    {Number(s.total_marks_obtained)} marks
                  </span>
                )}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                  {badge.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {openSubmissionId && (
        <GradingModal
          submissionId={openSubmissionId}
          questions={questions}
          onClose={() => setOpenSubmissionId(null)}
          onDone={async () => {
            setOpenSubmissionId(null);
            await refetch();
          }}
        />
      )}
    </div>
  );
}

function statusBadgeAdmin(status: string, isLate: boolean) {
  if (status === "checked")
    return { text: "Checked", cls: "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40" };
  if (status === "returned")
    return { text: "Returned", cls: "bg-destructive/10 text-destructive border-destructive/40" };
  if (status === "late" || isLate)
    return { text: "Submitted Late", cls: "bg-[oklch(0.72_0.16_60)]/15 text-[oklch(0.55_0.18_45)] border-[oklch(0.72_0.16_60)]/50" };
  if (status === "submitted")
    return { text: "Submitted", cls: "bg-accent/15 text-accent-foreground border-accent/40" };
  return { text: "Not submitted", cls: "bg-secondary text-secondary-foreground border-border" };
}

function GradingModal({
  submissionId,
  questions,
  onClose,
  onDone,
}: {
  submissionId: string;
  questions: Question[];
  onClose: () => void;
  onDone: () => void;
}) {
  const getFn = useServerFn(adminGetSubmissionDetail);
  const gradeFn = useServerFn(adminGradeAnswer);
  const finalizeFn = useServerFn(adminFinalizeCheck);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hw-sub", submissionId],
    queryFn: () => getFn({ data: { submission_id: submissionId } }),
  });
  const [feedback, setFeedback] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !seeded) {
      setFeedback(data.submission.teacher_feedback ?? "");
      setSeeded(true);
    }
  }, [data, seeded]);

  async function finalize(returnForCorrection: boolean) {
    setBusy(true);
    try {
      await finalizeFn({
        data: {
          submission_id: submissionId,
          teacher_feedback: feedback || null,
          return_for_correction: returnForCorrection,
        },
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-4xl rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Grade submission</h3>
          <button onClick={onClose} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
            Close
          </button>
        </div>
        {isLoading || !data ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mt-3 text-sm">
              <p className="font-semibold">
                {data.profile?.display_name ?? data.profile?.full_name ?? "Student"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.submission.submitted_at
                  ? `Submitted ${new Date(data.submission.submitted_at).toLocaleString()}`
                  : "Not submitted"}
                {data.submission.is_late ? " · Late" : ""}
                {" · Total: "}
                {Number(data.submission.total_marks_obtained ?? 0)} /{" "}
                {Number(data.homework?.total_marks ?? 0)}
              </p>
            </div>

            <ul className="mt-5 flex flex-col gap-4">
              {questions.map((q, i) => {
                const ans = data.answers.find((a) => a.homework_question_id === q.id);
                return (
                  <li key={q.id}>
                    <GradeAnswerRow
                      idx={i}
                      q={q}
                      ans={ans ?? null}
                      onGraded={async (marks, comment) => {
                        if (!ans) return;
                        await gradeFn({
                          data: {
                            answer_id: ans.id,
                            marks_awarded: marks,
                            teacher_comment: comment || null,
                          },
                        });
                        await refetch();
                      }}
                    />
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-lg border border-border bg-background p-3">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Overall feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => finalize(false)}
                  disabled={busy}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Mark as checked
                </button>
                <button
                  onClick={() => finalize(true)}
                  disabled={busy}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm text-destructive"
                >
                  Return for correction
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GradeAnswerRow({
  idx,
  q,
  ans,
  onGraded,
}: {
  idx: number;
  q: Question;
  ans: {
    id: string;
    student_answer: string | null;
    student_code: string | null;
    execution_output: string | null;
    marks_awarded: number | null;
    teacher_comment: string | null;
    checked_status: string;
  } | null;
  onGraded: (marks: number | null, comment: string) => Promise<void>;
}) {
  const [marks, setMarks] = useState<string>(
    ans?.marks_awarded != null ? String(ans.marks_awarded) : "",
  );
  const [comment, setComment] = useState(ans?.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          Q{idx + 1}. {q.title}
        </p>
        <span className="text-xs text-muted-foreground">
          {q.question_type} · out of {Number(q.marks)}
        </span>
      </div>
      {q.description && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{q.description}</p>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Student answer
        </p>
        {ans?.student_answer && (
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-xs">
            {ans.student_answer}
          </pre>
        )}
        {ans?.student_code && (
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-2 font-mono text-xs text-[oklch(0.97_0.005_85)]">
            {ans.student_code}
          </pre>
        )}
        {ans?.execution_output && (
          <div className="mt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Output</p>
            <pre className="mt-0.5 whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-xs">
              {ans.execution_output}
            </pre>
          </div>
        )}
        {!ans && <p className="mt-1 text-xs text-muted-foreground italic">No answer submitted.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          max={Number(q.marks)}
          step={0.5}
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="Marks"
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          disabled={!ans}
        />
        <span className="text-xs text-muted-foreground">/ {Number(q.marks)}</span>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment for this question (optional)"
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
          disabled={!ans}
        />
        <button
          disabled={!ans || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onGraded(marks === "" ? null : Number(marks), comment);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : ans?.checked_status === "checked" ? "Update" : "Grade"}
        </button>
        {ans?.checked_status === "checked" && (
          <span className="text-[10px] text-[oklch(0.45_0.16_145)] font-semibold">Checked ✓</span>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DueDateTimePicker } from "@/components/DueDateTimePicker";
import {
  adminGetHomework,
  adminUpdateHomework,
  adminAddQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminDuplicateQuestion,
  adminReorderQuestions,
  adminDeleteHomework,
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

// ============================================================
// Types
// ============================================================

type QuestionType = "coding" | "short_answer" | "mcq" | "descriptive" | "practice";
type Difficulty = "easy" | "medium" | "hard";

type TestCase = { input: string; expected: string; visibility: "sample" | "hidden" };

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

type Homework = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  estimated_minutes: number | null;
  status: "draft" | "published" | "closed";
  total_marks: number;
};

// ============================================================
// Helpers
// ============================================================

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeTests(raw: unknown): TestCase[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): TestCase | null => {
      if (!t || typeof t !== "object") return null;
      const r = t as Record<string, unknown>;
      const input = typeof r.input === "string" ? r.input : "";
      const expected = typeof r.expected === "string" ? r.expected : "";
      const vis =
        r.visibility === "sample" || r.visibility === "hidden"
          ? (r.visibility as "sample" | "hidden")
          : "hidden";
      return { input, expected, visibility: vis };
    })
    .filter((x): x is TestCase => x !== null);
}

function serializeTests(list: TestCase[]) {
  // Persist in the existing shape (input, expected). Include visibility so we
  // can round-trip; the runner ignores unknown keys.
  return list.map((t) => ({
    input: t.input,
    expected: t.expected,
    visibility: t.visibility,
  }));
}

function validateQuestion(q: Question): string[] {
  const errs: string[] = [];
  if (!q.title.trim()) errs.push("Title is required");
  if (!q.description.trim()) errs.push("Description is required");
  if (!Number.isFinite(Number(q.marks)) || Number(q.marks) <= 0)
    errs.push("Marks must be greater than 0");
  if (q.question_type === "coding" || q.question_type === "practice") {
    const tests = normalizeTests(q.test_cases);
    const good = tests.filter((t) => t.expected.length > 0);
    if (good.length === 0) errs.push("Needs at least one test case with an expected output");
    // duplicate detection
    const seen = new Set<string>();
    for (const t of tests) {
      const key = `${t.input}|||${t.expected}`;
      if (seen.has(key)) { errs.push("Duplicate test cases detected"); break; }
      seen.add(key);
    }
    // sample I/O consistency
    if (q.sample_input || q.sample_output) {
      const match = tests.find(
        (t) =>
          t.visibility === "sample" &&
          t.input === (q.sample_input ?? "") &&
          t.expected === (q.sample_output ?? ""),
      );
      if (!match)
        errs.push("Sample input/output should match a sample-visibility test case");
    }
  }
  if (q.question_type === "mcq") {
    const opts = (q.mcq_options ?? []).map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) errs.push("Add at least two options");
    if (new Set(opts).size !== opts.length) errs.push("Options must be unique");
    if (!q.mcq_correct || !opts.includes(q.mcq_correct.trim()))
      errs.push("Select a correct option");
  }
  return errs;
}

function useDebouncedCallback<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((...args: T) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fnRef.current(...args), ms);
  }, [ms]);
}

// ============================================================
// Editor root
// ============================================================

function AdminHomeworkEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetHomework);

  const [tab, setTab] = useState<"edit" | "submissions">("edit");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-homework", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading || !data)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8">Loading…</main>
      </div>
    );

  const homework = data.homework as Homework;
  const questions = data.questions as Question[];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          to="/admin/homework"
          className="text-sm text-muted-foreground hover:text-accent"
        >
          ← Back to homework list
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {homework.title || "Untitled homework"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-semibold capitalize">{homework.status}</span> ·{" "}
              {questions.length} questions · {Number(homework.total_marks)} marks
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
                style={
                  tab === t ? { backgroundImage: "var(--gradient-sunrise)" } : undefined
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === "edit" && (
          <HomeworkWizard
            homework={homework}
            questions={questions}
            onChanged={refetch}
          />
        )}

        {tab === "submissions" && (
          <SubmissionsPanel homeworkId={id} questions={questions} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// Three-step wizard
// ============================================================

type Step = 1 | 2 | 3;

function HomeworkWizard({
  homework,
  questions,
  onChanged,
}: {
  homework: Homework;
  questions: Question[];
  onChanged: () => Promise<unknown> | void;
}) {
  const [step, setStep] = useState<Step>(1);

  const details = useDetailsForm(homework, onChanged);
  const questionErrs = useMemo(
    () => questions.map((q) => validateQuestion(q)),
    [questions],
  );
  const questionsAllValid =
    questions.length > 0 && questionErrs.every((e) => e.length === 0);

  const completion = useMemo(() => {
    let done = 0;
    let total = 3;
    if (details.form.title.trim() && details.form.due_at) done++;
    if (questions.length > 0) done++;
    if (questionsAllValid) done++;
    return Math.round((done / total) * 100);
  }, [details.form, questions.length, questionsAllValid]);

  // Warn on unsaved close
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (details.dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [details.dirty]);

  useBlocker({
    shouldBlockFn: () => {
      if (!details.dirty) return false;
      return !confirm("You have unsaved details. Leave anyway?");
    },
  });

  return (
    <div className="mt-6 flex flex-col gap-5">
      <StepBar
        step={step}
        onStep={setStep}
        completion={completion}
        canGoQuestions={!!details.form.title.trim()}
      />

      {step === 1 && (
        <StepDetails details={details} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepQuestions
          homeworkId={homework.id}
          questions={questions}
          onChanged={onChanged}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepReview
          homework={homework}
          details={details}
          questions={questions}
          questionErrs={questionErrs}
          onBack={() => setStep(2)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function StepBar({
  step,
  onStep,
  completion,
  canGoQuestions,
}: {
  step: Step;
  onStep: (s: Step) => void;
  completion: number;
  canGoQuestions: boolean;
}) {
  const labels: [Step, string][] = [
    [1, "Details"],
    [2, "Questions"],
    [3, "Review"],
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {labels.map(([n, label], idx) => {
          const done = step > n;
          const active = step === n;
          const disabled = n === 2 ? !canGoQuestions : false;
          return (
            <button
              key={n}
              disabled={disabled}
              onClick={() => onStep(n)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                active
                  ? "border-transparent text-primary-foreground shadow-[var(--shadow-warm)]"
                  : done
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-background text-muted-foreground hover:border-accent/40"
              }`}
              style={active ? { backgroundImage: "var(--gradient-sunrise)" } : undefined}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  done ? "bg-accent text-accent-foreground" : active ? "bg-white/25" : "bg-secondary"
                }`}
              >
                {done ? <Check size={12} /> : n}
              </span>
              {label}
              {idx < labels.length - 1 && <span className="mx-1 text-muted-foreground/40">→</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${completion}%`, backgroundImage: "var(--gradient-sunrise)" }}
            />
          </div>
          {completion}% ready
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 1 — Details
// ============================================================

type DetailsState = {
  title: string;
  description: string;
  instructions: string;
  due_at: string;
  allow_late_submission: boolean;
  estimated_minutes: string;
};

function useDetailsForm(homework: Homework, onChanged: () => Promise<unknown> | void) {
  const updateFn = useServerFn(adminUpdateHomework);
  const initial: DetailsState = useMemo(
    () => ({
      title: homework.title ?? "",
      description: homework.description ?? "",
      instructions: homework.instructions ?? "",
      due_at: toLocalInput(homework.due_at),
      allow_late_submission: homework.allow_late_submission ?? true,
      estimated_minutes:
        homework.estimated_minutes != null ? String(homework.estimated_minutes) : "",
    }),
    [homework.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [form, setForm] = useState<DetailsState>(initial);
  const [savedForm, setSavedForm] = useState<DetailsState>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const validate = useCallback((f: DetailsState): string | null => {
    if (!f.title.trim()) return "Title is required.";
    if (f.due_at) {
      const d = new Date(f.due_at);
      if (Number.isNaN(d.getTime())) return "Due date is invalid.";
    }
    return null;
  }, []);

  const save = useCallback(
    async (nextStatus?: "draft" | "published" | "closed") => {
      const err = validate(form);
      if (err && !nextStatus) { setError(err); setSaveState("error"); return; }
      setSaveState("saving");
      setError(null);
      const mySeq = ++seqRef.current;
      try {
        await updateFn({
          data: {
            id: homework.id,
            title: form.title.trim(),
            description: form.description,
            instructions: form.instructions || null,
            due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
            allow_late_submission: form.allow_late_submission,
            estimated_minutes: form.estimated_minutes
              ? Math.max(1, Number(form.estimated_minutes) || 0)
              : null,
            ...(nextStatus ? { status: nextStatus } : {}),
          },
        });
        if (mySeq !== seqRef.current) return; // stale
        setSavedForm(form);
        setSaveState("saved");
        await onChanged();
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        if (mySeq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : "Save failed");
        setSaveState("error");
      }
    },
    [form, homework.id, onChanged, updateFn, validate],
  );

  // Autosave (debounced) — only when title present and not currently in error/publish flow.
  const debouncedSave = useDebouncedCallback(() => {
    if (form.title.trim()) void save();
  }, 900);

  useEffect(() => {
    if (dirty) debouncedSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty]);

  return { form, setForm, dirty, saveState, error, save, homework };
}

function StepDetails({
  details,
  onNext,
}: {
  details: ReturnType<typeof useDetailsForm>;
  onNext: () => void;
}) {
  const { form, setForm, saveState, error, save } = details;
  const titleErr = !form.title.trim();
  const dueDate = form.due_at ? new Date(form.due_at) : null;
  const pastDue = dueDate && dueDate.getTime() <= Date.now();

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Homework details</h2>
          <p className="text-xs text-muted-foreground">
            Fields marked <span className="text-destructive">*</span> are required. Changes autosave.
          </p>
        </div>
        <SaveIndicator state={saveState} />
      </header>

      <div className="mt-4 grid gap-4">
        <Field label="Title" required error={titleErr ? "Title is required" : null}>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Unit 3 — Functions & Recursion"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Short description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="One-line summary shown in the homework list."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Instructions for students">
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            rows={3}
            placeholder="Rules, allowed resources, submission format…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Due date & time"
            required
            error={pastDue ? "Due date must be in the future" : null}
          >
            <DueDateTimePicker
              value={form.due_at}
              onChange={(v) => setForm({ ...form, due_at: v })}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allow_late_submission}
                onChange={(e) =>
                  setForm({ ...form, allow_late_submission: e.target.checked })
                }
              />
              Allow late submissions
            </label>
            <Field label="Estimated completion time (minutes)">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <input
                  type="number"
                  min={1}
                  value={form.estimated_minutes}
                  onChange={(e) =>
                    setForm({ ...form, estimated_minutes: e.target.value })
                  }
                  placeholder="e.g. 45"
                  className="h-10 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </Field>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => save("draft")}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:border-accent/60"
        >
          Save as draft
        </button>
        <button
          onClick={() => { void save(); onNext(); }}
          disabled={titleErr}
          className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          Continue to questions →
        </button>
      </footer>
    </section>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Saving…", cls: "text-muted-foreground" },
    saved: { text: "Saved ✓", cls: "text-accent" },
    error: { text: "Save failed", cls: "text-destructive" },
  } as const;
  const s = map[state as "saving" | "saved" | "error"];
  return <span className={`text-xs font-medium ${s.cls}`}>{s.text}</span>;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ============================================================
// Step 2 — Questions
// ============================================================

function StepQuestions({
  homeworkId,
  questions,
  onChanged,
  onBack,
  onNext,
}: {
  homeworkId: string;
  questions: Question[];
  onChanged: () => Promise<unknown> | void;
  onBack: () => void;
  onNext: () => void;
}) {
  const addFn = useServerFn(adminAddQuestion);
  const dupFn = useServerFn(adminDuplicateQuestion);
  const delFn = useServerFn(adminDeleteQuestion);
  const reorderFn = useServerFn(adminReorderQuestions);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function duplicate(qid: string) {
    setBusyId(qid);
    try {
      const res = await dupFn({ data: { id: qid } });
      setExpanded(res.id);
      await onChanged();
    } finally { setBusyId(null); }
  }

  async function remove(qid: string) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    setBusyId(qid);
    try {
      await delFn({ data: { id: qid } });
      await onChanged();
    } finally { setBusyId(null); }
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Questions{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({questions.length})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Add and organize each question. Only fields relevant to the type appear.
          </p>
        </div>
        <button
          onClick={addQuestion}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          <Plus size={14} /> Add question
        </button>
      </header>

      {questions.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-8 text-center">
          <ListChecks className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-semibold">No questions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click “Add question” to build your first one.
          </p>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => {
          const errs = validateQuestion(q);
          const ok = errs.length === 0;
          const isExpanded = expanded === q.id;
          return (
            <li
              key={q.id}
              className="rounded-lg border border-border bg-background transition"
            >
              <div className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <button
                    onClick={() => move(q.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move Q${i + 1} up`}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => move(q.id, 1)}
                    disabled={i === questions.length - 1}
                    aria-label={`Move Q${i + 1} down`}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button
                  onClick={() => setExpanded(isExpanded ? null : q.id)}
                  className="flex flex-1 min-w-0 items-center gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-mono">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {q.title || "Untitled question"}
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
                    {q.question_type.replace("_", " ")}
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground sm:inline">
                    {q.difficulty}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                    {Number(q.marks)} marks
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ok
                        ? "bg-accent/15 text-accent border border-accent/40"
                        : "bg-destructive/10 text-destructive border border-destructive/40"
                    }`}
                  >
                    {ok ? "Valid" : `${errs.length} issue${errs.length > 1 ? "s" : ""}`}
                  </span>
                </button>
                <button
                  onClick={() => duplicate(q.id)}
                  disabled={busyId === q.id}
                  aria-label="Duplicate question"
                  className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:border-accent/60 hover:text-accent disabled:opacity-50"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => remove(q.id)}
                  disabled={busyId === q.id}
                  aria-label="Delete question"
                  className="rounded-md border border-border bg-background p-1.5 text-destructive hover:border-destructive/60 disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {isExpanded && (
                <QuestionForm q={q} onSaved={onChanged} />
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/60"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={questions.length === 0}
          className="ml-auto rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          Review & publish →
        </button>
      </footer>
    </section>
  );
}

// ============================================================
// Question editor (per-type)
// ============================================================

type QState = {
  title: string;
  description: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  marks: number;
  input_format: string;
  output_format: string;
  sample_input: string;
  sample_output: string;
  hints: string;
  starter_code: string;
  mcq_options: string[];
  mcq_correct: string;
  test_cases: TestCase[];
};

function QuestionForm({ q, onSaved }: { q: Question; onSaved: () => Promise<unknown> | void }) {
  const updateFn = useServerFn(adminUpdateQuestion);

  const initial: QState = useMemo(
    () => ({
      title: q.title,
      description: q.description,
      question_type: q.question_type,
      difficulty: q.difficulty,
      marks: Number(q.marks),
      input_format: q.input_format ?? "",
      output_format: q.output_format ?? "",
      sample_input: q.sample_input ?? "",
      sample_output: q.sample_output ?? "",
      hints: q.hints ?? "",
      starter_code: q.starter_code ?? "",
      mcq_options: q.mcq_options ?? [],
      mcq_correct: q.mcq_correct ?? "",
      test_cases: normalizeTests(q.test_cases),
    }),
    [q.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [state, setState] = useState<QState>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const seqRef = useRef(0);

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const save = useCallback(async () => {
    setSaveState("saving");
    setErr(null);
    const mySeq = ++seqRef.current;
    try {
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
          mcq_options: state.mcq_options.length ? state.mcq_options : null,
          mcq_correct: state.mcq_correct || null,
          test_cases: serializeTests(state.test_cases) as never,
        },
      });
      if (mySeq !== seqRef.current) return;
      setSaveState("saved");
      await onSaved();
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1200);
    } catch (e) {
      if (mySeq !== seqRef.current) return;
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaveState("error");
    }
  }, [state, q.id, onSaved, updateFn]);

  const debouncedSave = useDebouncedCallback(() => {
    if (state.title.trim()) void save();
  }, 900);
  useEffect(() => { if (dirty) debouncedSave(); }, [state, dirty, debouncedSave]);

  const isCoding = state.question_type === "coding" || state.question_type === "practice";
  const isMcq = state.question_type === "mcq";
  const isShort = state.question_type === "short_answer";
  const isDesc = state.question_type === "descriptive";

  // Live validation, matching server-side rules.
  const validationErrors = useMemo(
    () =>
      validateQuestion({
        ...q,
        title: state.title,
        description: state.description,
        question_type: state.question_type,
        marks: state.marks,
        sample_input: state.sample_input || null,
        sample_output: state.sample_output || null,
        mcq_options: state.mcq_options,
        mcq_correct: state.mcq_correct,
        test_cases: serializeTests(state.test_cases),
      }),
    [state, q],
  );

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
            onChange={(e) =>
              setState({ ...state, question_type: e.target.value as QuestionType })
            }
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="coding">Coding</option>
            <option value="practice">Practice</option>
            <option value="mcq">MCQ</option>
            <option value="short_answer">Short answer</option>
            <option value="descriptive">Descriptive</option>
          </select>
          <select
            value={state.difficulty}
            onChange={(e) =>
              setState({ ...state, difficulty: e.target.value as Difficulty })
            }
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
          <CodingFields state={state} setState={setState} />
        )}

        {isMcq && <McqFields state={state} setState={setState} />}

        {(isShort || isDesc) && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Expected-answer guidance / rubric (teacher-only)
            </label>
            <textarea
              value={state.hints}
              onChange={(e) => setState({ ...state, hints: e.target.value })}
              rows={3}
              placeholder="How you'll mark this — key points, sample phrasing, common mistakes…"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Never shown to students.
            </p>
          </div>
        )}

        {!isShort && !isDesc && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Hint (optional, shown to students)
            </label>
            <textarea
              value={state.hints}
              onChange={(e) => setState({ ...state, hints: e.target.value })}
              rows={2}
              placeholder="Short nudge for stuck students."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={saveState === "saving"}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {saveState === "saving" ? "Saving…" : "Save question"}
          </button>
          <button
            onClick={() => setShowValidation((v) => !v)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/60"
          >
            Validate question
          </button>
          <SaveIndicator state={saveState} />
          {err && <span className="text-xs text-destructive">{err}</span>}
        </div>

        {showValidation && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              validationErrors.length
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-accent/40 bg-accent/10 text-accent"
            }`}
          >
            {validationErrors.length ? (
              <>
                <p className="font-semibold">Fix before publishing:</p>
                <ul className="mt-1 list-disc pl-4">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="font-semibold">Looks good — this question is ready.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CodingFields({
  state,
  setState,
}: {
  state: QState;
  setState: (s: QState) => void;
}) {
  return (
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
      <TestCaseBuilder
        cases={state.test_cases}
        onChange={(cases) => setState({ ...state, test_cases: cases })}
      />
    </>
  );
}

function TestCaseBuilder({
  cases,
  onChange,
}: {
  cases: TestCase[];
  onChange: (c: TestCase[]) => void;
}) {
  function update(i: number, patch: Partial<TestCase>) {
    onChange(cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add(visibility: "sample" | "hidden" = "hidden") {
    onChange([...cases, { input: "", expected: "", visibility }]);
  }
  function dup(i: number) {
    const c = cases[i];
    onChange([...cases.slice(0, i + 1), { ...c }, ...cases.slice(i + 1)]);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cases.length) return;
    const copy = cases.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  function remove(i: number) {
    if (!confirm("Delete this test case?")) return;
    onChange(cases.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Test cases</p>
          <p className="text-[11px] text-muted-foreground">
            Sample tests can be shown to students. Hidden tests are used for grading only.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => add("sample")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-accent/60"
          >
            <Plus size={12} /> Sample
          </button>
          <button
            onClick={() => add("hidden")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            <Plus size={12} /> Hidden
          </button>
        </div>
      </div>

      {cases.length === 0 && (
        <p className="mt-3 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-4 text-center text-xs text-muted-foreground">
          No test cases yet. Add at least one to publish.
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {cases.map((c, i) => (
          <li
            key={i}
            className={`rounded-md border p-3 ${
              c.visibility === "sample"
                ? "border-accent/40 bg-accent/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
              <select
                value={c.visibility}
                onChange={(e) =>
                  update(i, { visibility: e.target.value as "sample" | "hidden" })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="hidden">Hidden</option>
                <option value="sample">Sample (visible)</option>
              </select>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary"
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  onClick={() => dup(i)}
                  aria-label="Duplicate"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => remove(i)}
                  aria-label="Delete"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Input
                </label>
                <textarea
                  value={c.input}
                  onChange={(e) => update(i, { input: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Expected output
                </label>
                <textarea
                  value={c.expected}
                  onChange={(e) => update(i, { expected: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
                />
                {!c.expected && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Expected output is required.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function McqFields({
  state,
  setState,
}: {
  state: QState;
  setState: (s: QState) => void;
}) {
  const opts = state.mcq_options;
  function update(i: number, v: string) {
    const next = opts.slice();
    next[i] = v;
    // Keep correct in sync if the selected one is edited
    const correctIdx = opts.findIndex((o) => o === state.mcq_correct);
    let correct = state.mcq_correct;
    if (correctIdx === i) correct = v;
    setState({ ...state, mcq_options: next, mcq_correct: correct });
  }
  function add() {
    setState({ ...state, mcq_options: [...opts, ""] });
  }
  function remove(i: number) {
    const removed = opts[i];
    const next = opts.filter((_, idx) => idx !== i);
    setState({
      ...state,
      mcq_options: next,
      mcq_correct: state.mcq_correct === removed ? "" : state.mcq_correct,
    });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    const copy = opts.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setState({ ...state, mcq_options: copy });
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Options</p>
        <button
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          <Plus size={12} /> Add option
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Select the radio next to the correct option. Need at least two unique options.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {opts.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={state.mcq_correct !== "" && state.mcq_correct === o}
              onChange={() => setState({ ...state, mcq_correct: o })}
              aria-label={`Mark option ${i + 1} correct`}
            />
            <input
              value={o}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => move(i, -1)}
              aria-label="Move up"
              className="rounded p-1 text-muted-foreground hover:bg-secondary"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => move(i, 1)}
              aria-label="Move down"
              className="rounded p-1 text-muted-foreground hover:bg-secondary"
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => remove(i)}
              aria-label="Delete option"
              className="rounded p-1 text-destructive hover:bg-destructive/10"
            >
              <X size={14} />
            </button>
          </li>
        ))}
        {opts.length === 0 && (
          <li className="rounded-md border border-dashed border-border bg-secondary/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No options yet.
          </li>
        )}
      </ul>
    </div>
  );
}

// ============================================================
// Step 3 — Review & publish
// ============================================================

function StepReview({
  homework,
  details,
  questions,
  questionErrs,
  onBack,
  onChanged,
}: {
  homework: Homework;
  details: ReturnType<typeof useDetailsForm>;
  questions: Question[];
  questionErrs: string[][];
  onBack: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const updateFn = useServerFn(adminUpdateHomework);
  const deleteFn = useServerFn(adminDeleteHomework);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of questions) m[q.question_type] = (m[q.question_type] ?? 0) + 1;
    return m;
  }, [questions]);

  const totalMarks = questions.reduce((s, q) => s + Number(q.marks || 0), 0);
  const dueDate = details.form.due_at ? new Date(details.form.due_at) : null;
  const pastDue = dueDate && dueDate.getTime() <= Date.now();

  const blockers: string[] = [];
  if (!details.form.title.trim()) blockers.push("Homework title is required.");
  if (!details.form.due_at) blockers.push("Set a due date.");
  else if (pastDue) blockers.push("Due date must be in the future.");
  if (questions.length === 0) blockers.push("Add at least one question.");
  questionErrs.forEach((errs, i) => {
    if (errs.length) blockers.push(`Q${i + 1}: ${errs.join("; ")}`);
  });

  const canPublish = blockers.length === 0;

  async function publish() {
    setBusy(true);
    setErr(null);
    try {
      await updateFn({
        data: {
          id: homework.id,
          title: details.form.title.trim(),
          description: details.form.description,
          instructions: details.form.instructions || null,
          due_at: details.form.due_at
            ? new Date(details.form.due_at).toISOString()
            : null,
          allow_late_submission: details.form.allow_late_submission,
          estimated_minutes: details.form.estimated_minutes
            ? Math.max(1, Number(details.form.estimated_minutes) || 0)
            : null,
          status: "published",
        },
      });
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Publish failed");
    } finally { setBusy(false); }
  }

  async function saveDraft() {
    setBusy(true);
    setErr(null);
    try {
      await details.save("draft");
    } finally { setBusy(false); }
  }

  async function deleteHomework(force = false) {
    const message = homework.status === "published"
      ? "This homework is published. Deleting it will remove all student submissions. Continue?"
      : "Delete this homework? This cannot be undone.";
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: homework.id, force } });
      window.location.href = "/admin/homework";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      if (msg.includes("published") && !force && confirm(`${msg}\n\nDelete anyway?`)) {
        await deleteHomework(true);
        return;
      }
      setErr(msg);
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Review & publish</h2>
          <p className="text-xs text-muted-foreground">
            Final check before students see it.
          </p>
        </div>
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Homework
          </p>
          <h3 className="mt-1 text-base font-bold">{details.form.title || "Untitled"}</h3>
          {details.form.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {details.form.description}
            </p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>
              Due:{" "}
              <span className="font-medium text-foreground">
                {dueDate ? dueDate.toLocaleString() : "— not set —"}
              </span>
            </li>
            <li>
              Late submissions:{" "}
              <span className="font-medium text-foreground">
                {details.form.allow_late_submission ? "Allowed" : "Not allowed"}
              </span>
            </li>
            {details.form.estimated_minutes && (
              <li>
                Estimated time:{" "}
                <span className="font-medium text-foreground">
                  {details.form.estimated_minutes} min
                </span>
              </li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Content
          </p>
          <p className="mt-1 text-sm">
            <span className="text-2xl font-bold">{questions.length}</span>{" "}
            <span className="text-muted-foreground">questions ·</span>{" "}
            <span className="text-2xl font-bold">{totalMarks}</span>{" "}
            <span className="text-muted-foreground">marks</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(typeCounts).map(([k, v]) => (
              <span
                key={k}
                className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
              >
                {k.replace("_", " ")} × {v}
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowPreview(true)}
            className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-accent/60"
          >
            Preview student view
          </button>
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm font-semibold text-destructive">
            Fix before publishing
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
            {blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {err && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
          {err}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/60"
        >
          ← Back
        </button>
        <button
          onClick={saveDraft}
          disabled={busy}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/60 disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          onClick={publish}
          disabled={!canPublish || busy}
          className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {busy ? "Working…" : homework.status === "published" ? "Update published" : "Publish homework"}
        </button>
        <button
          onClick={() => deleteHomework(false)}
          disabled={busy}
          className="ml-auto rounded-md border border-destructive/40 bg-background px-3 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          Delete homework
        </button>
      </footer>

      {showPreview && (
        <StudentPreview
          homework={homework}
          details={details.form}
          questions={questions}
          onClose={() => setShowPreview(false)}
        />
      )}
    </section>
  );
}

function StudentPreview({
  details,
  questions,
  onClose,
}: {
  homework: Homework;
  details: DetailsState;
  questions: Question[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Student preview
            </p>
            <h3 className="text-xl font-bold">{details.title || "Untitled"}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
        {details.description && (
          <p className="mt-2 text-sm text-muted-foreground">{details.description}</p>
        )}
        {details.instructions && (
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs">
            <p className="font-semibold">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {details.instructions}
            </p>
          </div>
        )}
        <ul className="mt-4 flex flex-col gap-3">
          {questions.map((q, i) => {
            const samples = normalizeTests(q.test_cases).filter(
              (t) => t.visibility === "sample",
            );
            const isCoding = q.question_type === "coding" || q.question_type === "practice";
            return (
              <li key={q.id} className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold">
                  Q{i + 1}. {q.title}{" "}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({Number(q.marks)} marks · {q.question_type.replace("_", " ")})
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.description}</p>
                {isCoding && q.sample_input && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-secondary/30 p-2 font-mono text-xs">
                    <strong className="text-muted-foreground">Sample input:</strong>{"\n"}
                    {q.sample_input}
                    {"\n"}
                    <strong className="text-muted-foreground">Expected:</strong>{"\n"}
                    {q.sample_output}
                  </pre>
                )}
                {isCoding && samples.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {samples.length} sample test case(s) visible. Hidden tests are used for grading only.
                  </p>
                )}
                {q.question_type === "mcq" && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {(q.mcq_options ?? []).map((o, k) => (
                      <li key={k} className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full border border-border" />
                        {o}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// Submissions & grading (unchanged behavior)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

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
        {(data ?? []).map((s: AnyRec) => {
          const name =
            s.profile?.display_name ?? s.profile?.full_name ?? s.student_id.slice(0, 8);
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
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                >
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
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
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
                const ans = data.answers.find(
                  (a: AnyRec) => a.homework_question_id === q.id,
                );
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
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
          {q.description}
        </p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Output
            </p>
            <pre className="mt-0.5 whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-xs">
              {ans.execution_output}
            </pre>
          </div>
        )}
        {!ans && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            No answer submitted.
          </p>
        )}
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
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

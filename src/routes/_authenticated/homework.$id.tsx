import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getStudentHomework,
  saveHomeworkAnswer,
  submitHomework,
} from "@/lib/homework.functions";
import { cancelPython, loadPyodideOnce, runPython } from "@/lib/pyodide-runner";
import { recordDailyStreakVisit } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/homework/$id")({
  head: () => ({
    meta: [
      { title: "Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeworkDetailPage,
  ssr: false,
});

type Question = {
  id: string;
  question_order: number;
  question_type: "coding" | "short_answer" | "mcq" | "descriptive" | "practice";
  title: string;
  description: string;
  marks: number;
  difficulty: string;
  input_format: string | null;
  output_format: string | null;
  sample_input: string | null;
  sample_output: string | null;
  hints: string | null;
  mcq_options: string[] | null;
  starter_code: string | null;
};

type AnswerState = {
  student_answer: string;
  student_code: string;
  execution_output: string;
};

function difficultyClass(d: string) {
  if (d === "hard") return "bg-destructive/10 text-destructive border-destructive/40";
  if (d === "medium") return "bg-[oklch(0.72_0.16_60)]/15 text-[oklch(0.55_0.18_45)] border-[oklch(0.72_0.16_60)]/40";
  return "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40";
}

function HomeworkDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getStudentHomework);
  const saveFn = useServerFn(saveHomeworkAnswer);
  const submitFn = useServerFn(submitHomework);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["student-homework", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [pyReady, setPyReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const seededRef = useRef(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!data || seededRef.current) return;
    seededRef.current = true;
    const map: Record<string, AnswerState> = {};
    for (const q of (data.questions ?? []) as Question[]) {
      const a = (data.answers ?? []).find((x) => x.homework_question_id === q.id);
      map[q.id] = {
        student_answer: a?.student_answer ?? "",
        student_code: a?.student_code ?? q.starter_code ?? "",
        execution_output: a?.execution_output ?? "",
      };
    }
    setAnswers(map);
    // Fire-and-forget: student opened an eligible activity → daily streak.
    void recordDailyStreakVisit("homework_opened", id);
  }, [data, id]);

  useEffect(() => {
    loadPyodideOnce().then(() => setPyReady(true)).catch(() => setPyReady(false));
  }, []);

  const questions = (data?.questions ?? []) as Question[];
  const submission = data?.submission ?? null;
  const submittedStatuses = ["submitted", "late", "checked", "returned"];
  const alreadySubmitted = submission ? submittedStatuses.includes(submission.status) : false;
  const isChecked = submission?.status === "checked";
  const readOnly = alreadySubmitted; // once submitted, no more edits/resubmission
  const overdue = data?.homework.due_at
    ? new Date(data.homework.due_at) < new Date()
    : false;
  const active = questions[activeIdx];

  const totalObtained = useMemo(() => {
    return (data?.answers ?? []).reduce(
      (s, a) => s + (a.marks_awarded ?? 0),
      0,
    );
  }, [data?.answers]);

  function scheduleSave(q: Question, next: AnswerState) {
    if (readOnly) return;
    if (saveTimers.current[q.id]) clearTimeout(saveTimers.current[q.id]);
    saveTimers.current[q.id] = setTimeout(async () => {
      try {
        await saveFn({
          data: {
            homework_id: id,
            homework_question_id: q.id,
            student_answer: next.student_answer || null,
            student_code: next.student_code || null,
            execution_output: next.execution_output || null,
          },
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        /* ignore */
      }
    }, 1200);
  }

  function updateAnswer(q: Question, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? { student_answer: "", student_code: "", execution_output: "" };
      const next = { ...cur, ...patch };
      scheduleSave(q, next);
      return { ...prev, [q.id]: next };
    });
  }

  async function handleRun(q: Question) {
    if (running) return;
    setRunning(true);
    const cur = answers[q.id];
    updateAnswer(q, { execution_output: "Running…" });
    try {
      await loadPyodideOnce();
      const r = await runPython(cur.student_code, q.sample_input ?? "", { timeoutMs: 8000 });
      const out = [r.stdout, r.stderr ? `\n--- stderr ---\n${r.stderr}` : ""].join("");
      updateAnswer(q, { execution_output: out });
    } catch (e) {
      updateAnswer(q, { execution_output: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmitAll() {
    setConfirmOpen(false);
    try {
      // Flush pending saves
      for (const t of Object.values(saveTimers.current)) clearTimeout(t);
      await Promise.all(
        questions.map((q) => {
          const a = answers[q.id];
          if (!a) return null;
          return saveFn({
            data: {
              homework_id: id,
              homework_question_id: q.id,
              student_answer: a.student_answer || null,
              student_code: a.student_code || null,
              execution_output: a.execution_output || null,
            },
          });
        }),
      );
      const res = await submitFn({ data: { homework_id: id } });
      setToast(res.is_late ? "Submitted (late) 📤" : "Submitted successfully 🎉");
      await refetch();
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Submit failed");
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (isLoading)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-8">Loading…</main>
      </div>
    );
  if (error || !data)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-destructive">{(error as Error)?.message ?? "Not found"}</p>
          <Link to="/homework" className="mt-4 inline-block text-accent">← Back</Link>
        </main>
      </div>
    );

  const hw = data.homework;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/homework" className="text-sm text-muted-foreground hover:text-accent">
          ← Back to homework
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{hw.title}</h1>
          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs">
            {Number(hw.total_marks)} marks · {questions.length} questions
          </span>
          {hw.due_at && (
            <span className={`text-xs ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
              ⏰ Due {new Date(hw.due_at).toLocaleString()}
            </span>
          )}
        </div>

        {hw.description && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm whitespace-pre-wrap">
            {hw.description}
          </div>
        )}
        {hw.instructions && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm whitespace-pre-wrap">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">Instructions</p>
            {hw.instructions}
          </div>
        )}

        {overdue && !readOnly && (
          <div className="mt-4 rounded-xl border-2 border-[oklch(0.72_0.16_60)]/60 bg-[oklch(0.72_0.16_60)]/10 p-4 text-sm">
            <p className="font-bold text-[oklch(0.55_0.18_45)]">Deadline passed.</p>
            <p className="mt-1 text-muted-foreground">
              {hw.allow_late_submission
                ? "You can still submit — it will be marked as Late."
                : "Late submissions are disabled for this homework."}
            </p>
          </div>
        )}

        {readOnly && (
          <div className="mt-4 rounded-xl border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/10 p-4 text-sm">
            <p className="font-bold">Checked by teacher</p>
            <p className="mt-1 text-muted-foreground">
              Total: {totalObtained} / {Number(hw.total_marks)}
            </p>
            {submission?.teacher_feedback && (
              <p className="mt-2 whitespace-pre-wrap">{submission.teacher_feedback}</p>
            )}
          </div>
        )}

        {questions.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No questions in this homework yet.</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Question navigator */}
            <aside className="rounded-xl border border-border bg-card p-3 h-max lg:sticky lg:top-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Questions</p>
              <ol className="flex flex-col gap-1">
                {questions.map((q, i) => {
                  const answered = answers[q.id]?.student_answer || answers[q.id]?.student_code;
                  return (
                    <li key={q.id}>
                      <button
                        onClick={() => setActiveIdx(i)}
                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition ${
                          i === activeIdx
                            ? "bg-accent/20 border border-accent/40 font-semibold"
                            : "hover:bg-secondary border border-transparent"
                        }`}
                      >
                        <span className="mr-1 tabular-nums">Q{i + 1}.</span>
                        <span className="line-clamp-1">{q.title}</span>
                        <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${answered ? "bg-[oklch(0.65_0.16_145)]" : "bg-border"}`} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            {/* Active question */}
            {active && (
              <QuestionCard
                q={active}
                idx={activeIdx}
                total={questions.length}
                state={answers[active.id] ?? { student_answer: "", student_code: "", execution_output: "" }}
                readOnly={readOnly}
                pyReady={pyReady}
                running={running}
                onChange={(patch) => updateAnswer(active, patch)}
                onRun={() => handleRun(active)}
                onPrev={() => setActiveIdx(Math.max(0, activeIdx - 1))}
                onNext={() => setActiveIdx(Math.min(questions.length - 1, activeIdx + 1))}
                gradedAnswer={
                  data.answers.find((a) => a.homework_question_id === active.id) ?? null
                }
              />
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {!readOnly && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={overdue && !hw.allow_late_submission}
              className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{
                backgroundImage: overdue
                  ? "linear-gradient(135deg, oklch(0.72 0.16 60), oklch(0.55 0.22 25))"
                  : "var(--gradient-sunrise)",
              }}
            >
              {overdue ? "Submit late" : "Submit homework"}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {savedAt ? `Draft saved at ${savedAt}` : readOnly ? "Checked — read-only" : "Autosaves as you type"}
          </span>
        </div>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="text-lg font-bold">Submit homework?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Make sure you've answered every question. You won't be able to change it after checking.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={handleSubmitAll}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  idx,
  total,
  state,
  readOnly,
  pyReady,
  running,
  onChange,
  onRun,
  onPrev,
  onNext,
  gradedAnswer,
}: {
  q: Question;
  idx: number;
  total: number;
  state: AnswerState;
  readOnly: boolean;
  pyReady: boolean;
  running: boolean;
  onChange: (patch: Partial<AnswerState>) => void;
  onRun: () => void;
  onPrev: () => void;
  onNext: () => void;
  gradedAnswer: {
    marks_awarded: number | null;
    teacher_comment: string | null;
    checked_status: string;
  } | null;
}) {
  const isCoding = q.question_type === "coding" || q.question_type === "practice";
  const isMcq = q.question_type === "mcq";
  const isWritten = q.question_type === "short_answer" || q.question_type === "descriptive";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Question {idx + 1} of {total} · {q.question_type.replace("_", " ")}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{q.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${difficultyClass(q.difficulty)}`}>
            {q.difficulty}
          </span>
          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold">
            {Number(q.marks)} marks
          </span>
        </div>
      </div>

      {q.description && (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{q.description}</div>
      )}

      {(q.input_format || q.output_format) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
          {q.input_format && (
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Input format</p>
              <p className="mt-1 whitespace-pre-wrap">{q.input_format}</p>
            </div>
          )}
          {q.output_format && (
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Output format</p>
              <p className="mt-1 whitespace-pre-wrap">{q.output_format}</p>
            </div>
          )}
        </div>
      )}

      {(q.sample_input || q.sample_output) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {q.sample_input && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sample input</p>
              <pre className="mt-1 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-xs">{q.sample_input}</pre>
            </div>
          )}
          {q.sample_output && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sample output</p>
              <pre className="mt-1 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-xs">{q.sample_output}</pre>
            </div>
          )}
        </div>
      )}

      {q.hints && (
        <details className="mt-3 rounded-md border border-border bg-secondary/30 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">💡 Hint</summary>
          <p className="mt-2 whitespace-pre-wrap">{q.hints}</p>
        </details>
      )}

      {/* Answer input */}
      {isWritten && (
        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your answer</label>
          <textarea
            value={state.student_answer}
            onChange={(e) => onChange({ student_answer: e.target.value })}
            disabled={readOnly}
            rows={q.question_type === "descriptive" ? 8 : 4}
            className="mt-1 block w-full rounded-md border border-border bg-card p-3 text-sm outline-none focus:border-accent"
            placeholder="Type your answer here…"
          />
        </div>
      )}

      {isMcq && q.mcq_options && (
        <div className="mt-4 flex flex-col gap-2">
          {q.mcq_options.map((opt, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm transition ${
                state.student_answer === opt
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/40"
              }`}
            >
              <input
                type="radio"
                name={`mcq-${q.id}`}
                value={opt}
                checked={state.student_answer === opt}
                onChange={() => onChange({ student_answer: opt })}
                disabled={readOnly}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {isCoding && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your Python code</label>
            <span className="text-xs text-muted-foreground">{pyReady ? "Python: ready" : "Python: loading…"}</span>
          </div>
          <div className="mt-1 rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)] shadow-inner">
            <textarea
              value={state.student_code}
              onChange={(e) => onChange({ student_code: e.target.value })}
              disabled={readOnly}
              spellCheck={false}
              rows={14}
              className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none"
              style={{ tabSize: 4 }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  const next = state.student_code.slice(0, s) + "    " + state.student_code.slice(el.selectionEnd);
                  onChange({ student_code: next });
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = s + 4;
                  });
                }
              }}
            />
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Output</p>
            <pre className="mt-1 min-h-[5rem] overflow-auto rounded-md border border-border bg-secondary/40 p-2 text-xs whitespace-pre-wrap">
              {state.execution_output || "(no output yet)"}
            </pre>
          </div>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={onRun}
                disabled={running}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {running ? "Running…" : "▶ Run code"}
              </button>
              {running && (
                <button
                  onClick={() => cancelPython()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                >
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  Stop Execution
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {gradedAnswer && gradedAnswer.checked_status === "checked" && (
        <div className="mt-4 rounded-md border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/10 p-3 text-sm">
          <p className="font-semibold">
            Marks: {gradedAnswer.marks_awarded ?? 0} / {Number(q.marks)}
          </p>
          {gradedAnswer.teacher_comment && (
            <p className="mt-1 whitespace-pre-wrap text-xs">{gradedAnswer.teacher_comment}</p>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button
          onClick={onPrev}
          disabled={idx === 0}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={idx === total - 1}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

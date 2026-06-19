import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMockTest, type Question } from "@/lib/mock-tests";
import {
  clearTestStarted,
  getStudentName,
  gradeFor,
  isTestStarted,
  saveResult,
  type AttemptResult,
} from "@/lib/test-session";

export const Route = createFileRoute("/mock-tests/$testId/run")({
  head: () => ({
    meta: [
      { title: "Mock Test in progress" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RunTest,
  ssr: false,
  notFoundComponent: () => <div className="p-10">Test not found.</div>,
  errorComponent: () => <div className="p-10">Something went wrong.</div>,
});

type AnswerMap = Record<string, number | null>;
type ReviewMap = Record<string, boolean>;

function RunTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const test = getMockTest(testId);

  // Guard: must have started via warning page
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(isTestStarted(testId));
  }, [testId]);

  const startedAt = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState<number>(test?.durationSec ?? 0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [reviewed, setReviewed] = useState<ReviewMap>({});
  const submittedRef = useRef(false);

  const buildResult = useCallback(
    (submissionType: "normal" | "auto-violation", violationReason?: string): AttemptResult => {
      const t = test!;
      const totalMarks = t.questions.reduce((a, q) => a + q.marks, 0);
      let marksObtained = 0;
      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      const detailed = t.questions.map((q) => {
        const sel = answers[q.id];
        const has = sel !== undefined && sel !== null;
        const isCorrect = has && sel === q.correctIndex;
        if (!has) unattempted++;
        else if (isCorrect) {
          correct++;
          marksObtained += q.marks;
        } else wrong++;
        return { questionId: q.id, selected: has ? (sel as number) : null, correct: q.correctIndex, isCorrect };
      });
      const attempted = t.questions.length - unattempted;
      const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
      const timeTakenSec = Math.min(t.durationSec, Math.floor((Date.now() - startedAt.current) / 1000));
      return {
        testId: t.id,
        testName: t.name,
        studentName: getStudentName(),
        totalQuestions: t.questions.length,
        attempted,
        correct,
        wrong,
        unattempted,
        marksObtained,
        totalMarks,
        percentage,
        grade: gradeFor(percentage),
        timeTakenSec,
        submissionType,
        violationReason,
        answers: detailed,
        submittedAt: Date.now(),
      };
    },
    [answers, test],
  );

  const submit = useCallback(
    (submissionType: "normal" | "auto-violation" = "normal", violationReason?: string) => {
      if (submittedRef.current || !test) return;
      submittedRef.current = true;
      const r = buildResult(submissionType, violationReason);
      saveResult(r);
      clearTestStarted(testId);
      // Exit fullscreen if still in
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      navigate({ to: "/mock-tests/$testId/result", params: { testId } });
    },
    [buildResult, navigate, test, testId],
  );

  // Timer
  useEffect(() => {
    if (!test || allowed !== true) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          submit("normal");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [test, allowed, submit]);

  // Anti-cheating listeners
  useEffect(() => {
    if (!test || allowed !== true) return;

    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, 600); // give fullscreen a moment to settle on entry

    const onFsChange = () => {
      if (!armed) return;
      if (!document.fullscreenElement) {
        submit("auto-violation", "Exited full-screen mode");
      }
    };
    const onVisibility = () => {
      if (!armed) return;
      if (document.visibilityState === "hidden") {
        submit("auto-violation", "Tab switched or browser hidden");
      }
    };
    const onBlur = () => {
      if (!armed) return;
      submit("auto-violation", "Window lost focus");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKey = (e: KeyboardEvent) => {
      // Block common shortcuts that could leave the test
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(armTimer);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
    };
  }, [test, allowed, submit]);

  if (allowed === false) {
    return <Navigate to="/mock-tests/$testId/warning" params={{ testId }} />;
  }
  if (!test || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const q: Question = test.questions[currentIdx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const lowTime = remaining <= 30;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 border-b border-border bg-card"
      >
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Mock Test</p>
            <p className="font-semibold leading-tight">{test.name}</p>
          </div>
          <div
            className={`px-4 py-2 rounded-md font-mono text-lg font-bold tabular-nums ${
              lowTime ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-foreground"
            }`}
            aria-live="polite"
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-6 grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Question area */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question <strong className="text-foreground">{currentIdx + 1}</strong> of {test.questions.length}
            </span>
            <span className="text-muted-foreground">Marks: {q.marks}</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold leading-snug">{q.text}</h2>

          <div className="mt-6 space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/60 bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-1 accent-[oklch(0.72_0.17_55)]"
                    checked={selected}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => setReviewed((r) => ({ ...r, [q.id]: !r[q.id] }))}
              className={`rounded-md border px-3 py-2 text-sm ${
                reviewed[q.id]
                  ? "border-[oklch(0.65_0.15_145)] bg-[oklch(0.65_0.15_145)]/10"
                  : "border-border bg-background"
              }`}
            >
              {reviewed[q.id] ? "Unmark Review" : "Mark for Review"}
            </button>
            <button
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: null }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              Clear
            </button>
            <div className="ml-auto flex gap-2">
              {currentIdx < test.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(test.questions.length - 1, i + 1))}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Save &amp; Next →
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm("Submit your test now?")) submit("normal");
                  }}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Submit Test
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Navigator */}
        <aside className="rounded-xl border border-border bg-card p-4 h-fit">
          <p className="text-sm font-semibold">Question Navigator</p>
          <div className="mt-3 grid grid-cols-6 lg:grid-cols-5 gap-2">
            {test.questions.map((qq, i) => {
              const sel = answers[qq.id];
              const isAttempted = sel !== undefined && sel !== null;
              const isReview = reviewed[qq.id];
              const isCurrent = i === currentIdx;
              let cls = "bg-background border-border text-foreground";
              if (isReview) cls = "bg-[oklch(0.65_0.15_145)] border-[oklch(0.65_0.15_145)] text-white";
              else if (isAttempted) cls = "bg-accent border-accent text-accent-foreground";
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-9 w-full rounded text-sm font-semibold border ${cls} ${
                    isCurrent ? "ring-2 ring-ring" : ""
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5 text-xs">
            <Legend swatch="bg-accent" label="Attempted" />
            <Legend swatch="bg-background border border-border" label="Not Attempted" />
            <Legend swatch="bg-[oklch(0.65_0.15_145)]" label="Marked for Review" />
          </div>
          <button
            onClick={() => {
              if (confirm("Submit your test now?")) submit("normal");
            }}
            className="mt-4 w-full rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Submit Test
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
            Anti-cheating is active. Leaving the test window will auto-submit your attempt.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-4 w-4 rounded ${swatch}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

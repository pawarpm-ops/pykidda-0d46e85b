import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMockTest, mockTestQuestions, type CodeQuestion } from "@/lib/questions";
import {
  clearTestStarted,
  getStudentName,
  gradeFor,
  isTestStarted,
  saveResult,
  type AttemptResult,
  type QuestionAttempt,
} from "@/lib/test-session";
import { loadPyodideOnce, outputsMatch, runPython } from "@/lib/pyodide-runner";
import { recordMockResult } from "@/lib/progress";
import { supabase } from "@/integrations/supabase/client";

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

type CodeMap = Record<string, string>;

function RunTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const test = getMockTest(testId);
  const questions: CodeQuestion[] = test ? mockTestQuestions(test) : [];

  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(isTestStarted(testId));
    // Pre-warm Pyodide so grading is fast
    loadPyodideOnce().catch(() => {});
  }, [testId]);

  const startedAt = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState<number>(test?.durationSec ?? 0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [codes, setCodes] = useState<CodeMap>({});
  const codesRef = useRef<CodeMap>({});
  codesRef.current = codes;
  const submittedRef = useRef(false);
  const [grading, setGrading] = useState(false);
  const [gradeMsg, setGradeMsg] = useState("Submitting…");

  // Seed starter code lazily once we know the test
  useEffect(() => {
    if (!test) return;
    setCodes((c) => {
      const next = { ...c };
      for (const q of questions) if (!(q.id in next)) next[q.id] = q.starterCode;
      return next;
    });
  }, [test, questions]);

  const submit = useCallback(
    async (submissionType: "normal" | "auto-violation" = "normal", violationReason?: string) => {
      if (submittedRef.current || !test) return;
      submittedRef.current = true;
      setGrading(true);
      setGradeMsg(submissionType === "auto-violation" ? "Auto-submitting & grading…" : "Grading your code…");

      // Exit fullscreen immediately so user isn't trapped during grading
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const attempts: QuestionAttempt[] = [];
      let marksObtained = 0;
      let totalMarks = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const code = codesRef.current[q.id] ?? q.starterCode;
        totalMarks += q.marks;
        setGradeMsg(`Grading Q${i + 1} of ${questions.length}…`);
        const results: QuestionAttempt["results"] = [];
        let passed = 0;
        for (const tc of q.tests) {
          // eslint-disable-next-line no-await-in-loop
          const r = await runPython(code, tc.stdin ?? "");
          const ok = r.ok && outputsMatch(r.stdout, tc.expected);
          if (ok) passed++;
          results.push({ passed: ok, expected: tc.expected, actual: r.stdout, stderr: r.stderr });
        }
        const allPassed = passed === q.tests.length;
        const marks = allPassed ? q.marks : 0;
        marksObtained += marks;
        attempts.push({
          questionId: q.id,
          code,
          passed,
          total: q.tests.length,
          marksObtained: marks,
          marksTotal: q.marks,
          results,
        });
      }

      const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
      const timeTakenSec = Math.min(test.durationSec, Math.floor((Date.now() - startedAt.current) / 1000));
      const result: AttemptResult = {
        testId: test.id,
        testName: test.name,
        studentName: getStudentName(),
        totalQuestions: questions.length,
        marksObtained,
        totalMarks,
        percentage,
        grade: gradeFor(percentage),
        timeTakenSec,
        submissionType,
        violationReason,
        attempts,
        submittedAt: Date.now(),
      };
      saveResult(result);
      clearTestStarted(testId);
      navigate({ to: "/mock-tests/$testId/result", params: { testId } });
    },
    [navigate, questions, test, testId],
  );

  // Timer
  useEffect(() => {
    if (!test || allowed !== true) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          void submit("normal");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [test, allowed, submit]);

  // Anti-cheat listeners
  useEffect(() => {
    if (!test || allowed !== true) return;

    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, 800);

    const onFsChange = () => {
      if (!armed) return;
      if (!document.fullscreenElement) void submit("auto-violation", "Exited full-screen mode");
    };
    const onVisibility = () => {
      if (!armed) return;
      if (document.visibilityState === "hidden") void submit("auto-violation", "Tab switched or browser hidden");
    };
    const onBlur = () => {
      if (!armed) return;
      void submit("auto-violation", "Window lost focus");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
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

  if (allowed === false) return <Navigate to="/mock-tests/$testId/warning" params={{ testId }} />;
  if (!test || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const q = questions[currentIdx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const lowTime = remaining <= 30;
  const currentCode = codes[q.id] ?? q.starterCode;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Mock Test · PY Kidda</p>
            <p className="font-semibold leading-tight">{test.name}</p>
          </div>
          <div
            className={`px-4 py-2 rounded-md font-mono text-lg font-bold tabular-nums ${
              lowTime ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-foreground"
            }`}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-6 grid lg:grid-cols-[1fr_240px] gap-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question <strong className="text-foreground">{currentIdx + 1}</strong> of {questions.length}
            </span>
            <span className="text-muted-foreground">Marks: {q.marks}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug">{q.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{q.prompt}</p>

          <div className="mt-5 rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)]">
            <div className="border-b border-white/10 px-3 py-2 text-xs font-mono uppercase tracking-widest opacity-70">
              solution.py
            </div>
            <textarea
              key={q.id}
              value={currentCode}
              onChange={(e) => setCodes((c) => ({ ...c, [q.id]: e.target.value }))}
              spellCheck={false}
              rows={16}
              className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none"
              style={{ tabSize: 4 }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  const next = currentCode.slice(0, s) + "    " + currentCode.slice(el.selectionEnd);
                  setCodes((c) => ({ ...c, [q.id]: next }));
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = s + 4;
                  });
                }
              }}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => setCodes((c) => ({ ...c, [q.id]: q.starterCode }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              Reset
            </button>
            <div className="ml-auto flex gap-2">
              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Save &amp; Next →
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm("Submit your test now? Your code will be graded.")) void submit("normal");
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

        <aside className="rounded-xl border border-border bg-card p-4 h-fit">
          <p className="text-sm font-semibold">Question Navigator</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((qq, i) => {
              const touched = (codes[qq.id] ?? qq.starterCode) !== qq.starterCode;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-9 w-full rounded text-sm font-semibold border ${
                    touched ? "bg-accent border-accent text-accent-foreground" : "bg-background border-border"
                  } ${isCurrent ? "ring-2 ring-ring" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (confirm("Submit your test now? Your code will be graded.")) void submit("normal");
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

      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-xl border border-border bg-card px-8 py-6 text-center shadow-[var(--shadow-warm)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="mt-4 font-semibold">{gradeMsg}</p>
            <p className="mt-1 text-sm text-muted-foreground">Running your code through Python — don't close this tab.</p>
          </div>
        </div>
      )}
    </div>
  );
}

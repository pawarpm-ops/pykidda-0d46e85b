// AI mock test — take page. Loads sanitized questions, enforces fullscreen + visibility
// anti-cheat, grades code questions client-side with Pyodide, submits to server.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStudentAiTest, submitAiMockAttempt } from "@/lib/ai-mock.functions";
import { loadPyodideOnce, outputsMatch, runPython } from "@/lib/pyodide-runner";
import { recordStreakActivity } from "@/lib/streaks";

export const Route = createFileRoute("/mock-tests/ai/$testId/take")({
  head: () => ({ meta: [{ title: "AI Mock Test" }, { name: "robots", content: "noindex" }] }),
  component: TakeAiMock,
  ssr: false,
});

type QType = "mcq" | "tf" | "fill" | "short" | "code";
type Q = {
  id: string;
  order_index: number;
  type: QType;
  prompt: string;
  options: string[];
  starter_code: string;
  code_tests: { stdin: string; expected: string }[];
  marks: number;
};
type Test = { id: string; title: string; description: string; duration_sec: number; total_marks: number; question_count: number };

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TakeAiMock() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getStudentAiTest);
  const submitFn = useServerFn(submitAiMockAttempt);

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const [remaining, setRemaining] = useState(0);
  const startedAtRef = useRef(0);
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [runOutput, setRunOutput] = useState<string>("");
  const questionsRef = useRef<Q[]>([]);
  questionsRef.current = questions;

  useEffect(() => {
    (async () => {
      try {
        const { test, questions: qs } = await getFn({ data: { id: testId } });
        setTest(test as Test);
        setQuestions(qs as Q[]);
        setRemaining((test as Test).duration_sec);
        const seed: Record<string, string> = {};
        for (const q of qs as Q[]) seed[q.id] = q.type === "code" ? q.starter_code : "";
        setAnswers(seed);
        loadPyodideOnce().catch(() => {});
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, [getFn, testId]);

  const submit = useCallback(
    async (submission_type: "normal" | "auto-violation" = "normal", violation_reason?: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

      // Grade code questions in the browser
      const graded: Array<{ question_id: string; response: string; code_passed?: number; code_total?: number }> = [];
      const currentAnswers = answersRef.current;
      for (const q of questionsRef.current) {
        const response = currentAnswers[q.id] ?? "";
        if (q.type === "code") {
          let passed = 0;
          const total = q.code_tests.length;
          for (const tc of q.code_tests) {
            // eslint-disable-next-line no-await-in-loop
            const r = await runPython(response || q.starter_code, tc.stdin ?? "");
            if (r.ok && outputsMatch(r.stdout, tc.expected)) passed++;
          }
          graded.push({ question_id: q.id, response, code_passed: passed, code_total: total });
        } else {
          graded.push({ question_id: q.id, response });
        }
      }

      const timeTaken = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      try {
        const res = await submitFn({
          data: {
            test_id: testId,
            submission_type,
            violation_reason,
            time_taken_sec: timeTaken,
            answers: graded,
          },
        });
        void recordStreakActivity("mock_test_attempted", testId);
        sessionStorage.setItem(`pykidda:ai-mock-result:${res.attempt_id}`, JSON.stringify(res));
        navigate({ to: "/mock-tests/ai/$testId/result", params: { testId }, search: { attempt: res.attempt_id } });
      } catch (e) {
        alert("Submit failed: " + (e as Error).message);
        submittedRef.current = false;
        setSubmitting(false);
      }
    },
    [navigate, submitFn, testId],
  );

  // Timer
  useEffect(() => {
    if (!started || !test) return;
    const iv = window.setInterval(() => {
      const el = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      const rem = Math.max(0, test.duration_sec - el);
      setRemaining(rem);
      if (rem <= 0) void submit("normal");
    }, 1000);
    return () => window.clearInterval(iv);
  }, [started, test, submit]);

  // Anti-cheat
  useEffect(() => {
    if (!started) return;
    const auto = (r: string) => { if (!submittedRef.current) void submit("auto-violation", r); };
    const onFs = () => { if (!document.fullscreenElement) auto("Exited fullscreen"); };
    const onVis = () => { if (document.visibilityState === "hidden") auto("Tab switched or minimized"); };
    const onBlur = () => auto("Window lost focus");
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [started, submit]);

  const beginTest = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      alert("Please allow fullscreen to start.");
      return;
    }
    startedAtRef.current = Date.now();
    setStarted(true);
  };

  const runCurrentCode = async () => {
    const q = questions[current];
    if (!q || q.type !== "code") return;
    const code = answers[q.id] ?? q.starter_code;
    setRunOutput("Running…");
    const results: string[] = [];
    for (const tc of q.code_tests) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runPython(code, tc.stdin ?? "");
      const ok = r.ok && outputsMatch(r.stdout, tc.expected);
      results.push(`${ok ? "✓" : "✗"} stdin=${JSON.stringify(tc.stdin)} → ${ok ? "pass" : `expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(r.stdout)}${r.stderr ? " · err: " + r.stderr.slice(0, 200) : ""}`}`);
    }
    setRunOutput(results.join("\n"));
  };

  if (loadError) return <div className="p-10 text-center"><p className="text-destructive">{loadError}</p></div>;
  if (!test) return <div className="p-10 text-center">Loading test…</div>;

  if (!started) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
          <div className="text-5xl">🐍</div>
          <h1 className="mt-3 text-2xl font-bold">{test.title}</h1>
          <p className="mt-2 text-muted-foreground text-sm">{test.description}</p>
          <ul className="mt-5 text-left text-sm space-y-2 text-muted-foreground">
            <li>⏱️ Duration: <b className="text-foreground">{Math.round(test.duration_sec / 60)} minutes</b></li>
            <li>📝 Questions: <b className="text-foreground">{test.question_count}</b> · Total marks: <b className="text-foreground">{test.total_marks}</b></li>
            <li>🖥️ Runs in fullscreen. Exiting, switching tabs or reloading <b className="text-destructive">auto-submits</b>.</li>
          </ul>
          <button
            onClick={beginTest}
            className="mt-6 w-full rounded-md py-3 font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            🚀 Start test in fullscreen
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{test.title}</p>
          <p className="text-sm font-semibold">Q{current + 1} of {questions.length} · {q.marks} marks</p>
        </div>
        <div className={`font-mono text-xl font-bold tabular-nums ${remaining < 60 ? "text-destructive" : ""}`}>⏱ {fmt(remaining)}</div>
        <button
          onClick={() => { if (confirm("Submit test now?")) void submit("normal"); }}
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Submit
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex flex-wrap gap-1 mb-4">
          {questions.map((qq, i) => {
            const ans = answers[qq.id];
            const filled = qq.type === "code" ? ans && ans.trim() !== qq.starter_code.trim() : !!ans;
            return (
              <button
                key={qq.id}
                onClick={() => setCurrent(i)}
                className={`w-9 h-9 rounded text-xs font-semibold ${i === current ? "bg-accent text-accent-foreground" : filled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-accent font-semibold">
            {q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / False" : q.type === "fill" ? "Fill in the blank" : q.type === "short" ? "Short answer" : "Coding"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base">{q.prompt}</p>

          {q.type === "mcq" && (
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-secondary cursor-pointer">
                  <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "tf" && (
            <div className="mt-4 flex gap-3">
              {(["True", "False"] as const).map((v) => (
                <label key={v} className="flex-1 rounded-md border border-border p-4 text-center font-semibold hover:bg-secondary cursor-pointer">
                  <input type="radio" className="mr-2" name={`q-${q.id}`} checked={answers[q.id] === v} onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                  {v}
                </label>
              ))}
            </div>
          )}
          {(q.type === "fill" || q.type === "short") && (
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              rows={q.type === "short" ? 5 : 2}
              className="mt-4 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Type your answer…"
            />
          )}
          {q.type === "code" && (
            <div className="mt-4">
              <textarea
                value={answers[q.id] ?? q.starter_code}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={14}
                spellCheck={false}
                className="w-full rounded-md border border-border bg-[oklch(0.15_0.02_250)] text-[oklch(0.95_0.02_150)] font-mono text-sm p-3"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={runCurrentCode} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">▶ Run against sample tests</button>
                <button onClick={() => setAnswers((a) => ({ ...a, [q.id]: q.starter_code }))} className="rounded-md border border-border px-3 py-1.5 text-sm">Reset</button>
              </div>
              {runOutput && (
                <pre className="mt-3 whitespace-pre-wrap rounded-md bg-secondary p-3 text-xs">{runOutput}</pre>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setRunOutput(""); }} disabled={current === 0} className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-30">← Previous</button>
          <button onClick={() => { setCurrent((c) => Math.min(questions.length - 1, c + 1)); setRunOutput(""); }} disabled={current === questions.length - 1} className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-30">Next →</button>
        </div>
      </div>

      {submitting && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl animate-pulse">🐍</div>
            <p className="mt-3 font-semibold">Grading your test…</p>
          </div>
        </div>
      )}
    </div>
  );
}

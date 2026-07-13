import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { CodeQuestion } from "@/lib/questions";
import { loadPyodideOnce, outputsMatch, runPython } from "@/lib/pyodide-runner";
import { explainAndFix } from "@/lib/ai-feedback.functions";
import { PythonCodeEditor } from "@/components/PythonCodeEditor";


export type RunOutcome = {
  code: string;
  results: { passed: boolean; expected: string; actual: string; stderr: string; label?: string; stdin?: string }[];
  passedCount: number;
  totalCount: number;
};

type Props = {
  question: CodeQuestion;
  initialCode?: string;
  onChangeCode?: (code: string) => void;
  onSubmit?: (outcome: RunOutcome) => void;
  submitLabel?: string;
  allowHint?: boolean;
  allowSolution?: boolean;
  compact?: boolean;
};

export function CodeRunner({
  question,
  initialCode,
  onChangeCode,
  onSubmit,
  submitLabel = "Submit",
  allowHint = false,
  allowSolution = false,
  compact = false,
}: Props) {
  const [code, setCode] = useState(initialCode ?? question.starterCode);
  const [busy, setBusy] = useState(false);
  const [pyReady, setPyReady] = useState(false);
  const [pyError, setPyError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ explanation: string; fixedCode: string } | null>(null);
  const explainFn = useServerFn(explainAndFix);
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    let mounted = true;
    loadPyodideOnce()
      .then(() => mounted && setPyReady(true))
      .catch((e) => mounted && setPyError(e instanceof Error ? e.message : String(e)));
    return () => {
      mounted = false;
    };
  }, []);

  const setAndEmit = useCallback(
    (next: string) => {
      setCode(next);
      onChangeCode?.(next);
    },
    [onChangeCode],
  );

  const runAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    setAiResult(null);
    setAiError(null);
    try {
      // Ensure runtime is loaded; this resolves immediately if already ready.
      await loadPyodideOnce();
      setPyReady(true);
    } catch (e) {
      setPyError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      return null;
    }
    const results: RunOutcome["results"] = [];
    let passedCount = 0;
    for (const tc of question.tests) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runPython(codeRef.current, tc.stdin ?? "");
      const passed = r.ok && outputsMatch(r.stdout, tc.expected);
      if (passed) passedCount++;
      results.push({
        passed,
        expected: tc.expected,
        actual: r.stdout,
        stderr: r.stderr,
        label: tc.label,
        stdin: tc.stdin ?? "",
      });
    }
    const out: RunOutcome = {
      code: codeRef.current,
      results,
      passedCount,
      totalCount: question.tests.length,
    };
    setOutcome(out);
    setBusy(false);
    return out;
  }, [busy, question.tests]);

  const handleSubmit = useCallback(async () => {
    const out = await runAll();
    if (out && onSubmit) onSubmit(out);
  }, [runAll, onSubmit]);

  const handleExplain = useCallback(async () => {
    if (!outcome) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const failing = outcome.results
        .filter((r) => !r.passed)
        .slice(0, 5)
        .map((r) => ({ stdin: r.stdin ?? "", expected: r.expected, actual: r.actual, stderr: r.stderr }));
      const res = await explainFn({
        data: {
          title: question.title,
          prompt: question.prompt,
          userCode: codeRef.current,
          referenceSolution: question.solution,
          failingTests: failing,
        },
      });
      setAiResult(res);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }, [outcome, explainFn, question.title, question.prompt, question.solution]);

  const applyFix = useCallback(() => {
    if (!aiResult) return;
    setAndEmit(aiResult.fixedCode);
  }, [aiResult, setAndEmit]);

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <div>
          <h2 className="text-xl font-semibold leading-snug">{question.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{question.prompt}</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)] shadow-inner">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
          <span className="font-mono uppercase tracking-widest opacity-70">solution.py</span>
          <span className="opacity-60">
            {pyError ? "Python: error" : pyReady ? "Python: ready" : "Python: loading… (first run ~10s)"}
          </span>
        </div>
        <PythonCodeEditor
          value={code}
          onChange={setAndEmit}
          rows={compact ? 12 : 16}
          className="px-1 py-1"
        />

      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runAll}
          disabled={busy}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? (pyReady ? "Running…" : "Loading Python…") : "Run Tests"}
        </button>
        {onSubmit && (
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {busy ? "Working…" : submitLabel}
          </button>
        )}
        {allowHint && (
          <button
            onClick={() => setShowHint((v) => !v)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {showHint ? "Hide hint" : "Show hint"}
          </button>
        )}
        {allowSolution && (
          <button
            onClick={() => setShowSolution((v) => !v)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {showSolution ? "Hide solution" : "Show solution"}
          </button>
        )}
      </div>

      {showHint && (
        <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
          <strong>Hint:</strong> {question.hint}
        </div>
      )}
      {showSolution && (
        <pre className="overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{question.solution}
        </pre>
      )}

      {pyError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load Python runtime: {pyError}
        </div>
      )}

      {outcome && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              Tests passed: <span className="tabular-nums">{outcome.passedCount}/{outcome.totalCount}</span>
            </p>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {outcome.results.map((r, i) => (
              <li
                key={i}
                className={`rounded border p-2 ${
                  r.passed
                    ? "border-[oklch(0.65_0.15_145)]/40 bg-[oklch(0.65_0.15_145)]/10"
                    : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Test {i + 1}{r.label ? ` · ${r.label}` : ""}</span>
                  <span className={r.passed ? "text-[oklch(0.45_0.15_145)]" : "text-destructive"}>
                    {r.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
                {!r.passed && (
                  <div className="mt-2 grid gap-1 font-mono text-xs">
                    <div>
                      <span className="text-muted-foreground">expected: </span>
                      <pre className="inline whitespace-pre-wrap">{r.expected || "(empty)"}</pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">your output: </span>
                      <pre className="inline whitespace-pre-wrap">{r.actual || "(empty)"}</pre>
                    </div>
                    {r.stderr && (
                      <div className="text-destructive">
                        <span className="text-muted-foreground">stderr: </span>
                        <pre className="inline whitespace-pre-wrap">{r.stderr}</pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {outcome.passedCount < outcome.totalCount && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExplain}
                  disabled={aiBusy}
                  className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
                >
                  {aiBusy ? "Analyzing…" : aiResult ? "Re-analyze" : "💡 Know what's wrong"}
                </button>
                {aiResult && (
                  <button
                    onClick={applyFix}
                    className="rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                    style={{ backgroundImage: "var(--gradient-sunrise)" }}
                  >
                    🔧 Fix this
                  </button>
                )}
              </div>
              {aiError && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {aiError}
                </div>
              )}
              {aiResult && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
                    <p className="mb-1 font-semibold">What went wrong</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{aiResult.explanation}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Suggested fix (click "Fix this" to apply)
                    </p>
                    <pre className="overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{aiResult.fixedCode}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { CodeQuestion } from "@/lib/questions";
import {
  cancelPython,
  loadPyodideOnce,
  outputsMatch,
  runPython,
} from "@/lib/pyodide-runner";
import { explainAndFix, type AiFeedback } from "@/lib/ai-feedback.functions";
import { PythonCodeEditor } from "@/components/PythonCodeEditor";


export type RunOutcome = {
  code: string;
  results: { passed: boolean; expected: string; actual: string; stderr: string; label?: string; stdin?: string; reason?: string }[];
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

// Simple hash so we can cache AI explanations per (code + failing-test signature).
function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return String(h >>> 0);
}

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
  const [aiResult, setAiResult] = useState<AiFeedback | null>(null);
  const aiCacheRef = useRef<Map<string, AiFeedback>>(new Map());
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
      // Clear AI panel when the student edits code.
      setAiResult(null);
      setAiError(null);
    },
    [onChangeCode],
  );

  const stoppedRef = useRef(false);


  const runAll = useCallback(async () => {
    if (busy) return;
    stoppedRef.current = false;
    setBusy(true);
    setOutcome(null);
    setAiResult(null);
    setAiError(null);
    try {
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
      if (stoppedRef.current) break;
      // eslint-disable-next-line no-await-in-loop
      const r = await runPython(codeRef.current, tc.stdin ?? "", {
        timeoutMs: 8000,
      });
      const passed = r.ok && outputsMatch(r.stdout, tc.expected);
      if (passed) passedCount++;
      results.push({
        passed,
        expected: tc.expected,
        actual: r.stdout,
        stderr: r.stderr,
        label: tc.label,
        stdin: tc.stdin ?? "",
        reason: r.reason,
      });
      if (r.reason === "stopped") {
        stoppedRef.current = true;
        break;
      }
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

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    cancelPython();
  }, []);

  const handleSubmit = useCallback(async () => {
    const out = await runAll();
    if (out && onSubmit) onSubmit(out);
  }, [runAll, onSubmit]);

  // Cache key for this exact code + failing test signature.
  const aiCacheKey = useMemo(() => {
    if (!outcome) return null;
    const failing = outcome.results.filter((r) => !r.passed);
    if (failing.length === 0) return null;
    const sig = failing
      .slice(0, 5)
      .map((r) => `${r.reason ?? ""}|${r.stdin ?? ""}|${r.expected}|${r.actual}|${r.stderr}`)
      .join("§");
    return hashKey(outcome.code + "\n---\n" + sig);
  }, [outcome]);

  const handleExplain = useCallback(async () => {
    if (!outcome || !aiCacheKey) return;
    const cached = aiCacheRef.current.get(aiCacheKey);
    if (cached) {
      setAiResult(cached);
      setAiError(null);
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const failing = outcome.results
        .filter((r) => !r.passed)
        .slice(0, 5)
        .map((r) => ({
          stdin: r.stdin ?? "",
          expected: r.expected,
          actual: r.actual,
          stderr: r.stderr,
          reason: r.reason ?? "",
        }));
      const res = await explainFn({
        data: {
          title: question.title,
          prompt: question.prompt,
          userCode: outcome.code,
          referenceSolution: question.solution,
          failingTests: failing,
        },
      });
      aiCacheRef.current.set(aiCacheKey, res);
      setAiResult(res);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }, [outcome, aiCacheKey, explainFn, question.title, question.prompt, question.solution]);

  // Only offer AI help for genuine code errors (not Pyodide load failures).
  const canExplain = !!outcome && outcome.passedCount < outcome.totalCount && !pyError;

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
        {busy && (
          <button
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-destructive" />
            Stop Execution
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
                    {r.reason === "output_limit" && (
                      <div className="not-italic font-sans rounded border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                        <span className="inline-block rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white mr-2">Output Limit Exceeded</span>
                        Your program printed too much output (limit: 200 lines / 10,000 chars). Please check your loop or reduce print statements.
                      </div>
                    )}
                    {r.reason === "timeout" && (
                      <div className="not-italic font-sans rounded border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                        <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white mr-2">Time Limit Exceeded</span>
                        Your code took too long to run. Check for infinite loops.
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">expected: </span>
                      <pre className="inline whitespace-pre-wrap">{r.expected || "(empty)"}</pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">your output: </span>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">{r.actual || "(empty)"}</pre>
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

          {canExplain && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExplain}
                  disabled={aiBusy}
                  aria-busy={aiBusy}
                  className="group relative inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-gradient-to-r from-accent/15 via-primary/10 to-accent/15 px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100 disabled:opacity-60 disabled:hover:scale-100"
                >
                  <span aria-hidden className="text-base">✨</span>
                  <span>{aiBusy ? "AI is examining your code…" : aiResult ? "Re-explain with AI" : "Explain Error with AI"}</span>
                  {aiBusy && (
                    <span className="ml-1 inline-flex gap-0.5" aria-hidden>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                    </span>
                  )}
                </button>
              </div>

              <div aria-live="polite" className="sr-only">
                {aiBusy ? "AI is examining your code" : aiError ? `Error: ${aiError}` : aiResult ? "AI explanation ready" : ""}
              </div>

              {aiError && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {aiError}
                </div>
              )}

              {aiResult && !aiBusy && (
                <AiTutorPanel result={aiResult} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiTutorPanel({ result }: { result: AiFeedback }) {
  return (
    <section
      aria-label="AI tutor explanation"
      className="mt-4 overflow-hidden rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/5 via-background to-primary/5 shadow-md transition-transform duration-300 motion-reduce:transition-none animate-in fade-in zoom-in-95"
    >
      <header className="flex items-center gap-2 border-b border-accent/20 bg-accent/10 px-4 py-2.5">
        <span aria-hidden className="text-lg">🤖</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent-foreground">AI Tutor</h3>
        <span className="ml-auto rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          {result.errorTypeFriendly || result.errorType}
        </span>
      </header>

      <div className="space-y-4 p-4 text-sm leading-relaxed">
        {(result.whereLine || result.whereSnippet) && (
          <Section title="📍 Where it happened">
            <p>
              {result.whereLine != null && (
                <>Likely around <strong>line {String(result.whereLine)}</strong>. </>
              )}
            </p>
            {result.whereSnippet && (
              <pre className="mt-1 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-2 font-mono text-xs text-[oklch(0.97_0.005_85)]">{result.whereSnippet}</pre>
            )}
          </Section>
        )}

        <Section title="💬 What Python is telling you">
          <p className="whitespace-pre-wrap">{result.pythonSays}</p>
        </Section>

        <Section title="🧠 Why it happened">
          <p className="whitespace-pre-wrap">{result.whyItHappened}</p>
        </Section>

        {result.howToFix?.length > 0 && (
          <Section title="🛠️ How to correct it">
            <ol className="ml-5 list-decimal space-y-1">
              {result.howToFix.map((step, i) => (
                <li key={i} className="whitespace-pre-wrap">{step}</li>
              ))}
            </ol>
          </Section>
        )}

        {result.miniExample && result.miniExample.trim() && (
          <Section title="📘 Small example">
            <pre className="overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 font-mono text-xs text-[oklch(0.97_0.005_85)]">{result.miniExample}</pre>
          </Section>
        )}

        <Section title="➡️ Try this next">
          <p className="whitespace-pre-wrap">{result.tryThisNext}</p>
        </Section>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group rounded-md border border-border/60 bg-card/60 p-3">
      <summary className="cursor-pointer list-none font-semibold text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
        {title}
      </summary>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </details>
  );
}

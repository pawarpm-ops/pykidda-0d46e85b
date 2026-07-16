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

type Correction = AiFeedback["corrections"][number];



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
  // Snapshot of the exact code sent to the AI — used to detect stale suggestions
  // and to safely apply corrections at the right line numbers.
  const [aiSnapshot, setAiSnapshot] = useState<string | null>(null);
  const [correctorDismissed, setCorrectorDismissed] = useState(false);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [popup, setPopup] = useState<"success" | "fail" | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiCacheRef = useRef<Map<string, { result: AiFeedback; snapshot: string }>>(new Map());
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
      setAiSnapshot(null);
      setCorrectorDismissed(false);
      setApplyNotice(null);
    },
    [onChangeCode],
  );

  // Programmatic setter used by "Accept" — updates the editor without wiping
  // the AI panel so the student still sees the explanation next to the diff.
  const setCodeInternal = useCallback(
    (next: string) => {
      setCode(next);
      codeRef.current = next;
      onChangeCode?.(next);
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
    setAiSnapshot(null);
    setCorrectorDismissed(false);
    setApplyNotice(null);

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

  const handleRunAndSubmit = useCallback(async () => {
    const out = await runAll();
    if (!out) return;
    if (onSubmit) onSubmit(out);
    const solved = out.passedCount === out.totalCount && out.totalCount > 0;
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup(solved ? "success" : "fail");
    popupTimerRef.current = setTimeout(
      () => setPopup(null),
      solved ? 2000 : 2500,
    );
  }, [runAll, onSubmit]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);



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
    setCorrectorDismissed(false);
    setApplyNotice(null);
    const cached = aiCacheRef.current.get(aiCacheKey);
    if (cached) {
      setAiResult(cached.result);
      setAiSnapshot(cached.snapshot);
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
      const snapshot = outcome.code;
      const res = await explainFn({
        data: {
          title: question.title,
          prompt: question.prompt,
          userCode: snapshot,
          referenceSolution: question.solution,
          failingTests: failing,
        },
      });
      aiCacheRef.current.set(aiCacheKey, { result: res, snapshot });
      setAiResult(res);
      setAiSnapshot(snapshot);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }, [outcome, aiCacheKey, explainFn, question.title, question.prompt, question.solution]);

  const correctionsFresh = useMemo(() => {
    if (!aiResult || aiSnapshot == null) return false;
    if (code !== aiSnapshot) return false;
    const lines = code.split("\n");
    return aiResult.corrections.every((c) => {
      if (c.startLine < 1 || c.endLine > lines.length || c.endLine < c.startLine) return false;
      return lines.slice(c.startLine - 1, c.endLine).join("\n") === c.originalCode;
    });
  }, [aiResult, aiSnapshot, code]);

  const applyCorrections = useCallback((): string | null => {
    if (!aiResult || aiSnapshot == null) return null;
    if (code !== aiSnapshot) {
      setApplyNotice("Your code changed after this suggestion was created. Run it again to get an updated correction.");
      return null;
    }
    const sorted = [...aiResult.corrections].sort((a, b) => b.startLine - a.startLine);
    let lines = code.split("\n");
    let applied = 0;
    for (const c of sorted) {
      if (c.startLine < 1 || c.endLine > lines.length || c.endLine < c.startLine) continue;
      const actual = lines.slice(c.startLine - 1, c.endLine).join("\n");
      if (actual !== c.originalCode) continue;
      const replacement = c.replacementCode.split("\n");
      lines = [...lines.slice(0, c.startLine - 1), ...replacement, ...lines.slice(c.endLine)];
      applied++;
    }
    if (applied === 0) {
      setApplyNotice("Your code changed after this suggestion was created. Run it again to get an updated correction.");
      return null;
    }
    const next = lines.join("\n");
    setCodeInternal(next);
    setApplyNotice(`Applied ${applied} AI correction${applied === 1 ? "" : "s"} to your code.`);
    return next;
  }, [aiResult, aiSnapshot, code, setCodeInternal]);

  const handleAccept = useCallback(() => {
    applyCorrections();
  }, [applyCorrections]);

  const handleAcceptAndRun = useCallback(async () => {
    const next = applyCorrections();
    if (next == null) return;
    setAiResult(null);
    setAiError(null);
    setAiSnapshot(null);
    await runAll();
  }, [applyCorrections, runAll]);

  const handleCancelCorrector = useCallback(() => {
    setCorrectorDismissed(true);
    setApplyNotice(null);
  }, []);

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
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
              onClick={handleRunAndSubmit}
              disabled={busy}
              className="rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50 hover:bg-accent/20"
            >
              {busy ? (pyReady ? "Running…" : "Loading Python…") : submitLabel ? `Run Tests & ${submitLabel}` : "Run Tests"}
            </button>
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
        </div>

        <div className="flex flex-col rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)] shadow-inner min-h-[280px]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
            <span className="font-mono uppercase tracking-widest opacity-70">output</span>
            {outcome && (
              <span className="opacity-70 tabular-nums">
                {outcome.passedCount}/{outcome.totalCount} passed
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 font-mono text-xs">
            {busy && !outcome && (
              <div className="opacity-70">Running your code…</div>
            )}
            {!busy && !outcome && (
              <div className="opacity-60">
                Click <span className="font-semibold">Run Tests</span> to execute your code. Output for each test case will appear here.
              </div>
            )}
            {outcome && (
              <div className="space-y-3">
                {outcome.results.map((r, i) => (
                  <div key={i} className="rounded border border-white/10 bg-white/5 p-2">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold">
                        {r.label ?? `Test ${i + 1}`}
                      </span>
                      <span className={r.passed ? "text-emerald-400" : "text-red-400"}>
                        {r.passed ? "✓ passed" : "✗ failed"}
                      </span>
                    </div>
                    {r.stdin && (
                      <div className="mb-1">
                        <div className="opacity-60">stdin:</div>
                        <pre className="whitespace-pre-wrap break-words">{r.stdin}</pre>
                      </div>
                    )}
                    <div className="mb-1">
                      <div className="opacity-60">your output:</div>
                      <pre className="whitespace-pre-wrap break-words">{r.actual || <span className="opacity-50">(no output)</span>}</pre>
                    </div>
                    {!r.passed && (
                      <div className="mb-1">
                        <div className="opacity-60">expected:</div>
                        <pre className="whitespace-pre-wrap break-words text-emerald-300">{r.expected}</pre>
                      </div>
                    )}
                    {r.stderr && (
                      <div>
                        <div className="opacity-60">error:</div>
                        <pre className="whitespace-pre-wrap break-words text-red-300">{r.stderr}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

          {canExplain && (
            <div className="mt-4">
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
                {aiBusy
                  ? "AI is examining your code"
                  : aiError
                    ? `Error: ${aiError}`
                    : applyNotice
                      ? applyNotice
                      : aiResult
                        ? "AI explanation ready"
                        : ""}
              </div>

              {aiError && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {aiError}
                </div>
              )}

              {aiResult && !aiBusy && (
                <AiTutorPanel
                  result={aiResult}
                  snapshot={aiSnapshot}
                  currentCode={code}
                  correctorDismissed={correctorDismissed}
                  correctionsFresh={correctionsFresh}
                  applyNotice={applyNotice}
                  busy={busy}
                  failingTests={outcome.results.filter((r) => !r.passed)}
                  onAccept={handleAccept}
                  onAcceptRun={handleAcceptAndRun}
                  onCancel={handleCancelCorrector}
                />
              )}
            </div>
          )}

          {(() => {
            const limitHit = outcome.results.find((r) => r.reason === "output_limit");
            const timeoutHit = outcome.results.find((r) => r.reason === "timeout");
            if (!limitHit && !timeoutHit) return null;
            return (
              <div className={`${canExplain ? "mt-4 border-t border-border pt-4" : "mt-3"} space-y-2 text-sm`}>
                {limitHit && (
                  <div className="rounded border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                    <span className="inline-block rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white mr-2">Output Limit Exceeded</span>
                    Your program printed too much output (limit: 200 lines / 10,000 chars). Please check your loop or reduce print statements.
                  </div>
                )}
                {timeoutHit && (
                  <div className="rounded border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                    <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white mr-2">Time Limit Exceeded</span>
                    Your code took too long to run. Check for infinite loops.
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}

type FailingTest = RunOutcome["results"][number];

function AiTutorPanel({
  result,
  snapshot,
  currentCode,
  correctorDismissed,
  correctionsFresh,
  applyNotice,
  busy,
  failingTests,
  onAccept,
  onAcceptRun,
  onCancel,
}: {
  result: AiFeedback;
  snapshot: string | null;
  currentCode: string;
  correctorDismissed: boolean;
  correctionsFresh: boolean;
  applyNotice: string | null;
  busy: boolean;
  failingTests: FailingTest[];
  onAccept: () => void;
  onAcceptRun: () => void;
  onCancel: () => void;
}) {
  const showCorrector =
    !correctorDismissed && result.corrections && result.corrections.length > 0;
  const isStale = snapshot != null && currentCode !== snapshot;

  // Deduplicate identical tracebacks across failing tests.
  const dedupedTracebacks = useMemo(() => {
    const seen = new Set<string>();
    const out: { text: string; label?: string }[] = [];
    for (const t of failingTests) {
      const key = (t.stderr || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ text: t.stderr, label: t.label });
    }
    return out;
  }, [failingTests]);

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
        {showCorrector && (
          <AiCorrector
            corrections={result.corrections}
            isStale={isStale}
            correctionsFresh={correctionsFresh}
            applyNotice={applyNotice}
            busy={busy}
            onAccept={onAccept}
            onAcceptRun={onAcceptRun}
            onCancel={onCancel}
          />
        )}

        {dedupedTracebacks.length > 0 && (
          <details className="group rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <summary className="cursor-pointer list-none font-semibold text-destructive marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded">
              ⚠️ Error details {dedupedTracebacks.length > 1 ? `(${dedupedTracebacks.length})` : ""}
            </summary>
            <div className="mt-2 space-y-2">
              {dedupedTracebacks.map((t, i) => (
                <TracebackBlock key={i} text={t.text} label={t.label} />
              ))}
            </div>
          </details>
        )}

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

function TracebackBlock({ text, label }: { text: string; label?: string }) {
  // Highlight the exception name in red inline while preserving whitespace.
  const lines = text.split("\n");
  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>}
      <pre className="overflow-auto rounded-md border border-destructive/30 bg-[oklch(0.18_0.02_250)] p-2 font-mono text-xs leading-relaxed text-[oklch(0.97_0.005_85)]">
{lines.map((ln, i) => {
  const m = ln.match(/^([A-Z][A-Za-z_]*Error|Exception|Warning|SyntaxError|IndentationError)(:.*)?$/);
  if (m) {
    return (
      <div key={i}>
        <span className="font-bold text-red-400">{m[1]}</span>
        {m[2] && <span className="text-red-300">{m[2]}</span>}
      </div>
    );
  }
  return <div key={i}>{ln || "\u00A0"}</div>;
})}
      </pre>
    </div>
  );
}

function AiCorrector({
  corrections,
  isStale,
  correctionsFresh,
  applyNotice,
  busy,
  onAccept,
  onAcceptRun,
  onCancel,
}: {
  corrections: Correction[];
  isStale: boolean;
  correctionsFresh: boolean;
  applyNotice: string | null;
  busy: boolean;
  onAccept: () => void;
  onAcceptRun: () => void;
  onCancel: () => void;
}) {
  const disabled = busy || isStale || !correctionsFresh;
  return (
    <section
      aria-label="AI Corrector"
      className="overflow-hidden rounded-lg border border-primary/40 bg-card/80 shadow-sm motion-reduce:transition-none animate-in fade-in"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-primary/5 px-3 py-2">
        <span aria-hidden className="text-base">✨</span>
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">AI Corrector</h4>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
          {corrections.length} suggestion{corrections.length === 1 ? "" : "s"}
        </span>
        {isStale && (
          <span className="ml-auto rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            stale — code changed
          </span>
        )}
      </header>

      <div className="space-y-3 p-3">
        {corrections.map((c, i) => (
          <CorrectionDiff key={i} correction={c} />
        ))}

        {applyNotice && (
          <div
            role="status"
            className={`rounded-md border px-3 py-2 text-xs ${
              applyNotice.startsWith("Applied")
                ? "border-[oklch(0.65_0.15_145)]/40 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.45_0.15_145)]"
                : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {applyNotice}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={onAccept}
            disabled={disabled}
            aria-label="Accept the AI corrections and apply them to the editor"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[oklch(0.65_0.15_145)]/50 bg-[oklch(0.65_0.15_145)]/10 px-3 py-2 text-sm font-semibold text-[oklch(0.35_0.15_145)] transition-colors hover:bg-[oklch(0.65_0.15_145)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.15_145)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[oklch(0.85_0.15_145)]"
          >
            ✓ Accept
          </button>
          <button
            type="button"
            onClick={onAcceptRun}
            disabled={disabled}
            aria-label="Accept the AI corrections and immediately run the tests"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            ▶ Accept &amp; Run
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Dismiss the AI corrections without changing your code"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

const CONFIDENCE_STYLES: Record<Correction["confidence"], string> = {
  high: "border-[oklch(0.65_0.15_145)]/50 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.35_0.15_145)] dark:text-[oklch(0.85_0.15_145)]",
  medium: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-muted-foreground/40 bg-muted/40 text-muted-foreground",
};

function CorrectionDiff({ correction }: { correction: Correction }) {
  const originalLines = correction.originalCode.split("\n");
  const replacementLines = correction.replacementCode.split("\n");
  const rangeLabel =
    correction.startLine === correction.endLine
      ? `Line ${correction.startLine}`
      : `Lines ${correction.startLine}–${correction.endLine}`;
  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-background/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-semibold text-foreground">Suggested correction · {rangeLabel}</span>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_STYLES[correction.confidence]}`}
        >
          {correction.confidence} confidence
        </span>
      </div>
      <div className="overflow-x-auto font-mono text-xs leading-relaxed">
        {originalLines.map((ln, i) => (
          <DiffRow key={`o-${i}`} kind="del" lineNo={correction.startLine + i} text={ln} />
        ))}
        {replacementLines.map((ln, i) => (
          <DiffRow key={`n-${i}`} kind="add" lineNo={correction.startLine + i} text={ln} />
        ))}
      </div>
      {correction.explanation && (
        <p className="border-t border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          {correction.explanation}
        </p>
      )}
    </div>
  );
}

function DiffRow({
  kind,
  lineNo,
  text,
}: {
  kind: "del" | "add";
  lineNo: number;
  text: string;
}) {
  const isDel = kind === "del";
  return (
    <div
      className={`flex items-start gap-0 whitespace-pre ${
        isDel
          ? "bg-red-500/15 text-red-900 dark:bg-red-500/20 dark:text-red-100"
          : "bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100"
      }`}
    >
      <span
        aria-hidden
        className={`select-none border-r border-border/40 px-2 py-0.5 text-right tabular-nums ${
          isDel ? "text-red-700/70 dark:text-red-300/70" : "text-emerald-700/70 dark:text-emerald-300/70"
        }`}
        style={{ minWidth: "3ch" }}
      >
        {lineNo}
      </span>
      <span
        aria-hidden
        className={`select-none px-2 py-0.5 font-bold ${
          isDel ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {isDel ? "−" : "+"}
      </span>
      <span className="py-0.5 pr-3">{text || "\u00A0"}</span>
      <span className="sr-only">{isDel ? "removed line" : "added line"}</span>
    </div>
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

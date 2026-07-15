import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { explainAndFix, type AiFeedback } from "@/lib/ai-feedback.functions";

type Correction = AiFeedback["corrections"][number];

type FailingTest = {
  stdin?: string;
  expected: string;
  actual: string;
  stderr?: string;
};

type Props = {
  title: string;
  prompt: string;
  userCode: string;
  referenceSolution: string;
  failingTests: FailingTest[];
};

const CONFIDENCE_STYLES: Record<Correction["confidence"], string> = {
  high: "border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/10 text-[oklch(0.55_0.16_145)]",
  medium: "border-accent/40 bg-accent/10 text-accent-foreground",
  low: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function MockAiCorrector({
  title,
  prompt,
  userCode,
  referenceSolution,
  failingTests,
}: Props) {
  const explainFn = useServerFn(explainAndFix);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AiFeedback | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await explainFn({
        data: {
          title: title.slice(0, 500),
          prompt: prompt.slice(0, 4000),
          userCode: (userCode || "").slice(0, 20000),
          referenceSolution: (referenceSolution || "").slice(0, 20000),
          failingTests: failingTests.slice(0, 5).map((t) => ({
            stdin: t.stdin ?? "",
            expected: t.expected ?? "",
            actual: t.actual ?? "",
            stderr: t.stderr ?? "",
            reason: "",
          })),
        },
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI feedback failed");
    } finally {
      setBusy(false);
    }
  };

  if (!result) {
    return (
      <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-foreground">
              ✨ AI Mistake Explainer
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Get a personalized explanation of what went wrong and how to fix it.
            </p>
          </div>
          <button
            onClick={run}
            disabled={busy || !userCode.trim()}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {busy ? "Analyzing…" : "Explain my mistake"}
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-foreground">
          ✨ AI Explanation · {result.errorTypeFriendly}
        </p>
        <button
          onClick={run}
          disabled={busy}
          className="text-[11px] underline text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {busy ? "…" : "Re-analyze"}
        </button>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">What Python says</p>
        <p className="mt-1 text-xs whitespace-pre-wrap">{result.pythonSays}</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Why it happened</p>
        <p className="mt-1 text-xs whitespace-pre-wrap">{result.whyItHappened}</p>
      </div>

      {result.howToFix.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How to fix</p>
          <ol className="mt-1 list-decimal list-inside space-y-0.5 text-xs">
            {result.howToFix.map((s, i) => (
              <li key={i} className="whitespace-pre-wrap">{s}</li>
            ))}
          </ol>
        </div>
      )}

      {result.corrections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Suggested corrections ({result.corrections.length})
          </p>
          {result.corrections.map((c, i) => (
            <div key={i} className="rounded border border-border bg-card p-2">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span>
                  {c.startLine === c.endLine ? `Line ${c.startLine}` : `Lines ${c.startLine}–${c.endLine}`}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${CONFIDENCE_STYLES[c.confidence]}`}>
                  {c.confidence}
                </span>
              </div>
              <pre className="mt-1 overflow-auto rounded bg-destructive/10 border border-destructive/30 p-1.5 text-[11px] whitespace-pre-wrap">
{c.originalCode.split("\n").map((ln) => `- ${ln}`).join("\n")}
              </pre>
              <pre className="mt-1 overflow-auto rounded bg-[oklch(0.65_0.16_145)]/10 border border-[oklch(0.65_0.16_145)]/30 p-1.5 text-[11px] whitespace-pre-wrap">
{c.replacementCode.split("\n").map((ln) => `+ ${ln}`).join("\n")}
              </pre>
              {c.explanation && (
                <p className="mt-1 text-[11px] text-muted-foreground">{c.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {result.tryThisNext && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Try this next</p>
          <p className="mt-1 text-xs whitespace-pre-wrap">{result.tryThisNext}</p>
        </div>
      )}
    </div>
  );
}

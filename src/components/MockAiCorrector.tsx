import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { explainAndFix, type AiFeedback } from "@/lib/ai-feedback.functions";

type Correction = AiFeedback["corrections"][number];

type FailingTest = {
  stdin?: string;
  expected: string;
  actual: string;
  stderr?: string;
  label?: string;
};

type Props = {
  title: string;
  prompt: string;
  userCode: string;
  referenceSolution: string;
  failingTests: FailingTest[];
};

const CONFIDENCE_STYLES: Record<Correction["confidence"], string> = {
  high: "border-[oklch(0.65_0.15_145)]/50 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.35_0.15_145)] dark:text-[oklch(0.85_0.15_145)]",
  medium: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-muted-foreground/40 bg-muted/40 text-muted-foreground",
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

  const dedupedTracebacks = (() => {
    const seen = new Set<string>();
    const out: { text: string; label?: string }[] = [];
    for (const t of failingTests) {
      const key = (t.stderr || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ text: t.stderr!, label: t.label });
    }
    return out;
  })();

  return (
    <section
      aria-label="AI tutor explanation"
      className="mt-4 overflow-hidden rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/5 via-background to-primary/5 shadow-md motion-reduce:transition-none animate-in fade-in zoom-in-95"
    >
      <header className="flex items-center gap-2 border-b border-accent/20 bg-accent/10 px-4 py-2.5">
        <span aria-hidden className="text-lg">🤖</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent-foreground">AI Tutor</h3>
        <span className="ml-auto rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          {result.errorTypeFriendly || result.errorType}
        </span>
        <button
          onClick={run}
          disabled={busy}
          className="text-[11px] underline text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {busy ? "…" : "Re-analyze"}
        </button>
      </header>

      <div className="space-y-4 p-4 text-sm leading-relaxed">
        {result.corrections.length > 0 && (
          <ReviewCorrector corrections={result.corrections} />
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
            {result.whereLine != null && (
              <p>Likely around <strong>line {String(result.whereLine)}</strong>.</p>
            )}
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

        {result.tryThisNext && (
          <Section title="➡️ Try this next">
            <p className="whitespace-pre-wrap">{result.tryThisNext}</p>
          </Section>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ReviewCorrector({ corrections }: { corrections: Correction[] }) {
  return (
    <section
      aria-label="AI Corrector"
      className="overflow-hidden rounded-lg border border-primary/40 bg-card/80 shadow-sm animate-in fade-in"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-primary/5 px-3 py-2">
        <span aria-hidden className="text-base">✨</span>
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">AI Corrector</h4>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
          {corrections.length} suggestion{corrections.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="space-y-3 p-3">
        {corrections.map((c, i) => (
          <CorrectionDiff key={i} correction={c} />
        ))}
      </div>
    </section>
  );
}

function CorrectionDiff({ correction }: { correction: Correction }) {
  const originalLines = useMemo(() => correction.originalCode.split("\n"), [correction.originalCode]);
  const replacementLines = useMemo(() => correction.replacementCode.split("\n"), [correction.replacementCode]);
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

function DiffRow({ kind, lineNo, text }: { kind: "del" | "add"; lineNo: number; text: string }) {
  const isDel = kind === "del";
  return (
    <div
      className={`flex items-start gap-0 whitespace-pre ${
        isDel
          ? "bg-red-500/15 text-red-900 dark:bg-red-500/20 dark:text-red-100"
          : "bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100"
      }`}
    >
      <span aria-hidden className="select-none px-2 text-muted-foreground/70">{isDel ? "-" : "+"}</span>
      <span className="select-none pr-2 text-muted-foreground/60 tabular-nums">{lineNo}</span>
      <span className="pr-3">{text || "\u00A0"}</span>
    </div>
  );
}

function TracebackBlock({ text, label }: { text: string; label?: string }) {
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

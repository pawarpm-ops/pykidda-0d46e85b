import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMockTest, getQuestion } from "@/lib/questions";
import { loadResult, type AttemptResult, type QuestionAttempt } from "@/lib/test-session";

export const Route = createFileRoute("/mock-tests/$testId/result")({
  head: () => ({
    meta: [
      { title: "Result · PY Kidda Mock Test" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultPage,
  ssr: false,
  notFoundComponent: () => <div className="p-10">Result not found.</div>,
  errorComponent: () => <div className="p-10">Something went wrong.</div>,
});

function ResultPage() {
  const { testId } = Route.useParams();
  const test = getMockTest(testId);
  const [r, setR] = useState<AttemptResult | null>(null);

  useEffect(() => {
    setR(loadResult());
  }, []);

  if (!test) return <div className="p-10">Test not found.</div>;
  if (!r) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground">No result data found. Please take the test from the start.</p>
          <Link to="/mock-tests" className="underline mt-3 inline-block">Back to mock tests</Link>
        </div>
      </div>
    );
  }

  const auto = r.submissionType === "auto-violation";
  const mins = Math.floor(r.timeTakenSec / 60);
  const secs = r.timeTakenSec % 60;

  const isFullyCorrect = (a: QuestionAttempt) => a.total > 0 && a.passed === a.total;
  const correct = r.attempts.filter(isFullyCorrect);
  const incorrect = r.attempts.filter((a) => !isFullyCorrect(a));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold">← PY Kidda</Link>
          <span className="text-sm text-muted-foreground">Result</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {auto && (
          <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 text-foreground p-4">
            <p className="font-semibold text-destructive">Auto-submitted due to violation</p>
            <p className="text-sm mt-1">
              Your test was auto-submitted because you left the full-screen environment. Reason:{" "}
              <strong>{r.violationReason ?? "Unknown"}</strong>.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-warm)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-accent font-semibold">Result</p>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{r.testName}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Student: <strong className="text-foreground">{r.studentName}</strong>
              </p>
            </div>
            <div className="text-right">
              <div
                className="inline-flex items-baseline gap-2 rounded-lg px-4 py-2 text-primary-foreground"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                <span className="text-3xl font-bold tabular-nums">{r.percentage}%</span>
                <span className="text-sm opacity-90">Grade {r.grade}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {r.marksObtained} / {r.totalMarks} marks · {mins}m {secs}s
              </p>
            </div>
          </div>
        </div>

        <AnswerTabs correct={correct} incorrect={incorrect} all={r.attempts} />

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/mock-tests"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Take another mock test
          </Link>
          <Link
            to="/practice"
            className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium"
          >
            Go to practice
          </Link>
        </div>
      </main>
    </div>
  );
}

type TabKey = "correct" | "incorrect" | "key";

function AnswerTabs({ correct, incorrect, all }: { correct: QuestionAttempt[]; incorrect: QuestionAttempt[]; all: QuestionAttempt[] }) {
  const [tab, setTab] = useState<TabKey>("correct");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "correct", label: "Correct Questions", count: correct.length },
    { key: "incorrect", label: "Incorrect Questions", count: incorrect.length },
    { key: "key", label: "Answer Key", count: all.length },
  ];

  const list = tab === "correct" ? correct : tab === "incorrect" ? incorrect : all;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-md border-b-2 transition ${
              tab === t.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground text-center py-8">
          {tab === "correct" ? "No fully-correct answers yet." : tab === "incorrect" ? "No incorrect answers — great job!" : "No questions."}
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {list.map((a) => {
            const origIdx = all.indexOf(a);
            return <AttemptCard key={a.questionId} attempt={a} index={origIdx} tab={tab} />;
          })}
        </ol>
      )}
    </section>
  );
}

function AttemptCard({ attempt: a, index, tab }: { attempt: QuestionAttempt; index: number; tab: TabKey }) {
  const q = getQuestion(a.questionId);
  const allPassed = a.total > 0 && a.passed === a.total;

  return (
    <li
      className={`rounded-xl border-l-4 border border-border bg-card p-4 ${
        tab === "key"
          ? "border-l-primary"
          : allPassed
            ? "border-l-[oklch(0.65_0.16_145)]"
            : "border-l-destructive"
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-semibold text-sm">
          Q{index + 1}
          <span className="ml-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">CODE</span>
          <span className="ml-2 text-muted-foreground font-normal">
            · {a.marksObtained}/{a.marksTotal} marks · {a.passed}/{a.total} tests
          </span>
        </p>
        <span className={`text-xs font-bold ${allPassed ? "text-[oklch(0.55_0.16_145)]" : a.passed > 0 ? "text-accent-foreground" : "text-destructive"}`}>
          {allPassed ? "✓ Correct" : a.passed > 0 ? "◐ Partial" : "✗ Incorrect"}
        </span>
      </div>

      {/* Question */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Question</p>
        <p className="mt-1 text-sm font-medium">{q?.title ?? a.questionId}</p>
        {q?.prompt && (
          <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{q.prompt}</p>
        )}
      </div>

      {/* Your code */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your code</p>
        <pre className="mt-1 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{a.code || "(no code submitted)"}
        </pre>
      </div>

      {/* Test case results */}
      {a.results.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Test cases</p>
          {a.results.map((tr, i) => (
            <div
              key={i}
              className={`rounded border p-2 text-xs ${
                tr.passed
                  ? "border-[oklch(0.65_0.15_145)]/40 bg-[oklch(0.65_0.15_145)]/5"
                  : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span>Test {i + 1}</span>
                <span>{tr.passed ? "PASS" : "FAIL"}</span>
              </div>
              {!tr.passed && (
                <div className="mt-1 font-mono">
                  <div><span className="text-muted-foreground">expected:</span> <pre className="inline whitespace-pre-wrap">{tr.expected}</pre></div>
                  <div><span className="text-muted-foreground">got:</span> <pre className="inline whitespace-pre-wrap">{tr.actual}</pre></div>
                  {tr.stderr && (
                    <div className="text-destructive"><span className="text-muted-foreground">stderr:</span> <pre className="inline whitespace-pre-wrap">{tr.stderr}</pre></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Answer key (hint + reference solution) */}
      {q && (tab === "key" || !allPassed) && (
        <div className="mt-4 rounded-md border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/5 p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.16_145)]">🔑 Answer key</p>
          {q.hint && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Hint</p>
              <p className="mt-1 text-xs whitespace-pre-wrap">{q.hint}</p>
            </div>
          )}
          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Reference solution</p>
            <pre className="mt-1 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{q.solution}
            </pre>
          </div>
        </div>
      )}
    </li>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMockTest, getQuestion } from "@/lib/questions";
import { loadResult, type AttemptResult } from "@/lib/test-session";

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

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Per-question breakdown</h2>
          <ol className="mt-4 space-y-3">
            {r.attempts.map((a, idx) => {
              const q = getQuestion(a.questionId);
              const allPassed = a.passed === a.total && a.total > 0;
              return (
                <li key={a.questionId} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        <span className="text-muted-foreground mr-2">Q{idx + 1}.</span>
                        {q?.title ?? a.questionId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tests passed: <strong className="text-foreground">{a.passed}/{a.total}</strong> · Marks:{" "}
                        <strong className="text-foreground">{a.marksObtained}/{a.marksTotal}</strong>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                        allPassed
                          ? "bg-[oklch(0.65_0.15_145)]/15 text-[oklch(0.4_0.15_145)]"
                          : a.passed > 0
                            ? "bg-accent/20 text-accent-foreground"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {allPassed ? "All pass" : a.passed > 0 ? "Partial" : "Failed"}
                    </span>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-accent">
                      Show your code
                    </summary>
                    <pre className="mt-2 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{a.code}
                    </pre>
                    <div className="mt-3 space-y-2">
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
                  </details>

                  {q && (
                    <details className="group mt-4 rounded-xl border-2 border-accent/60 bg-accent/10 p-4 shadow-[var(--shadow-warm)]">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wider text-yellow-300 shadow-[var(--shadow-warm)] transition hover:opacity-95"
                          style={{ backgroundImage: "var(--gradient-sunrise)" }}
                        >
                          <span aria-hidden>🔑</span> Show answer key
                        </span>
                        <span className="text-xs font-semibold text-yellow-400 dark:text-yellow-300 transition group-open:rotate-180">▼</span>
                      </summary>
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Problem</p>
                          <p className="mt-1 text-sm whitespace-pre-wrap">{q.prompt}</p>
                        </div>
                        {q.hint && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Hint</p>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{q.hint}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reference solution</p>
                          <pre className="mt-1 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-3 text-xs text-[oklch(0.97_0.005_85)]">
{q.solution}
                          </pre>
                        </div>
                      </div>
                    </details>
                  )}


                </li>
              );
            })}
          </ol>
        </section>

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

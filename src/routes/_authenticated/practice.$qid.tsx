import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeRunner, type RunOutcome } from "@/components/CodeRunner";
import { QUESTIONS } from "@/lib/questions";
import { submitPracticeAttempt } from "@/lib/practice-attempts.functions";
import { recordDailyStreakVisit } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/practice/$qid")({
  head: () => ({
    meta: [
      { title: "Practice · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeSolvePage,
  ssr: false,
});

function PracticeSolvePage() {
  const { qid } = Route.useParams();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitPracticeAttempt);

  const question = useMemo(() => QUESTIONS.find((q) => q.id === qid), [qid]);

  const handleSubmit = useCallback(
    async (outcome: RunOutcome) => {
      if (!question) return;
      try {
        await submitFn({
          data: {
            questionId: question.id,
            unit: question.unit,
            passed: outcome.passedCount,
            total: outcome.totalCount,
            solved:
              outcome.passedCount === outcome.totalCount && outcome.totalCount > 0,
          },
        });
      } catch (e) {
        console.error("[practice] submit failed", e);
      }
    },
    [question, submitFn],
  );

  if (!question) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">Question not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This practice question doesn't exist.
          </p>
          <button
            onClick={() => navigate({ to: "/practice" })}
            className="mt-6 rounded-md border border-border bg-card px-4 py-2 text-sm hover:border-accent/60"
          >
            ← Back to practice
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/practice"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-accent/60"
          >
            ← All practice questions
          </Link>
          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-semibold">
            Unit {question.unit} · {question.marks} marks
          </span>
        </div>

        <CodeRunner
          question={question}
          onSubmit={handleSubmit}
          submitLabel="Submit attempt"
          allowHint
          allowSolution
        />
      </main>
    </div>
  );
}

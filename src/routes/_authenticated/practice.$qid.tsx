import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeRunner, type RunOutcome } from "@/components/CodeRunner";
import type { CodeQuestion } from "@/lib/questions";
import { submitPracticeAttempt } from "@/lib/practice-attempts.functions";
import { getPublishedPracticeQuestion } from "@/lib/practice-admin.functions";
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
  const fetchDb = useServerFn(getPublishedPracticeQuestion);

  const isDb = qid.startsWith("db-");
  const dbId = isDb ? qid.slice(3) : "";

  const { data: dbRow, isLoading } = useQuery({
    queryKey: ["practice-db-question", dbId],
    queryFn: () => fetchDb({ data: { id: dbId } }),
    enabled: isDb,
  });

  const question: CodeQuestion | undefined = useMemo(() => {
    if (isDb) {
      if (!dbRow) return undefined;
      type Row = {
        id: string;
        unit: number;
        title: string;
        prompt: string;
        starter_code: string | null;
        tests: unknown;
        hint: string | null;
        solution: string | null;
        marks: number;
      };
      const r = dbRow as Row;
      const tests = Array.isArray(r.tests)
        ? (r.tests as Array<{ stdin?: string; expected: string; label?: string }>).map((t) => ({
            stdin: t.stdin ?? "",
            expected: t.expected ?? "",
            label: t.label,
          }))
        : [];
      return {
        id: qid,
        unit: r.unit,
        title: r.title,
        prompt: r.prompt,
        starterCode: r.starter_code ?? "",
        tests,
        hint: r.hint ?? "",
        solution: r.solution ?? "",
        marks: r.marks,
      };
    }
    return undefined;
  }, [qid, isDb, dbRow]);

  useEffect(() => {
    if (!question) return;
    void recordDailyStreakVisit("practice_opened", question.id);
  }, [question]);

  const handleSubmit = useCallback(
    async (outcome: RunOutcome) => {
      if (!question) return;
      const solved =
        outcome.passedCount === outcome.totalCount && outcome.totalCount > 0;
      try {
        await submitFn({
          data: {
            questionId: question.id,
            unit: question.unit,
            passed: outcome.passedCount,
            total: outcome.totalCount,
            solved,
          },
        });
        if (solved) {
          toast.success("Attempt submitted 🎉", {
            description: `Solved with ${outcome.passedCount}/${outcome.totalCount} tests passing.`,
          });
        } else {
          toast("Attempt saved", {
            description: `${outcome.passedCount}/${outcome.totalCount} tests passed. Keep trying!`,
          });
        }
      } catch (e) {
        console.error("[practice] submit failed", e);
        toast.error("Could not submit attempt", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      }
    },
    [question, submitFn],
  );


  if (isDb && isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Loading question…</p>
        </main>
      </div>
    );
  }

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

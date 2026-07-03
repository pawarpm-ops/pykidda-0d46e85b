import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeRunner } from "@/components/CodeRunner";
import { getQuestion } from "@/lib/questions";
import { supabase } from "@/integrations/supabase/client";
import { recordPracticeAttempt } from "@/lib/progress";
import { syncMyScore } from "@/lib/leaderboard";
import { recordStreakActivity } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/practice/$qid")({
  head: () => ({
    meta: [
      { title: "Solve · PY Kidda Practice" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SolvePage,
  ssr: false,
});

function SolvePage() {
  const { qid } = Route.useParams();
  const q = getQuestion(qid);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  if (!q) return <Navigate to="/practice" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link to="/practice" className="text-sm text-muted-foreground hover:text-accent">
          ← Back to all questions
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-accent font-semibold">
            Unit {q.unit}
          </span>
          <span className="text-xs text-muted-foreground">· {q.marks} marks</span>
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">{q.title}</h1>
        <p className="mt-2 text-muted-foreground whitespace-pre-line">{q.prompt}</p>

        <div className="mt-6">
          <CodeRunner
            question={q}
            allowHint
            allowSolution
            submitLabel="Submit & Record"
            onSubmit={(out) => {
              recordPracticeAttempt(userId, q.id, out.passedCount, out.totalCount);
              void syncMyScore();
              if (out.passedCount === out.totalCount && out.totalCount > 0) {
                void recordStreakActivity("practice_question_solved", q.id);
              }
            }}
          />
        </div>
      </main>
    </div>
  );
}

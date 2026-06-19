import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeRunner } from "@/components/CodeRunner";
import { getQuestion, type Difficulty } from "@/lib/questions";
import { supabase } from "@/integrations/supabase/client";
import { recordPracticeAttempt } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/practice/$difficulty/$qid")({
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
  const { difficulty, qid } = Route.useParams();
  const q = getQuestion(qid);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  if (!q) return <Navigate to="/practice" />;
  const d = difficulty as Difficulty;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">

        <Link to="/practice/$difficulty" params={{ difficulty: d }} className="text-sm text-muted-foreground hover:text-accent">
          ← Back to {d} questions
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {q.difficulty}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Unit {q.unit}
          </span>
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">{q.title}</h1>
        <p className="mt-2 text-muted-foreground">{q.prompt}</p>

        <div className="mt-6">
          <CodeRunner
            question={q}
            allowHint
            allowSolution
            submitLabel="Submit & Record"
            onSubmit={(out) => recordPracticeAttempt(userId, q.id, out.passedCount, out.totalCount)}
          />
        </div>
      </main>
    </div>
  );
}

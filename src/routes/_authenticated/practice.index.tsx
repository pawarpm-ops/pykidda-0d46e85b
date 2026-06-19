import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { QUESTIONS } from "@/lib/questions";
import { supabase } from "@/integrations/supabase/client";
import { getProgress } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/practice/")({
  head: () => ({
    meta: [
      { title: "Practice · PY Kidda" },
      { name: "description", content: "Practice Python coding questions from the syllabus." },
    ],
  }),
  component: PracticeHome,
  ssr: false,
});

function PracticeHome() {
  const [solved, setSolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      const s = getProgress(uid);
      const set = new Set<string>();
      for (const a of s.practice) if (a.solved) set.add(a.questionId);
      setSolved(set);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Practice arena</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Syllabus questions</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          {QUESTIONS.length} Python problems straight from the SY MDM AI&amp;DS assignment syllabus. Solve them in any order — write code, run against tests, submit.
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          Solved <span className="font-bold text-foreground tabular-nums">{solved.size}</span> of {QUESTIONS.length}
        </p>

        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {QUESTIONS.map((q, i) => {
            const done = solved.has(q.id);
            return (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-widest text-accent font-semibold">Unit {q.unit}</span>
                    <span className="text-xs text-muted-foreground">· {q.marks} marks</span>
                    {done && (
                      <span className="rounded-full bg-[oklch(0.65_0.15_145)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[oklch(0.4_0.15_145)]">
                        ✓ Solved
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">
                    <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                    {q.title}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{q.prompt}</p>
                </div>
                <Link
                  to="/practice/$qid"
                  params={{ qid: q.id }}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Solve →
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

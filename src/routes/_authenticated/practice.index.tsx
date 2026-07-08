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

        {(() => {
          const total = QUESTIONS.length;
          const done = solved.size;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const complete = done === total && total > 0;
          return (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                    Your progress
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Solved{" "}
                    <span className="font-bold text-foreground tabular-nums">{done}</span> of{" "}
                    <span className="tabular-nums">{total}</span> questions
                    {complete && <span className="ml-2">🎉</span>}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="block text-3xl font-black tabular-nums leading-none bg-clip-text text-transparent"
                    style={{ backgroundImage: "var(--gradient-sunrise)" }}
                  >
                    {pct}%
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    complete
                  </span>
                </div>
              </div>

              <div
                className="mt-4 relative h-4 w-full overflow-hidden rounded-full bg-muted/60 ring-1 ring-inset ring-border"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Practice completion"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out relative overflow-hidden"
                  style={{
                    width: `${pct}%`,
                    backgroundImage: "var(--gradient-sunrise)",
                    boxShadow: "0 0 18px -2px color-mix(in oklab, var(--accent) 60%, transparent)",
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 opacity-60 animate-[shimmer_2.4s_linear_infinite]"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                <span>{done === 0 ? "Let's begin →" : "Keep going"}</span>
                <span className="tabular-nums">{total - done} left</span>
              </div>
            </div>
          );
        })()}

        <ul className="mt-6 grid gap-3">
          {QUESTIONS.map((q, i) => {
            const done = solved.has(q.id);
            return (
              <li key={q.id} className="card-glow flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
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

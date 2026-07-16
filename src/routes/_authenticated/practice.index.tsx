import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import type { CodeQuestion } from "@/lib/questions";
import { listPublishedPracticeQuestions } from "@/lib/practice-admin.functions";
import { recordStreakActivity } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/practice/")({
  head: () => ({
    meta: [
      { title: "Practice · PY Kidda" },
      {
        name: "description",
        content: "Practice Python questions in-browser — no submission, just learn.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeListPage,
  ssr: false,
});

type DbQ = {
  id: string;
  unit: number;
  title: string;
  prompt: string;
  starter_code: string;
  tests: unknown[];
  hint: string | null;
  solution: string | null;
  marks: number;
};

function PracticeListPage() {
  useEffect(() => {
    void recordStreakActivity("practice_opened");
  }, []);
  const listFn = useServerFn(listPublishedPracticeQuestions);
  const { data: dbQs } = useQuery({
    queryKey: ["practice-published"],
    queryFn: () => listFn() as Promise<DbQ[]>,
  });

  const grouped = useMemo(() => {
    const g = new Map<number, CodeQuestion[]>();
    for (const r of dbQs ?? []) {
      const testCount = Array.isArray(r.tests) ? r.tests.length : 0;
      const q: CodeQuestion = {
        id: `db-${r.id}`,
        unit: r.unit,
        title: r.title,
        prompt: r.prompt,
        starterCode: r.starter_code ?? "",
        tests: Array.from({ length: testCount }, () => ({ expected: "" })),
        hint: r.hint ?? "",
        solution: r.solution ?? "",
        marks: r.marks,
      };
      const arr = g.get(q.unit) ?? [];
      arr.push(q);
      g.set(q.unit, arr);
    }
    return Array.from(g.entries()).sort((a, b) => a[0] - b[0]);
  }, [dbQs]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <Link
            to="/homework"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary"
          >
            Homework
          </Link>
          <span
            className="rounded-md px-3 py-1.5 font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Practice
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice 🧠</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sharpen your Python skills — pick any question, run tests in-browser, learn at your own pace.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {grouped.map(([unit, qs]) => (
            <section key={unit}>
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <span className="inline-flex items-center rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1 text-sm font-bold text-foreground shadow-sm dark:bg-accent/25 dark:text-accent-foreground">
                  Unit {unit}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {qs.length} question{qs.length === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {qs.map((q) => (
                  <li key={q.id}>
                    <Link
                      to="/practice/$qid"
                      params={{ qid: q.id }}
                      className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                          {q.title}
                        </h3>
                        <span className="shrink-0 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold">
                          {q.marks} marks
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{q.prompt}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                          {q.tests.length} test{q.tests.length === 1 ? "" : "s"}
                        </span>
                        {q.id.startsWith("db-") && (
                          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                            AI
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

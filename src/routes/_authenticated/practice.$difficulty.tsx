import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { questionsByDifficulty, type Difficulty } from "@/lib/questions";

export const Route = createFileRoute("/_authenticated/practice/$difficulty")({
  head: () => ({
    meta: [
      { title: "Practice questions · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeList,
});

function PracticeList() {
  const { difficulty } = Route.useParams();
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return <Navigate to="/practice" />;
  }
  const d = difficulty as Difficulty;
  const qs = questionsByDifficulty(d);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/practice" className="text-sm text-muted-foreground hover:text-accent">
          ← All difficulties
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight capitalize">{d} questions</h1>
        <p className="mt-1 text-muted-foreground">{qs.length} problems · run code in your browser</p>

        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {qs.map((q, i) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-accent font-semibold">Unit {q.unit}</p>
                <p className="font-semibold">
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {q.title}
                </p>
                <p className="text-sm text-muted-foreground">{q.prompt}</p>
              </div>
              <Link
                to="/practice/$difficulty/$qid"
                params={{ difficulty: d, qid: q.id }}
                className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Solve →
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

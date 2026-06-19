import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { questionsByDifficulty } from "@/lib/questions";

export const Route = createFileRoute("/_authenticated/practice/")({
  head: () => ({
    meta: [
      { title: "Practice · PY Kidda" },
      { name: "description", content: "Practice Python by difficulty: easy, medium, hard." },
    ],
  }),
  component: PracticeHome,
});

const SECTIONS: Array<{
  difficulty: "easy" | "medium" | "hard";
  label: string;
  blurb: string;
  color: string;
}> = [
  { difficulty: "easy", label: "Easy", blurb: "Warm-up: syntax, I/O, basic loops & strings.", color: "oklch(0.65 0.15 145)" },
  { difficulty: "medium", label: "Medium", blurb: "Loops, conditionals, OOP basics, dictionaries.", color: "oklch(0.78 0.16 45)" },
  { difficulty: "hard", label: "Hard", blurb: "OOP hierarchies, algorithms, file & numeric processing.", color: "oklch(0.6 0.22 25)" },
];

function PracticeHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Practice arena</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Pick your difficulty</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          Write real Python. Run it in your browser against test cases. No grades, no pressure — just practice.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SECTIONS.map((s) => {
            const count = questionsByDifficulty(s.difficulty).length;
            return (
              <Link
                key={s.difficulty}
                to="/practice/$difficulty"
                params={{ difficulty: s.difficulty }}
                className="group rounded-2xl border border-border bg-card p-6 hover:border-accent transition-colors flex flex-col"
              >
                <span
                  className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground"
                  style={{ backgroundColor: s.color }}
                >
                  {s.label}
                </span>
                <h2 className="mt-4 text-xl font-bold">{s.label} problems</h2>
                <p className="mt-1 text-sm text-muted-foreground flex-1">{s.blurb}</p>
                <p className="mt-4 text-sm font-medium text-foreground group-hover:text-accent">
                  {count} questions →
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

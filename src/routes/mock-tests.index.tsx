import { createFileRoute, Link } from "@tanstack/react-router";
import { MOCK_TESTS } from "@/lib/mock-tests";

export const Route = createFileRoute("/mock-tests/")({
  head: () => ({
    meta: [
      { title: "Mock Tests · Python Practice Portal" },
      { name: "description", content: "Browse and start full-screen, anti-cheat-protected Python mock tests." },
    ],
  }),
  component: MockTestsList,
});

function MockTestsList() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold">← Portal</Link>
          <h1 className="text-sm font-medium text-muted-foreground">Mock Tests</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-3xl font-bold tracking-tight">Choose a mock test</h2>
        <p className="text-muted-foreground mt-2">
          Recommended on laptop/desktop. The test will open in full-screen mode and auto-submit if you exit.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {MOCK_TESTS.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
              <div className="text-xs font-semibold tracking-widest uppercase text-accent">
                {t.unit === "mixed" ? "Full Syllabus" : `Unit ${t.unit}`}
              </div>
              <h3 className="mt-2 font-semibold text-lg">{t.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground flex-1">{t.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t.questions.length} Qs · {Math.round(t.durationSec / 60)} min · {t.questions.reduce((a, q) => a + q.marks, 0)} marks
                </span>
                <Link
                  to="/mock-tests/$testId/warning"
                  params={{ testId: t.id }}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Start
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

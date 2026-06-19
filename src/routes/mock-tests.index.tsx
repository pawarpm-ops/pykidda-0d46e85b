import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { MOCK_TESTS, mockTestQuestions } from "@/lib/questions";

export const Route = createFileRoute("/mock-tests/")({
  head: () => ({
    meta: [
      { title: "Mock Tests · PY Kidda" },
      { name: "description", content: "Take secure full-screen Python coding mock tests on PY Kidda." },
    ],
  }),
  component: MockTestsList,
});

function MockTestsList() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Exam mode</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Choose a mock test</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Use a laptop or desktop. Tests run in full-screen mode and{" "}
          <strong className="text-foreground">auto-submit if you exit</strong> the test window. Each question is
          graded in your browser by running real Python against hidden test cases.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {MOCK_TESTS.map((t) => {
            const qs = mockTestQuestions(t);
            const marks = qs.reduce((a, q) => a + q.marks, 0);
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                <h3 className="font-semibold text-lg">{t.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground flex-1">{t.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {qs.length} Qs · {Math.round(t.durationSec / 60)} min · {marks} marks
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
            );
          })}
        </div>
      </main>
    </div>
  );
}

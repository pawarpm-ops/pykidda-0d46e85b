import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { MOCK_TESTS, UNITS, QUESTIONS } from "@/lib/questions";
import siddharthPhoto from "@/assets/siddharth.jpg.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PY Kidda — Be a PY Kidda with us" },
      { name: "description", content: "PY Kidda is a Python practice & mock test portal. Practice syllabus questions and take secure full-screen coding mock tests." },
      { property: "og:title", content: "PY Kidda — Be a PY Kidda with us" },
      { property: "og:description", content: "Practice Python syllabus questions and take secure coding mock tests. Powered by in-browser Python." },
    ],
  }),
  component: Index,
});

function Index() {
  const totalQ = QUESTIONS.length;
  const totalMarks = QUESTIONS.reduce((a, q) => a + q.marks, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "var(--gradient-sunrise)", filter: "blur(90px)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
            Python practice &amp; mock test portal
          </p>
          <h1 className="mt-4 text-5xl md:text-7xl font-black tracking-tight leading-[1.02]">
            Be a{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              PY Kidda
            </span>{" "}
            with us.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Write real Python in your browser. Work through the full syllabus question set. Then prove yourself in a secure,
            full-screen mock test that auto-submits if you wander off.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/practice"
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] hover:opacity-95 transition"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Start practicing →
            </Link>
            <Link
              to="/mock-tests"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold hover:border-accent transition"
            >
              Take a mock test
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <Link
          to="/practice"
          className="block rounded-2xl border border-border bg-card p-8 hover:border-accent transition-colors shadow-[var(--shadow-warm)]"
        >
          <span
            className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Practice
          </span>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">{totalQ} questions</p>
              <p className="text-sm text-muted-foreground">{totalMarks} marks total · straight from the syllabus</p>
            </div>
            <p className="text-sm font-semibold text-accent">Open the question list →</p>
          </div>
        </Link>
      </section>


      <section id="units" className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Six units, end-to-end</h2>
          <p className="text-muted-foreground mt-1">Aligned with the Python syllabus.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UNITS.map((u) => (
            <div key={u.id} className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs font-semibold tracking-widest text-accent uppercase">Unit {u.id}</div>
              <h3 className="mt-2 font-semibold text-lg">{u.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{u.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10 shadow-[var(--shadow-warm)]">
          <h2 className="text-2xl font-bold">Available mock tests</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each test opens in secure full-screen mode with anti-cheating monitoring. Code is graded in your browser
            against hidden test cases.
          </p>
          <ul className="mt-6 divide-y divide-border">
            {MOCK_TESTS.map((t) => (
              <li key={t.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.questionIds.length} coding questions · {Math.round(t.durationSec / 60)} min
                  </p>
                </div>
                <Link
                  to="/mock-tests/$testId/warning"
                  params={{ testId: t.id }}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:border-accent transition"
                >
                  Start →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        PY Kidda · Be a PY Kidda with us
      </footer>
    </div>
  );
}

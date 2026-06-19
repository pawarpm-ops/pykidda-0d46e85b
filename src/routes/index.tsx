import { createFileRoute, Link } from "@tanstack/react-router";
import { MOCK_TESTS, UNITS } from "@/lib/mock-tests";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Python Practice & Mock Test Portal" },
      { name: "description", content: "Practice Python and take secure full-screen mock tests across all six syllabus units." },
      { property: "og:title", content: "Python Practice & Mock Test Portal" },
      { property: "og:description", content: "Practice Python and take secure full-screen mock tests across all six syllabus units." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-10 bg-background/80">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg tracking-tight">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-sunrise)" }}>
              py.test
            </span>
            <span className="text-muted-foreground font-normal"> · portal</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/mock-tests" className="hover:text-accent transition-colors">Mock Tests</Link>
            <a href="#units" className="hover:text-accent transition-colors">Syllabus</a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "var(--gradient-sunrise)", filter: "blur(80px)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
            Python Practice &amp; Mock Test Portal
          </p>
          <h1 className="mt-4 text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">
            Master Python, one <span style={{ backgroundImage: "var(--gradient-sunrise)" }} className="bg-clip-text text-transparent">honest</span> attempt at a time.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Practice unit-wise, then take a secure full-screen mock test. Leave the test window and your attempt is submitted automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/mock-tests"
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] hover:opacity-95 transition"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Take a Mock Test →
            </Link>
            <a
              href="#units"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold hover:border-accent transition"
            >
              Browse Syllabus
            </a>
          </div>
        </div>
      </section>

      <section id="units" className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Six units, end-to-end</h2>
            <p className="text-muted-foreground mt-1">Aligned with the uploaded Python assignment syllabus.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UNITS.map((u) => (
            <div key={u.id} className="rounded-xl border border-border bg-card p-5 hover:border-accent transition-colors">
              <div className="text-xs font-semibold tracking-widest text-accent uppercase">Unit {u.id}</div>
              <h3 className="mt-2 font-semibold text-lg">{u.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{u.blurb}</p>
              <Link
                to="/mock-tests"
                className="mt-4 inline-block text-sm font-medium text-foreground hover:text-accent"
              >
                Find mock test →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10 shadow-[var(--shadow-warm)]">
          <h2 className="text-2xl font-bold">Available Mock Tests</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each test opens in secure full-screen mode with anti-cheating monitoring.
          </p>
          <ul className="mt-6 divide-y divide-border">
            {MOCK_TESTS.map((t) => (
              <li key={t.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.questions.length} questions · {Math.round(t.durationSec / 60)} min
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
        Python Practice &amp; Mock Test Portal · v1
      </footer>
    </div>
  );
}

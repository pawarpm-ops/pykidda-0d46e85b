import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { MOCK_TESTS, UNITS, QUESTIONS } from "@/lib/questions";
import siddharthPhoto from "@/assets/siddharth.jpg.asset.json";
import meenakshiPhoto from "@/assets/meenakshi.png.asset.json";
import prashantPhoto from "@/assets/prashant.png.asset.json";
import vaishnaviPhoto from "@/assets/vaishnavi.jpg.asset.json";
import { StreakCard } from "@/components/StreakCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    <div className="min-h-screen relative overflow-hidden bg-[#0b0720] text-white">
      {/* Animated gradient backdrop */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          background:
            "radial-gradient(1200px 700px at 10% 10%, #5b21b6 0%, transparent 60%), radial-gradient(900px 600px at 90% 80%, #7c3aed 0%, transparent 55%), radial-gradient(700px 500px at 50% 50%, #4338ca 0%, transparent 60%), linear-gradient(135deg, #1e0a3c 0%, #0b0720 100%)",
        }}
        aria-hidden
      />
      {/* Grid overlay */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.10] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
        aria-hidden
      />

      {/* Floating orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute top-[8%] left-[12%] h-28 w-28 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-2xl shadow-amber-500/40 animate-[float_7s_ease-in-out_infinite] opacity-70" />
        <div className="absolute top-[30%] right-[8%] h-20 w-20 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-2xl shadow-fuchsia-500/40 animate-[float_9s_ease-in-out_infinite_reverse] opacity-70" />
        <div className="absolute bottom-[18%] left-[6%] h-24 w-24 rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 shadow-2xl shadow-cyan-500/40 animate-[float_8s_ease-in-out_infinite] opacity-70" />
        <div className="absolute bottom-[8%] right-[14%] h-20 w-20 rounded-2xl rotate-12 bg-gradient-to-br from-pink-400 to-rose-600 shadow-2xl shadow-rose-500/40 animate-[float_10s_ease-in-out_infinite_reverse] opacity-70" />
        <div className="absolute top-[55%] left-[45%] h-12 w-12 rounded-full bg-gradient-to-br from-emerald-300 to-teal-600 shadow-2xl shadow-emerald-500/40 animate-[float_6s_ease-in-out_infinite] opacity-60" />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-22px) translateX(10px); }
        }
        @keyframes shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="relative z-10">
        <SiteHeader />

        {/* Hero */}
        <section className="relative">
          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24">
            {/* Creator card */}
            <div className="lg:absolute lg:right-6 lg:top-6 z-10 lg:w-[19rem] max-w-full mb-8 lg:mb-0">
              <div className="relative rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl p-4 shadow-2xl">
                <div
                  className="absolute -inset-0.5 rounded-2xl blur-xl opacity-40 -z-10"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)" }}
                  aria-hidden
                />
                <div className="flex items-center gap-3">
                  <img
                    src={siddharthPhoto.url}
                    alt="Siddharth Prashant Pawar — creator of PY Kidda"
                    className="h-14 w-14 rounded-full object-cover border-2 border-amber-400 shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">Crafted by</p>
                    <p className="font-bold leading-tight truncate text-white">Siddharth Prashant Pawar</p>
                    <p className="text-[11px] text-white/60">Creator of PY Kidda Hub</p>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-yellow-300 hover:border-amber-400 hover:bg-white/15 transition">
                    Know more
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-yellow-500 dark:text-yellow-300">About the creator</DialogTitle>
                      <DialogDescription className="pt-2 text-base text-foreground">
                        Hello everyone, I have developed this website for college students to help them practise coding languages and attempt highly secure mock tests with strong anti-cheating features.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                      <p className="font-semibold text-foreground">Siddharth Prashant Pawar</p>
                      <p className="text-muted-foreground">Contact: <a href="tel:9172504205" className="font-bold text-yellow-500 dark:text-yellow-300 hover:underline">9172504205</a></p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Python practice &amp; mock test portal
            </div>

            <h1
              className="mt-5 text-5xl md:text-7xl font-black tracking-tight leading-[1.02] bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ffffff 0%, #fcd34d 50%, #c4b5fd 100%)",
                backgroundSize: "200% auto",
                animation: "shine 6s linear infinite",
              }}
            >
              Be a PY Kidda with us.
            </h1>
            <p className="mt-6 text-lg text-white/75 max-w-2xl leading-relaxed">
              Write real Python in your browser. Work through the full syllabus question set. Then prove yourself in a secure,
              full-screen mock test that auto-submits if you wander off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/practice"
                className="group relative inline-flex overflow-hidden items-center justify-center rounded-xl px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  background: "linear-gradient(90deg, #fde047 0%, #f59e0b 50%, #fb923c 100%)",
                  boxShadow: "0 10px 30px -10px rgba(245,158,11,0.6)",
                }}
              >
                <span className="relative z-10">Start practicing →</span>
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
                />
              </Link>
              <Link
                to="/mock-tests"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 hover:border-white/40 transition"
              >
                Take a mock test
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Badge>🐍 {totalQ} Practice Qs</Badge>
              <Badge>⏱ Timed Mock Tests</Badge>
              <Badge>📊 Smart Analytics</Badge>
            </div>
          </div>
        </section>

        {/* Streak card */}
        <section className="mx-auto max-w-6xl px-6 pb-8">
          <StreakCard />
        </section>

        {/* Practice highlight card */}
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <Link to="/practice" className="block group">
            <div className="relative rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-2xl p-8 shadow-2xl transition hover:border-amber-400/40 hover:bg-white/[0.09]">
              <div
                className="absolute -inset-0.5 rounded-2xl blur-2xl opacity-0 group-hover:opacity-60 transition -z-10"
                style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)" }}
                aria-hidden
              />
              <span
                className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-900"
                style={{ background: "linear-gradient(90deg,#fde047,#f59e0b)" }}
              >
                Practice
              </span>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black tabular-nums text-white">{totalQ} questions</p>
                  <p className="text-sm text-white/65">{totalMarks} marks total · straight from the syllabus</p>
                </div>
                <p className="text-sm font-semibold text-yellow-300 group-hover:translate-x-1 transition-transform">Open the question list →</p>
              </div>
            </div>
          </Link>
        </section>

        {/* Units */}
        <section id="units" className="mx-auto max-w-6xl px-6 py-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Six units, end-to-end</h2>
            <p className="text-white/65 mt-2">Aligned with the Python syllabus.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UNITS.map((u, i) => (
              <div
                key={u.id}
                className="group relative rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-xl p-5 transition hover:border-white/30 hover:bg-white/[0.08] hover:-translate-y-1"
              >
                <div
                  className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-40 blur-md transition -z-10"
                  style={{
                    background: [
                      "linear-gradient(135deg,#fbbf24,#fb7185)",
                      "linear-gradient(135deg,#a78bfa,#22d3ee)",
                      "linear-gradient(135deg,#34d399,#60a5fa)",
                      "linear-gradient(135deg,#f472b6,#facc15)",
                      "linear-gradient(135deg,#60a5fa,#c084fc)",
                      "linear-gradient(135deg,#fb923c,#f43f5e)",
                    ][i % 6],
                  }}
                  aria-hidden
                />
                <div className="text-xs font-bold tracking-widest text-yellow-300 uppercase">Unit {u.id}</div>
                <h3 className="mt-2 font-bold text-lg text-white">{u.title}</h3>
                <p className="mt-2 text-sm text-white/65 leading-relaxed">{u.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mock tests */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="group relative rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-2xl p-8 md:p-10 shadow-2xl transition-all duration-500 hover:border-white/25">
            <div
              className="pointer-events-none absolute -inset-1 rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 -z-10"
              style={{ background: "linear-gradient(135deg,#f59e0b,#f97316,#fbbf24)" }}
              aria-hidden
            />
            <h2 className="text-2xl md:text-3xl font-black text-white">Available mock tests</h2>
            <p className="text-white/65 mt-2 text-sm">
              Each test opens in secure full-screen mode with anti-cheating monitoring. Code is graded in your browser
              against hidden test cases.
            </p>
            <ul className="mt-6 divide-y divide-white/10">
              {MOCK_TESTS.map((t) => (
                <li key={t.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="text-sm text-white/60">
                      {t.questionIds.length} coding questions · {Math.round(t.durationSec / 60)} min
                    </p>
                  </div>
                  <Link
                    to="/mock-tests/$testId/warning"
                    params={{ testId: t.id }}
                    className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 hover:border-amber-400 transition"
                  >
                    Start →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="border-t border-white/10 py-8 text-center text-xs text-white/50">
          PY Kidda · Be a PY Kidda with us · © Siddharth Prashant Pawar
        </footer>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur">
      {children}
    </span>
  );
}

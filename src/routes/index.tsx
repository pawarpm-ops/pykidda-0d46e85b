import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import siddharthPhoto from "@/assets/siddharth.jpg.asset.json";
import meenakshiPhoto from "@/assets/meenakshi.png.asset.json";
import prashantPhoto from "@/assets/prashant.png.asset.json";
import vaishnaviPhoto from "@/assets/vaishnavi.jpg.asset.json";

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
      {
        name: "description",
        content:
          "PY Kidda is a Python practice & mock test portal. Practice syllabus questions and take secure full-screen coding mock tests.",
      },
      { property: "og:title", content: "PY Kidda — Be a PY Kidda with us" },
      {
        property: "og:description",
        content:
          "Practice Python syllabus questions and take secure coding mock tests. Powered by in-browser Python.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-dvh relative overflow-hidden bg-background text-foreground dark:bg-[#0b0720] dark:text-white">
      {/* Dark-only animated gradient backdrop (hidden in light theme) */}
      <div
        className="fixed inset-0 -z-20 hidden dark:block"
        style={{
          background:
            "radial-gradient(1200px 700px at 10% 10%, #5b21b6 0%, transparent 60%), radial-gradient(900px 600px at 90% 80%, #7c3aed 0%, transparent 55%), radial-gradient(700px 500px at 50% 50%, #4338ca 0%, transparent 60%), linear-gradient(135deg, #1e0a3c 0%, #0b0720 100%)",
        }}
        aria-hidden
      />
      {/* Light-theme soft warm backdrop */}
      <div
        className="fixed inset-0 -z-20 block dark:hidden"
        style={{
          background:
            "radial-gradient(900px 500px at 10% 0%, oklch(0.95 0.08 55 / 0.55) 0%, transparent 60%), radial-gradient(700px 500px at 100% 100%, oklch(0.94 0.06 30 / 0.45) 0%, transparent 55%)",
        }}
        aria-hidden
      />
      {/* Subtle grid overlay — dark only */}
      <div
        className="fixed inset-0 -z-10 hidden dark:block opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
        aria-hidden
      />

      {/* Floating orbs — desktop dark only, restrained count */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden hidden md:dark:block"
        aria-hidden
      >
        <div className="absolute top-[10%] left-[10%] h-24 w-24 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-2xl shadow-amber-500/30 animate-[float_8s_ease-in-out_infinite] opacity-50" />
        <div className="absolute top-[30%] right-[8%] h-20 w-20 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-2xl shadow-fuchsia-500/30 animate-[float_10s_ease-in-out_infinite_reverse] opacity-50" />
        <div className="absolute bottom-[15%] left-[8%] h-20 w-20 rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 shadow-2xl shadow-cyan-500/30 animate-[float_9s_ease-in-out_infinite] opacity-50" />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-18px) translateX(8px); }
        }
        @keyframes shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pk-shine-anim { animation: none !important; background-position: 0 0 !important; }
        }
      `}</style>

      <div className="relative z-10">
        <SiteHeader />

        {/* Hero — compact, learning-first */}
        <section className="relative">
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-10 pb-8 sm:pb-12">
            <div className="grid gap-6 items-start">
              {/* Left: heading + CTAs */}
              <div className="min-w-0">
                <h1
                  className="pk-display mt-4 bg-clip-text text-transparent pk-shine-anim"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, oklch(0.35 0.05 260) 0%, oklch(0.55 0.18 45) 50%, oklch(0.45 0.14 290) 100%)",
                    backgroundSize: "200% auto",
                    animation: "shine 6s linear infinite",
                  }}
                >
                  <span className="dark:hidden">Be a PY Kidda with us.</span>
                  <span
                    className="hidden dark:inline bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, #ffffff 0%, #fcd34d 50%, #c4b5fd 100%)",
                      backgroundSize: "200% auto",
                    }}
                  >
                    Be a PY Kidda with us.
                  </span>
                </h1>

                <p className="mt-4 pk-body max-w-2xl text-muted-foreground dark:text-white/75">
                  Write real Python in your browser. Work through the full syllabus question set,
                  then prove yourself in a secure, full-screen mock test that auto-submits if you wander off.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/practice"
                    aria-label="Start practicing Python questions"
                    className="btn-glow pk-touch group relative inline-flex min-h-11 overflow-hidden items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-slate-900 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={{
                      background:
                        "linear-gradient(90deg, #fde047 0%, #f59e0b 50%, #fb923c 100%)",
                      boxShadow: "0 10px 30px -14px rgba(245,158,11,0.55)",
                    }}
                  >
                    <Rocket className="mr-2 h-4 w-4" aria-hidden />
                    <span className="relative z-10">Start practicing</span>
                  </Link>
                  <Link
                    to="/mock-tests"
                    aria-label="Browse and take a mock test"
                    className="pk-touch inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted transition dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    Take a mock test
                  </Link>
                </div>

              </div>

              {/* Creator card moved to bottom of page */}
            </div>
          </div>
        </section>

        <footer className="border-t border-border dark:border-white/10 py-8 pb-28 lg:pb-8 text-center text-xs text-muted-foreground dark:text-white/50">
          PY Kidda · Be a PY Kidda with us · © Siddharth Prashant Pawar
        </footer>
      </div>
    </div>
  );
}

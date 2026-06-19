import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { computeAnalytics, getProgress, clearProgress, type Analytics } from "@/lib/progress";
import { QUESTIONS } from "@/lib/questions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · PY Kidda" },
      { name: "description", content: "Track your Python practice and mock test progress." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
  ssr: false,
});

const UNIT_NAMES: Record<number, string> = {
  1: "Unit 1 · Python basics",
  2: "Unit 2 · Data types & I/O",
  3: "Unit 3 · Control flow & loops",
  4: "Unit 4 · Functions & strings",
  5: "Unit 5 · Collections",
  6: "Unit 6 · OOP & files",
};

function Bar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "accent" | "success" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bg =
    tone === "success"
      ? "bg-[oklch(0.65_0.15_145)]"
      : tone === "accent"
        ? "bg-accent"
        : "";
  return (
    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
      <div
        className={`h-full rounded-full ${bg}`}
        style={{
          width: `${pct}%`,
          backgroundImage: tone === "primary" ? "var(--gradient-sunrise)" : undefined,
        }}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setA(computeAnalytics(getProgress(uid)));
    });
  }, []);

  if (!a) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">Loading analytics…</main>
      </div>
    );
  }

  const diffs: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  const unitIds = Object.keys(a.byUnit)
    .map((n) => Number(n))
    .sort((x, y) => x - y);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Analytics</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Your progress</h1>
            <p className="mt-1 text-muted-foreground">
              Live snapshot of your practice and mock test performance.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm("Reset all your analytics on this device?")) {
                clearProgress(userId);
                setA(computeAnalytics(getProgress(userId)));
              }
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-destructive hover:text-destructive transition-colors"
          >
            Reset progress
          </button>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Questions solved"
            value={`${a.practiceSolvedUnique} / ${a.practiceTotalQuestions}`}
            sub={`${a.practiceAttempts} total attempts`}
          />
          <Stat label="Mock tests taken" value={a.mockCount} sub={`${a.mockViolations} auto-submitted`} />
          <Stat label="Best mock score" value={`${a.mockBestPct}%`} />
          <Stat label="Average mock score" value={`${a.mockAvgPct}%`} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">By difficulty</h2>
            <div className="mt-4 space-y-4">
              {diffs.map((d) => {
                const v = a.byDifficulty[d];
                return (
                  <div key={d}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{d}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {v.solved} / {v.total} solved · {v.attempts} attempts
                      </span>
                    </div>
                    <div className="mt-2">
                      <Bar value={v.solved} max={v.total} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">By unit (syllabus)</h2>
            <div className="mt-4 space-y-4">
              {unitIds.map((u) => {
                const v = a.byUnit[u];
                return (
                  <div key={u}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{UNIT_NAMES[u] ?? `Unit ${u}`}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {v.solved} / {v.total}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Bar value={v.solved} max={v.total} tone="accent" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Recent practice</h2>
            {a.recentPractice.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No attempts yet.{" "}
                <Link to="/practice" className="underline">
                  Start practicing
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {a.recentPractice.map((p, i) => {
                  const q = QUESTIONS.find((x) => x.id === p.questionId);
                  return (
                    <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{q?.title ?? p.questionId}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.difficulty} · Unit {p.unit} · {new Date(p.at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                          p.solved
                            ? "bg-[oklch(0.65_0.15_145)]/15 text-[oklch(0.4_0.15_145)]"
                            : p.passed > 0
                              ? "bg-accent/20 text-accent-foreground"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {p.passed}/{p.total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Recent mock tests</h2>
            {a.recentMocks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No mock tests yet.{" "}
                <Link to="/mock-tests" className="underline">
                  Take one
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {a.recentMocks.map((m, i) => (
                  <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.testName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.at).toLocaleString()} ·{" "}
                        {m.submissionType === "auto-violation" ? (
                          <span className="text-destructive">auto-submitted</span>
                        ) : (
                          "submitted"
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums">{m.percentage}%</p>
                      <p className="text-xs text-muted-foreground">Grade {m.grade}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

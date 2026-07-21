import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer, RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { ViolationAnalytics } from "@/components/ViolationAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { computeAnalytics, getProgress, clearProgress, type Analytics } from "@/lib/progress";
import { getMyAnalyticsData } from "@/lib/analytics.functions";
import { QUESTIONS } from "@/lib/questions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · PY Kidda" },
      { name: "description", content: "Visual analytics for your Python practice and mock test performance." },
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

// Semantic chart colors — tuned to be visible in both light/dark themes.
const C = {
  primary: "oklch(0.62 0.18 250)",   // navy/blue
  accent: "oklch(0.72 0.16 60)",     // warm orange
  teal: "oklch(0.70 0.14 195)",      // teal/cyan
  good: "oklch(0.65 0.16 145)",      // green
  warn: "oklch(0.78 0.16 85)",       // yellow
  bad: "oklch(0.60 0.22 25)",        // red
  muted: "oklch(0.70 0.02 250)",
};

const SCORE_BAND_COLORS = [C.good, C.teal, C.warn, C.bad];

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const ring =
    tone === "good"
      ? "border-l-[oklch(0.65_0.16_145)]"
      : tone === "bad"
        ? "border-l-destructive"
        : tone === "warn"
          ? "border-l-[oklch(0.78_0.16_85)]"
          : "border-l-accent";
  return (
    <div className={`rounded-xl border border-border border-l-4 ${ring} bg-card p-4 shadow-sm`}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ message, ctaText, ctaTo }: { message: string; ctaText?: string; ctaTo?: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
      <div>
        <p>{message}</p>
        {ctaText && ctaTo && (
          <Link to={ctaTo} className="mt-2 inline-block underline text-accent">
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  );
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [raw, setRaw] = useState<{ practice: ReturnType<typeof getProgress>["practice"]; mocks: ReturnType<typeof getProgress>["mocks"] }>({ practice: [], mocks: [] });
  const [testFilter, setTestFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"7" | "30" | "90" | "all">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      const local = getProgress(uid);
      let merged = local;

      if (uid) {
        try {
          const remote = await getMyAnalyticsData();
          // Merge: dedupe practice by (questionId + at), mocks by (testId + at)
          const pKey = (p: { questionId: string; at: number }) => `${p.questionId}|${p.at}`;
          const mKey = (m: { testId: string; at: number }) => `${m.testId}|${m.at}`;
          const pMap = new Map(local.practice.map((p) => [pKey(p), p]));
          for (const p of remote.practice) if (!pMap.has(pKey(p))) pMap.set(pKey(p), p);
          const mMap = new Map(local.mocks.map((m) => [mKey(m), m]));
          for (const m of remote.mocks) if (!mMap.has(mKey(m))) mMap.set(mKey(m), m);
          merged = {
            practice: Array.from(pMap.values()).sort((x, y) => y.at - x.at),
            mocks: Array.from(mMap.values()).sort((x, y) => y.at - x.at),
          };
        } catch (e) {
          console.error("[analytics] DB hydrate failed", e);
        }
      }

      if (cancelled) return;
      setRaw(merged);
      setA(computeAnalytics(merged));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    if (!a) return null;
    const cutoff =
      dateRange === "all" ? 0 : Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000;
    const mocks = raw.mocks.filter(
      (m) => m.at >= cutoff && (testFilter === "all" || m.testId === testFilter),
    );
    const practice = raw.practice.filter(
      (p) => p.at >= cutoff && (unitFilter === "all" || String(p.unit) === unitFilter),
    );
    return { mocks, practice };
  }, [a, raw, testFilter, unitFilter, dateRange]);

  if (!a || !filtered) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 pb-24">
          <LoadingState label="Loading your analytics…" />
        </main>
      </div>
    );
  }

  const hasAnyData = raw.mocks.length > 0 || raw.practice.length > 0;

  // Derived data sets ----------------------------------------------------
  const mockPcts = filtered.mocks.map((m) => m.percentage);
  const avgPct = mockPcts.length ? Math.round(mockPcts.reduce((x, y) => x + y, 0) / mockPcts.length) : 0;
  const bestPct = mockPcts.length ? Math.max(...mockPcts) : 0;
  const lowPct = mockPcts.length ? Math.min(...mockPcts) : 0;
  const violations = filtered.mocks.filter((m) => m.submissionType === "auto-violation").length;
  const normalSubs = filtered.mocks.length - violations;

  // Score trend (chronological)
  const scoreTrend = [...filtered.mocks]
    .sort((x, y) => x.at - y.at)
    .map((m, i) => ({
      label: `#${i + 1}`,
      date: new Date(m.at).toLocaleDateString(),
      score: m.percentage,
      test: m.testName,
    }));

  // Unit-wise practice completion
  const unitData = Object.keys(a.byUnit)
    .map((n) => Number(n))
    .sort((x, y) => x - y)
    .map((u) => {
      const v = a.byUnit[u];
      const pct = v.total > 0 ? Math.round((v.solved / v.total) * 100) : 0;
      return {
        unit: `Unit ${u}`,
        fullName: UNIT_NAMES[u] ?? `Unit ${u}`,
        completion: pct,
        solved: v.solved,
        total: v.total,
        attempts: v.attempts,
      };
    });

  // Score distribution bands
  const bands = [
    { name: "Excellent (≥80%)", value: 0 },
    { name: "Good (60–79%)", value: 0 },
    { name: "Average (40–59%)", value: 0 },
    { name: "Poor (<40%)", value: 0 },
  ];
  for (const p of mockPcts) {
    if (p >= 80) bands[0].value++;
    else if (p >= 60) bands[1].value++;
    else if (p >= 40) bands[2].value++;
    else bands[3].value++;
  }

  // Submission breakdown
  const subBreakdown = [
    { name: "Normal", value: normalSubs, color: C.good },
    { name: "Auto-submitted", value: violations, color: C.bad },
  ].filter((x) => x.value > 0);

  // Violation reasons
  const violationCounts: Record<string, number> = {};
  for (const m of filtered.mocks) {
    if (m.submissionType !== "auto-violation") continue;
    const reason = (m.violationReason ?? "Unknown").replace(/—.*$/, "").trim();
    violationCounts[reason] = (violationCounts[reason] ?? 0) + 1;
  }
  const violationData = Object.entries(violationCounts).map(([reason, count]) => ({ reason, count }));

  // Correct vs wrong (aggregated across mock attempts: passed/total tests)
  let totalQ = 0,
    correctQ = 0,
    partialQ = 0;
  for (const p of filtered.practice) {
    totalQ++;
    if (p.solved) correctQ++;
    else if (p.passed > 0) partialQ++;
  }
  const wrongQ = totalQ - correctQ - partialQ;
  const answerData = [
    { name: "Correct", value: correctQ, color: C.good },
    { name: "Partial", value: partialQ, color: C.warn },
    { name: "Wrong / 0 pass", value: wrongQ, color: C.bad },
  ].filter((x) => x.value > 0);

  // Time taken per mock (in minutes)
  const timeData = [...filtered.mocks]
    .sort((x, y) => x.at - y.at)
    .map((m, i) => ({
      label: `#${i + 1}`,
      test: m.testName,
      minutes: Math.round((m.timeTakenSec / 60) * 10) / 10,
    }));

  // Available test ids for filter
  const allTests = Array.from(new Map(raw.mocks.map((m) => [m.testId, m.testName])).entries());

  // Export
  const exportMocksCSV = () => {
    downloadCSV("mock-tests.csv", [
      ["Date", "Test", "Score %", "Grade", "Marks", "Total", "Time (s)", "Submission", "Violation"],
      ...filtered.mocks.map((m) => [
        new Date(m.at).toLocaleString(),
        m.testName,
        m.percentage,
        m.grade,
        m.marksObtained,
        m.totalMarks,
        m.timeTakenSec,
        m.submissionType,
        m.violationReason ?? "",
      ]),
    ]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Analytics</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Your performance dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Live visual snapshot of your practice and mock test performance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportMocksCSV}
              disabled={filtered.mocks.length === 0}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent transition disabled:opacity-50"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent transition"
            >
              🖨 Print / PDF
            </button>
            <button
              onClick={() => {
                if (confirm("Reset locally cached analytics on this device? (Server data is preserved.)")) {
                  clearProgress(userId);
                  const local = getProgress(userId);
                  setRaw(local);
                  setA(computeAnalytics(local));
                }
              }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-destructive hover:text-destructive transition"
            >
              Reset
            </button>
          </div>
        </div>

        {!hasAnyData && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-lg font-semibold">No analytics data available yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Analytics will appear after you attempt practice questions or mock tests.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/practice" className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold">
                Start practicing
              </Link>
              <Link to="/mock-tests" className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold">
                Take a mock test
              </Link>
            </div>
          </div>
        )}

        {hasAnyData && (
          <>
            {/* Filters */}
            <section className="mt-6 rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-muted-foreground">Filter:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <select
                value={testFilter}
                onChange={(e) => setTestFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="all">All mock tests</option>
                {allTests.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="all">All units</option>
                {Object.keys(UNIT_NAMES).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_NAMES[Number(u)]}
                  </option>
                ))}
              </select>
            </section>

            {/* Summary cards */}
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Questions solved"
                value={`${a.practiceSolvedUnique} / ${a.practiceTotalQuestions}`}
                sub={`${a.practiceAttempts} total attempts`}
              />
              <Stat label="Mock tests taken" value={filtered.mocks.length} sub={`${violations} auto-submitted`} tone={violations > 0 ? "warn" : "default"} />
              <Stat label="Average score" value={`${avgPct}%`} tone={avgPct >= 60 ? "good" : "warn"} />
              <Stat label="Best score" value={`${bestPct}%`} tone="good" />
              <Stat label="Lowest score" value={`${lowPct}%`} tone={lowPct < 40 ? "bad" : "default"} />
              <Stat label="Normal submissions" value={normalSubs} tone="good" />
              <Stat label="Violations" value={violations} tone={violations > 0 ? "bad" : "default"} />
              <Stat
                label="Avg time / test"
                value={
                  filtered.mocks.length
                    ? `${Math.round(filtered.mocks.reduce((x, m) => x + m.timeTakenSec, 0) / filtered.mocks.length / 60)}m`
                    : "—"
                }
              />
            </section>

            {/* Charts row 1 */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Score trend" subtitle="Mock test scores over time">
                {scoreTrend.length === 0 ? (
                  <Empty message="No mock tests in the selected range." ctaText="Take a mock test →" ctaTo="/mock-tests" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={scoreTrend} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.85 0.01 250)" }}
                        formatter={(v: number) => [`${v}%`, "Score"]}
                        labelFormatter={(_, p) => p?.[0]?.payload?.test ?? ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={C.primary}
                        strokeWidth={3}
                        dot={{ r: 4, fill: C.primary }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Score distribution" subtitle="How your mock tests rank by band">
                {mockPcts.length === 0 ? (
                  <Empty message="No mock test scores yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={bands} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {bands.map((_, i) => (
                          <Cell key={i} fill={SCORE_BAND_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </section>

            {/* Charts row 2 */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Unit-wise practice completion" subtitle="Strengths and weaknesses across the syllabus">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={unitData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="unit" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Completion"]}
                      labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ""}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Bar dataKey="completion" radius={[6, 6, 0, 0]}>
                      {unitData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.completion >= 75 ? C.good : d.completion >= 40 ? C.teal : C.bad}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Answer outcomes" subtitle="Across all practice attempts in range">
                {answerData.length === 0 ? (
                  <Empty message="No practice attempts in the selected range." ctaText="Start practicing →" ctaTo="/practice" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={answerData} dataKey="value" nameKey="name" outerRadius={100} label>
                        {answerData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </section>

            {/* Charts row 3 */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Time taken per mock test" subtitle="Minutes spent in each attempt">
                {timeData.length === 0 ? (
                  <Empty message="No mock tests yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={timeData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="m" />
                      <Tooltip
                        formatter={(v: number) => [`${v} min`, "Time"]}
                        labelFormatter={(_, p) => p?.[0]?.payload?.test ?? ""}
                      />
                      <Bar dataKey="minutes" fill={C.teal} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Submission integrity" subtitle="Normal vs auto-submitted (anti-cheat)">
                {subBreakdown.length === 0 ? (
                  <Empty message="No mock tests yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={subBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                        {subBreakdown.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </section>

            {/* Violations bar */}
            {violationData.length > 0 && (
              <section className="mt-6">
                <ViolationAnalytics mocks={filtered.mocks as any} />
              </section>
            )}

            {/* Progress bars per unit (extra granularity) */}
            <section className="mt-6">
              <ChartCard title="Unit-wise completion progress" subtitle="Detailed breakdown by syllabus unit">
                <div className="space-y-3">
                  {unitData.map((u) => (
                    <div key={u.unit}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {u.solved}/{u.total} solved · {u.completion}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${u.completion}%`,
                            background:
                              u.completion >= 75
                                ? C.good
                                : u.completion >= 40
                                  ? C.teal
                                  : C.bad,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </section>

            {/* Detailed table view */}
            <section className="mt-8">
              <details className="rounded-2xl border border-border bg-card p-5">
                <summary className="cursor-pointer text-base font-semibold">Detailed table view</summary>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold mb-2">Recent practice</p>
                    {filtered.practice.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No attempts.</p>
                    ) : (
                      <ul className="divide-y divide-border text-sm">
                        {filtered.practice.slice(0, 15).map((p, i) => {
                          const q = QUESTIONS.find((x) => x.id === p.questionId);
                          return (
                            <li key={i} className="py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{q?.title ?? p.questionId}</p>
                                <p className="text-xs text-muted-foreground">
                                  Unit {p.unit} · {new Date(p.at).toLocaleString()}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                                  p.solved
                                    ? "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.4_0.16_145)]"
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
                  <div>
                    <p className="text-sm font-semibold mb-2">Recent mock tests</p>
                    {filtered.mocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No attempts.</p>
                    ) : (
                      <ul className="divide-y divide-border text-sm">
                        {filtered.mocks.slice(0, 15).map((m, i) => (
                          <li key={i} className="py-2 flex items-center justify-between gap-3">
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
                </div>
              </details>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

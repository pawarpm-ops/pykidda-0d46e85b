import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  STREAK_RANKS,
  fetchMyStreak,
  fetchMyStreakLogs,
  getCurrentRank,
  getNextRank,
  type StreakState,
} from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/streak-journey")({
  head: () => ({
    meta: [
      { title: "My Streak Journey · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StreakJourneyPage,
  ssr: false,
});

type LogRow = { activity_date: string; activity_type: string };

const ACTIVITY_META: Record<string, { icon: string; label: string; counts: boolean }> = {
  login: { icon: "👋", label: "Signed in", counts: false },
  homework_submitted: { icon: "📝", label: "Homework submitted", counts: true },
  mock_test_attempted: { icon: "📊", label: "Mock test attempted", counts: true },
  practice_question_solved: { icon: "🧩", label: "Practice solved", counts: true },
  practice_set_completed: { icon: "🎯", label: "Practice set done", counts: true },
  coding_question_solved: { icon: "💻", label: "Coding solved", counts: true },
  daily_challenge_completed: { icon: "⚡", label: "Daily challenge", counts: true },
};

function StreakJourneyPage() {
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, l] = await Promise.all([fetchMyStreak(), fetchMyStreakLogs(120)]);
      if (!alive) return;
      setStreak(s);
      setLogs(l);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cur = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const done = !!streak?.today_completed;
  const rank = getCurrentRank(cur);
  const next = getNextRank(cur);
  const daysToNext = next ? Math.max(0, next.days - cur) : 0;
  const progress = next
    ? Math.min(100, Math.max(0, ((cur - rank.days) / (next.days - rank.days)) * 100))
    : 100;

  // Only real activities count toward the "active day" heatmap.
  const activeDates = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) {
      const meta = ACTIVITY_META[l.activity_type];
      if (meta?.counts) s.add(l.activity_date);
    }
    return s;
  }, [logs]);

  // Build 120-day grid (17 weeks) ending today.
  const grid = useMemo(() => {
    const today = new Date();
    const days: Array<{ date: string; active: boolean; count: number; isToday: boolean }> = [];
    const counts = new Map<string, number>();
    for (const l of logs) {
      if (ACTIVITY_META[l.activity_type]?.counts) {
        counts.set(l.activity_date, (counts.get(l.activity_date) ?? 0) + 1);
      }
    }
    for (let i = 119; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        active: activeDates.has(iso),
        count: counts.get(iso) ?? 0,
        isToday: i === 0,
      });
    }
    return days;
  }, [logs, activeDates]);

  const recentActivities = useMemo(() => {
    // Show last 8 non-login activities
    return logs.filter((l) => ACTIVITY_META[l.activity_type]?.counts).slice(0, 8);
  }, [logs]);

  const currentIndex = STREAK_RANKS.findIndex((r) => r.name === rank.name);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <style>{`
        @keyframes jrny-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes jrny-shine { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes jrny-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.55)} 50%{box-shadow:0 0 0 18px rgba(249,115,22,0)} }
        @keyframes jrny-spark { 0%,100%{opacity:.15;transform:scale(.6) rotate(0)} 50%{opacity:1;transform:scale(1.2) rotate(180deg)} }
        @keyframes jrny-fill { from{width:0%} to{width:var(--w)} }
        @keyframes jrny-drop { 0%{opacity:0;transform:translateY(-16px)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Cosmic backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 15% 10%, rgba(249,115,22,.25), transparent 55%), radial-gradient(ellipse at 90% 80%, rgba(139,92,246,.25), transparent 55%), radial-gradient(ellipse at 60% 40%, rgba(16,185,129,.15), transparent 60%), #050510",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-yellow-200/70"
            style={{
              left: `${(i * 137.5) % 100}%`,
              top: `${(i * 53.7) % 100}%`,
              fontSize: `${8 + (i % 4) * 3}px`,
              animation: `jrny-spark ${3 + (i % 5)}s ease-in-out ${(i % 7) * 0.4}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur hover:bg-white/10"
        >
          ← Back
        </button>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl md:p-12">
          <div
            aria-hidden
            className="absolute -inset-1 -z-10 rounded-[2rem] opacity-40 blur-3xl"
            style={{ background: rank.color }}
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-yellow-300">
            My Streak Journey
          </p>
          <h1
            className="mt-3 text-5xl font-black tracking-tight md:text-7xl"
            style={{
              backgroundImage: "linear-gradient(90deg,#fde047,#f97316,#ec4899,#a78bfa,#fde047)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "jrny-shine 6s linear infinite",
            }}
          >
            {loading ? "…" : cur} <span className="text-3xl md:text-4xl font-bold text-white/70">day{cur === 1 ? "" : "s"} on fire</span>
          </h1>

          <div className="mt-8 grid gap-6 md:grid-cols-[auto,1fr,auto] md:items-center">
            {/* current rank medallion */}
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl md:h-28 md:w-28"
                style={{
                  background: rank.color,
                  animation: cur > 0 ? "jrny-pulse 2.2s ease-in-out infinite" : undefined,
                }}
              >
                <span style={{ animation: "jrny-float 2s ease-in-out infinite" }}>{rank.icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Current Rank</p>
                <p className="text-2xl font-black">{rank.name}</p>
                <p className="mt-1 text-xs text-white/60">Longest streak: <span className="font-bold text-yellow-300">{longest}</span></p>
              </div>
            </div>

            {/* progress bar */}
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/70">
                  {next ? `Next: ${next.icon} ${next.name}` : "👑 Legend status"}
                </span>
                <span className="font-semibold text-yellow-300">
                  {next ? `${daysToNext} day${daysToNext === 1 ? "" : "s"} left` : "MAX"}
                </span>
              </div>
              <div className="relative h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
                <div
                  className="h-full rounded-full"
                  style={{
                    ["--w" as string]: `${progress}%`,
                    width: `${progress}%`,
                    background: "linear-gradient(90deg,#f97316,#f59e0b,#fde047,#f97316)",
                    backgroundSize: "200% 100%",
                    animation: "jrny-shine 2s linear infinite, jrny-fill 1.2s cubic-bezier(.4,0,.2,1)",
                    boxShadow: "0 0 20px rgba(249,115,22,0.75)",
                  }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-xl drop-shadow-[0_0_8px_rgba(34,197,94,0.9)]"
                  style={{ left: `calc(${progress}% - 12px)`, transition: "left 900ms ease-out" }}
                  aria-hidden
                >
                  🐍
                </div>
              </div>
            </div>

            {/* today badge */}
            <div className="shrink-0">
              <div
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  done
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-orange-400/40 bg-orange-500/15 text-orange-200"
                }`}
              >
                <span className={done ? "text-emerald-300" : "text-orange-300"}>●</span>
                {done ? "Today complete" : "Today pending"}
              </div>
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section className="mt-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-black md:text-3xl">The Rank Roadmap</h2>
            <p className="text-xs uppercase tracking-widest text-white/50">
              {currentIndex + 1} / {STREAK_RANKS.length} unlocked
            </p>
          </div>

          <div className="relative">
            {/* connector line */}
            <div
              aria-hidden
              className="absolute left-1/2 top-0 -z-0 h-full w-1 -translate-x-1/2 rounded-full"
              style={{
                background:
                  "linear-gradient(180deg, rgba(249,115,22,.6), rgba(236,72,153,.4), rgba(139,92,246,.3), rgba(255,255,255,.08))",
              }}
            />
            <ol className="relative space-y-6">
              {STREAK_RANKS.map((r, i) => {
                const unlocked = cur >= r.days;
                const isCurrent = i === currentIndex;
                const side = i % 2 === 0 ? "left" : "right";
                return (
                  <li
                    key={r.name}
                    className={`grid grid-cols-[1fr,auto,1fr] items-center gap-4`}
                    style={{ animation: `jrny-drop .5s ease-out both`, animationDelay: `${i * 60}ms` }}
                  >
                    {/* left card */}
                    <div className={side === "left" ? "flex justify-end" : "invisible md:visible"}>
                      {side === "left" ? (
                        <RankCard rank={r} unlocked={unlocked} isCurrent={isCurrent} align="right" />
                      ) : null}
                    </div>

                    {/* node */}
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-xl ring-2 ring-white/15"
                      style={{
                        background: unlocked ? r.color : "rgba(255,255,255,.06)",
                        opacity: unlocked ? 1 : 0.55,
                        animation: isCurrent ? "jrny-pulse 2s ease-in-out infinite" : undefined,
                      }}
                    >
                      <span style={{ filter: unlocked ? "none" : "grayscale(0.5)" }}>{r.icon}</span>
                      {isCurrent && (
                        <span className="absolute -bottom-2 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-900 shadow">
                          You
                        </span>
                      )}
                    </div>

                    {/* right card */}
                    <div className={side === "right" ? "flex justify-start" : "invisible md:visible"}>
                      {side === "right" ? (
                        <RankCard rank={r} unlocked={unlocked} isCurrent={isCurrent} align="left" />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* HEATMAP */}
        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl md:p-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-black md:text-2xl">Last 120 Days</h2>
              <p className="text-xs text-white/60">Each cell is a day. Bright cells are days you did real work.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/60">
              <span>Quiet</span>
              <span className="h-3 w-3 rounded-sm bg-white/5" />
              <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(249,115,22,.4)" }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(249,115,22,.7)" }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: "linear-gradient(135deg,#f97316,#fde047)" }} />
              <span>On fire</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div
              className="grid grid-flow-col gap-1"
              style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
            >
              {grid.map((d) => {
                const intensity = d.count === 0 ? 0 : d.count === 1 ? 1 : d.count === 2 ? 2 : 3;
                const bg = [
                  "rgba(255,255,255,.05)",
                  "rgba(249,115,22,.4)",
                  "rgba(249,115,22,.75)",
                  "linear-gradient(135deg,#f97316,#fde047)",
                ][intensity];
                return (
                  <div
                    key={d.date}
                    title={`${d.date} · ${d.count} activit${d.count === 1 ? "y" : "ies"}`}
                    className={`h-4 w-4 rounded-sm ring-1 ring-white/5 ${d.isToday ? "outline outline-2 outline-yellow-300" : ""}`}
                    style={{ background: bg, boxShadow: d.active ? "0 0 8px rgba(249,115,22,.4)" : undefined }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* RECENT ACTIVITIES */}
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-black md:text-2xl">Recent Milestones</h2>
          {recentActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-white/60">
              No qualifying activities yet. Submit a homework or take a mock test to light up your journey. 🔥
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {recentActivities.map((a, i) => {
                const meta = ACTIVITY_META[a.activity_type] ?? {
                  icon: "⭐",
                  label: a.activity_type,
                };
                return (
                  <li
                    key={`${a.activity_date}-${i}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07]"
                    style={{ animation: "jrny-drop .4s ease-out both", animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{meta.label}</p>
                      <p className="text-xs text-white/60">{a.activity_date}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">+10</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function RankCard({
  rank,
  unlocked,
  isCurrent,
  align,
}: {
  rank: { days: number; name: string; icon: string; color: string; glow: string };
  unlocked: boolean;
  isCurrent: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`relative w-full max-w-xs rounded-2xl border p-4 backdrop-blur transition ${
        unlocked
          ? "border-white/20 bg-white/[0.07]"
          : "border-white/10 bg-white/[0.02] opacity-70"
      } ${isCurrent ? "ring-2 ring-yellow-300 shadow-[0_0_30px_rgba(253,224,71,.35)]" : ""}`}
      style={{ textAlign: align === "left" ? "left" : "right" }}
    >
      {unlocked && (
        <div
          aria-hidden
          className="absolute -inset-0.5 -z-10 rounded-2xl opacity-25 blur-xl"
          style={{ background: rank.color }}
        />
      )}
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
        Day {rank.days}
      </p>
      <p className="mt-1 text-lg font-black leading-tight">{rank.name}</p>
      <p className="mt-1 text-xs text-white/70">
        {unlocked ? (isCurrent ? "You're here right now" : "Unlocked ✓") : `${rank.days} days to unlock`}
      </p>
    </div>
  );
}

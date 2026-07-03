import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchMyStreak, getCurrentRank, getNextRank, type StreakState } from "@/lib/streaks";

export function StreakCard() {
  const [streak, setStreak] = useState<StreakState | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyStreak().then((s) => alive && setStreak(s));
    const handler = () => fetchMyStreak().then((s) => alive && setStreak(s));
    window.addEventListener("pk:streak-updated", handler);
    return () => {
      alive = false;
      window.removeEventListener("pk:streak-updated", handler);
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

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.05] backdrop-blur-2xl p-6 shadow-2xl"
      data-tour="streak-card"
    >
      <style>{`
        @keyframes pk-flame { 0%,100%{transform:translateY(0) scale(1);opacity:.95} 50%{transform:translateY(-3px) scale(1.08);opacity:1} }
        @keyframes pk-sparkle { 0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes pk-slither { 0%{left:-8%} 100%{left:102%} }
        @keyframes pk-ring { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.6)} 50%{box-shadow:0 0 0 14px rgba(249,115,22,0)} }
        @keyframes pk-shine2 { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>

      {/* glow bg */}
      <div
        className="absolute -inset-0.5 -z-10 rounded-3xl opacity-40 blur-2xl"
        style={{ background: rank.color }}
        aria-hidden
      />
      {/* sparkles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute text-yellow-300"
            style={{
              left: `${(i * 13 + 5) % 95}%`,
              top: `${(i * 21 + 10) % 80}%`,
              fontSize: `${10 + (i % 3) * 4}px`,
              animation: `pk-sparkle ${2 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">Daily Streak</p>
          <div className="mt-1 flex items-end gap-2">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-2xl"
              style={{
                background: rank.color,
                animation: cur > 0 ? "pk-ring 2s ease-in-out infinite" : undefined,
              }}
            >
              <span style={{ animation: "pk-flame 1.2s ease-in-out infinite" }}>
                {cur > 0 ? "🔥" : "💤"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span
                  className="text-5xl font-black tabular-nums"
                  style={{
                    backgroundImage: "linear-gradient(90deg,#fde047,#f97316,#ec4899,#fde047)",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "pk-shine2 3s linear infinite",
                  }}
                >
                  {cur}
                </span>
                <span className="text-sm font-semibold text-white/70">days</span>
              </div>
              <p className="text-sm font-bold text-white">
                {rank.icon} {rank.name}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Longest</p>
          <p className="text-2xl font-black text-yellow-300 tabular-nums">{longest}</p>
          <div
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              done ? "bg-emerald-500/20 text-emerald-300" : "bg-orange-500/20 text-orange-300"
            }`}
          >
            <span className={done ? "text-emerald-400" : "text-orange-400"}>●</span>
            {done ? "Today done" : "Today pending"}
          </div>
        </div>
      </div>

      {/* Progress bar w/ snake */}
      <div className="mt-6">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-white/70">
            {next
              ? `Next: ${next.icon} ${next.name}`
              : `👑 Max rank reached!`}
          </span>
          <span className="text-yellow-300 font-semibold">
            {next ? `${daysToNext} day${daysToNext === 1 ? "" : "s"} left` : "Legend"}
          </span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20 shadow-inner">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg,#f97316,#f59e0b,#fde047,#f97316)",
              backgroundSize: "200% 100%",
              animation: "pk-shine2 2s linear infinite",
              boxShadow: "0 0 16px rgba(249,115,22,0.7)",
            }}
          />
          {/* snake mascot */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-lg drop-shadow-[0_0_6px_rgba(34,197,94,0.8)]"
            style={{
              left: `calc(${progress}% - 10px)`,
              transition: "left 700ms ease-out",
            }}
            aria-hidden
          >
            🐍
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-white/80">
        {done
          ? "Your Python flame is burning strong! Keep it up tomorrow. 🎉"
          : cur > 0
            ? "Your streak is waiting! Solve one question today to keep it alive."
            : "Start your streak today — solve one Python question to light the flame."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/practice"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-orange-500/40 transition hover:scale-105"
        >
          🔥 Continue Streak
        </Link>
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          My Journey
        </Link>
      </div>
    </div>
  );
}

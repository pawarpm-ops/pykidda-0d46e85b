import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { fetchLeaderboard, syncMyScore, type LeaderboardRow } from "@/lib/leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { fetchStreakLeaderboard, getCurrentRank, type StreakLeaderRow } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard · PY Kidda" },
      { name: "description", content: "See where you rank among PY Kidda students." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [tab, setTab] = useState<"score" | "streak">("score");
  const [streakRows, setStreakRows] = useState<StreakLeaderRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setMe(data.user?.id ?? null);
        await syncMyScore();
        const list = await fetchLeaderboard(100);
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "streak" || streakRows) return;
    let cancelled = false;
    fetchStreakLeaderboard(100).then((rows) => !cancelled && setStreakRows(rows));
    return () => {
      cancelled = true;
    };
  }, [tab, streakRows]);

  const top3 = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">PY Kidda Hall of Fame</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Leaderboard</h1>
        </header>

        {/* Tabs */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {(["score", "streak"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "score" ? "🏆 Score" : "🔥 Streak"}
              </button>
            ))}
          </div>
        </div>

        {tab === "streak" ? (
          <StreakLeaderboard rows={streakRows} meId={me} />
        ) : (
        <>


        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!rows && !error && (
          <div className="py-16 text-center text-muted-foreground">Loading the rankings…</div>
        )}

        {rows && rows.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            No scores yet — solve your first practice question to claim rank #1!
          </div>
        )}

        {top3.length > 0 && <Podium top3={top3} meId={me} />}

        {rest.length > 0 && (
          <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-right">Solved</th>
                  <th className="px-4 py-3 text-right">Best Mock</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((r, i) => {
                  const rank = i + 4;
                  const isMe = r.user_id === me;
                  return (
                    <tr
                      key={r.user_id}
                      className={`border-t border-border/60 ${isMe ? "bg-accent/10" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-muted-foreground">#{rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar row={r} size={32} />
                          <span className="font-medium">
                            {r.display_name || "Anonymous"}
                            {isMe && (
                              <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                                you
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.solved_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.mock_best}%</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Podium({ top3, meId }: { top3: LeaderboardRow[]; meId: string | null }) {
  // Render order: 2nd, 1st, 3rd for podium look. Fall back gracefully when fewer than 3 exist.
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
      {/* 2nd */}
      <div className="order-2 sm:order-1">
        {second ? <PodiumCard rank={2} row={second} meId={meId} /> : <EmptyPlace rank={2} />}
      </div>
      {/* 1st */}
      <div className="order-1 sm:order-2">
        <PodiumCard rank={1} row={first} meId={meId} />
      </div>
      {/* 3rd */}
      <div className="order-3">
        {third ? <PodiumCard rank={3} row={third} meId={meId} /> : <EmptyPlace rank={3} />}
      </div>
    </div>
  );
}

const RANK_STYLE: Record<
  number,
  { medal: string; gradient: string; glow: string; ring: string; height: string; label: string }
> = {
  1: {
    medal: "🥇",
    gradient: "linear-gradient(140deg, oklch(0.92 0.18 90), oklch(0.78 0.18 60))",
    glow: "0 20px 60px -10px oklch(0.78 0.18 60 / 0.55)",
    ring: "ring-4 ring-[oklch(0.92_0.18_90)]",
    height: "min-h-[280px]",
    label: "Champion",
  },
  2: {
    medal: "🥈",
    gradient: "linear-gradient(140deg, oklch(0.92 0.02 250), oklch(0.78 0.03 250))",
    glow: "0 14px 40px -10px oklch(0.7 0.03 250 / 0.5)",
    ring: "ring-4 ring-[oklch(0.88_0.02_250)]",
    height: "min-h-[230px]",
    label: "Runner-up",
  },
  3: {
    medal: "🥉",
    gradient: "linear-gradient(140deg, oklch(0.82 0.12 50), oklch(0.62 0.13 35))",
    glow: "0 14px 40px -10px oklch(0.6 0.14 35 / 0.5)",
    ring: "ring-4 ring-[oklch(0.78_0.13_45)]",
    height: "min-h-[210px]",
    label: "Bronze",
  },
};

function PodiumCard({ rank, row, meId }: { rank: 1 | 2 | 3; row: LeaderboardRow; meId: string | null }) {
  const s = RANK_STYLE[rank];
  const isMe = row.user_id === meId;
  return (
    <div
      className={`relative flex flex-col items-center justify-end overflow-hidden rounded-2xl border border-white/20 p-6 text-center text-[oklch(0.15_0.02_250)] ${s.height}`}
      style={{ backgroundImage: s.gradient, boxShadow: s.glow }}
    >
      <div className="absolute inset-x-0 top-3 text-center text-3xl">{s.medal}</div>
      <div className="absolute right-3 top-3 rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
        #{rank}
      </div>

      <div className={`mb-3 overflow-hidden rounded-full bg-white/40 ${s.ring}`}>
        <Avatar row={row} size={rank === 1 ? 88 : 72} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-70">{s.label}</p>
      <h3 className="mt-1 truncate text-lg font-bold">
        {row.display_name || "Anonymous"}
        {isMe && <span className="ml-1 text-sm font-normal opacity-70">(you)</span>}
      </h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tabular-nums">{row.score}</span>
        <span className="text-sm font-medium opacity-70">pts</span>
      </div>
      <div className="mt-1 flex gap-3 text-xs opacity-80">
        <span>{row.solved_count} solved</span>
        <span>·</span>
        <span>Best mock {row.mock_best}%</span>
      </div>
    </div>
  );
}

function EmptyPlace({ rank }: { rank: 2 | 3 }) {
  const s = RANK_STYLE[rank];
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center text-muted-foreground ${s.height}`}
    >
      <div className="text-3xl opacity-50">{s.medal}</div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest">Spot open</p>
      <p className="mt-1 text-sm">Rank #{rank} is up for grabs</p>
    </div>
  );
}

function Avatar({ row, size }: { row: LeaderboardRow; size: number }) {
  const initial = (row.display_name?.trim()?.[0] ?? "?").toUpperCase();
  if (row.avatar_url) {
    return (
      <img
        src={row.avatar_url}
        alt=""
        width={size}
        height={size}
        className="block h-full w-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center bg-[oklch(0.25_0.02_250)] font-bold text-[oklch(0.95_0.01_250)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

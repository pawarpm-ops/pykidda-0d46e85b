import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, X, Trophy, Flame } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { fetchLeaderboard, syncMyScore, type LeaderboardRow } from "@/lib/leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { fetchStreakLeaderboard, getCurrentRank, type StreakLeaderRow } from "@/lib/streaks";

type DirectoryEntry = {
  student_unique_id: string | null;
  public_profile_id: string | null;
  qr_enabled: boolean;
};
type Directory = Map<string, DirectoryEntry>;

async function loadDirectory(ids: string[]): Promise<Directory> {
  const map: Directory = new Map();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.rpc("get_student_directory", { _ids: ids });
  if (error || !data) return map;
  for (const r of data as Array<{
    id: string;
    student_unique_id: string | null;
    public_profile_id: string | null;
    qr_enabled: boolean;
  }>) {
    map.set(r.id, {
      student_unique_id: r.student_unique_id,
      public_profile_id: r.public_profile_id,
      qr_enabled: r.qr_enabled,
    });
  }
  return map;
}

function StudentIdChip({ entry }: { entry: DirectoryEntry | undefined }) {
  const id = entry?.student_unique_id;
  if (!id) return <span className="text-[11px] text-muted-foreground">—</span>;
  const canLink = !!entry?.public_profile_id && entry.qr_enabled;
  const base =
    "inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-accent";
  if (canLink) {
    return (
      <Link
        to="/u/$publicId"
        params={{ publicId: entry!.public_profile_id! }}
        className={`${base} hover:bg-accent/20 hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
        title="Open student profile"
        aria-label={`Open public profile ${id}`}
      >
        <span className="truncate max-w-[140px]">{id}</span>
      </Link>
    );
  }
  return <span className={base}>{id}</span>;
}

function NameLink({
  entry,
  children,
  className = "",
}: {
  entry: DirectoryEntry | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const canLink = !!entry?.public_profile_id && entry.qr_enabled;
  if (canLink) {
    return (
      <Link
        to="/u/$publicId"
        params={{ publicId: entry!.public_profile_id! }}
        className={`hover:text-accent hover:underline underline-offset-4 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
        title="Open student profile"
      >
        {children}
      </Link>
    );
  }
  return <span className={className}>{children}</span>;
}



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
  const [directory, setDirectory] = useState<Directory>(new Map());
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setMe(data.user?.id ?? null);
        await syncMyScore();
        const list = await fetchLeaderboard(100);
        if (!cancelled) setRows(list);
        const dir = await loadDirectory(list.map((r) => r.user_id));
        if (!cancelled) setDirectory((prev) => new Map([...prev, ...dir]));
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
    (async () => {
      const list = await fetchStreakLeaderboard(100);
      if (cancelled) return;
      setStreakRows(list);
      const missing = list.map((r) => r.user_id).filter((id) => !directory.has(id));
      if (missing.length > 0) {
        const dir = await loadDirectory(missing);
        if (!cancelled) setDirectory((prev) => new Map([...prev, ...dir]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, streakRows, directory]);

  const q = query.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.display_name || "").toLowerCase();
      const sid = (directory.get(r.user_id)?.student_unique_id || "").toLowerCase();
      return name.includes(q) || sid.includes(q);
    });
  }, [rows, q, directory]);

  const filteredStreakRows = useMemo(() => {
    if (!streakRows) return null;
    if (!q) return streakRows;
    return streakRows.filter((r) => {
      const name = (r.display_name || "").toLowerCase();
      const sid = (directory.get(r.user_id)?.student_unique_id || "").toLowerCase();
      return name.includes(q) || sid.includes(q);
    });
  }, [streakRows, q, directory]);

  const searching = q.length > 0;
  const top3 = !searching ? filteredRows?.slice(0, 3) ?? [] : [];
  const rest = searching ? filteredRows ?? [] : filteredRows?.slice(3) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          eyebrow="PY Kidda Hall of Fame"
          title="Leaderboard"
          description="Ranked by best percentage per scheduled mock test."
        />

        {/* Tabs */}
        <div className="mb-6 flex justify-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "score" | "streak")}>
            <TabsList aria-label="Leaderboard mode" className="h-10">
              <TabsTrigger value="score" className="gap-2 px-4 py-1.5 text-sm font-semibold">
                <Trophy className="h-4 w-4" aria-hidden />
                Score
              </TabsTrigger>
              <TabsTrigger value="streak" className="gap-2 px-4 py-1.5 text-sm font-semibold">
                <Flame className="h-4 w-4" aria-hidden />
                Streak
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search bar */}
        <div className="mx-auto mb-8 max-w-xl">
          <label htmlFor="leaderboard-search" className="sr-only">
            Search students by name or ID
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="leaderboard-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 60))}
              placeholder="Search by student name or ID…"
              className="h-11 rounded-full pl-10 pr-10"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {tab === "streak" ? (
          <StreakLeaderboard
            rows={filteredStreakRows}
            allRows={streakRows}
            meId={me}
            directory={directory}
            searching={searching}
          />
        ) : (
          <>
            {error && <ErrorState description={error} />}

            {!rows && !error && <LoadingState label="Loading the rankings…" />}

            {rows && rows.length === 0 && (
              <EmptyState
                title="No scores yet"
                description="Solve your first practice question to claim rank #1!"
              />
            )}

            {searching && filteredRows && filteredRows.length === 0 && (
              <EmptySearch />
            )}

            {top3.length > 0 && <Podium top3={top3} meId={me} directory={directory} />}

            {rest.length > 0 && (
              <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-right">Solved</th>
                      <th className="px-4 py-3 text-right">Best Mock</th>
                      <th className="px-4 py-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r, i) => {
                      const originalIdx = rows?.findIndex((x) => x.user_id === r.user_id) ?? -1;
                      const rank = originalIdx >= 0 ? originalIdx + 1 : i + 1;
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
                              <NameLink entry={directory.get(r.user_id)} className="font-medium">
                                {r.display_name || "Anonymous"}
                              </NameLink>
                              {isMe && (
                                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                                  you
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StudentIdChip entry={directory.get(r.user_id)} />
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
          </>
        )}
      </main>
    </div>
  );
}

function EmptySearch() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-3xl">
        🐍
      </div>
      <p className="text-base font-semibold">No student found.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try a different name or Student ID (e.g. PYK-0001).
      </p>
    </div>
  );
}


function StreakLeaderboard({
  rows,
  allRows,
  meId,
  directory,
  searching,
}: {
  rows: StreakLeaderRow[] | null;
  allRows: StreakLeaderRow[] | null;
  meId: string | null;
  directory: Directory;
  searching: boolean;
}) {
  if (!rows) return <LoadingState label="Loading streak leaders…" />;
  if (rows.length === 0) {
    if (searching) return <EmptySearch />;
    return (
      <EmptyState
        title="No streaks yet"
        description="Solve a question today to start yours!"
      />
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const top3 = !searching ? rows.slice(0, 3) : [];
  const rest = searching ? rows : rows.slice(3);

  return (
    <>
      {top3.length > 0 && <StreakPodium top3={top3} meId={meId} directory={directory} today={today} />}

      {rest.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-right">🔥 Current</th>
                <th className="px-4 py-3 text-right">🏆 Longest</th>
                <th className="px-4 py-3 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r, i) => {
                const originalIdx = allRows?.findIndex((x) => x.user_id === r.user_id) ?? -1;
                const rank = originalIdx >= 0 ? originalIdx + 1 : i + 4;
                const isMe = r.user_id === meId;
                const alive = r.last_activity_date === today;
                const title = getCurrentRank(r.current_streak);
                const label =
                  r.current_streak >= 90
                    ? "UNSTOPPABLE"
                    : r.current_streak >= 30
                      ? "LEGEND"
                      : r.current_streak >= 7
                        ? "HOT"
                        : null;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-t border-border/60 ${isMe ? "bg-accent/10" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-muted-foreground">#{rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StreakAvatar row={r} size={32} />
                        <NameLink entry={directory.get(r.user_id)} className="font-medium">
                          {r.display_name || "Anonymous"}
                        </NameLink>
                        {isMe && (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                            you
                          </span>
                        )}
                        {label && (
                          <span className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StudentIdChip entry={directory.get(r.user_id)} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <span>{title.icon}</span>
                        <span className="text-muted-foreground">{title.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-orange-500 tabular-nums">
                      {r.current_streak}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-500 tabular-nums">{r.longest_streak}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${alive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`}
                        title={alive ? "Streak alive today" : "Not active today"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const STREAK_RANK_STYLE: Record<
  number,
  { medal: string; gradient: string; glow: string; ring: string; height: string; label: string }
> = {
  1: {
    medal: "🥇",
    gradient: "linear-gradient(140deg, oklch(0.92 0.18 90), oklch(0.78 0.18 60))",
    glow: "0 20px 60px -10px oklch(0.78 0.18 60 / 0.55)",
    ring: "ring-4 ring-[oklch(0.92_0.18_90)]",
    height: "min-h-[280px]",
    label: "On Fire",
  },
  2: {
    medal: "🥈",
    gradient: "linear-gradient(140deg, oklch(0.92 0.02 250), oklch(0.78 0.03 250))",
    glow: "0 14px 40px -10px oklch(0.7 0.03 250 / 0.5)",
    ring: "ring-4 ring-[oklch(0.88_0.02_250)]",
    height: "min-h-[230px]",
    label: "Blazing",
  },
  3: {
    medal: "🥉",
    gradient: "linear-gradient(140deg, oklch(0.82 0.12 50), oklch(0.62 0.13 35))",
    glow: "0 14px 40px -10px oklch(0.6 0.14 35 / 0.5)",
    ring: "ring-4 ring-[oklch(0.78_0.13_45)]",
    height: "min-h-[210px]",
    label: "Heating Up",
  },
};

function StreakPodium({
  top3,
  meId,
  directory,
  today,
}: {
  top3: StreakLeaderRow[];
  meId: string | null;
  directory: Directory;
  today: string;
}) {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
      <div className="order-2 sm:order-1">
        {second ? (
          <StreakPodiumCard rank={2} row={second} meId={meId} entry={directory.get(second.user_id)} today={today} />
        ) : (
          <EmptyStreakPlace rank={2} />
        )}
      </div>
      <div className="order-1 sm:order-2">
        <StreakPodiumCard rank={1} row={first} meId={meId} entry={directory.get(first.user_id)} today={today} />
      </div>
      <div className="order-3">
        {third ? (
          <StreakPodiumCard rank={3} row={third} meId={meId} entry={directory.get(third.user_id)} today={today} />
        ) : (
          <EmptyStreakPlace rank={3} />
        )}
      </div>
    </div>
  );
}

function StreakPodiumCard({
  rank,
  row,
  meId,
  entry,
  today,
}: {
  rank: 1 | 2 | 3;
  row: StreakLeaderRow;
  meId: string | null;
  entry: DirectoryEntry | undefined;
  today: string;
}) {
  const s = STREAK_RANK_STYLE[rank];
  const isMe = row.user_id === meId;
  const alive = row.last_activity_date === today;
  const title = getCurrentRank(row.current_streak);
  return (
    <div
      className={`relative flex flex-col items-center justify-end overflow-hidden rounded-2xl border border-white/20 p-6 text-center text-[oklch(0.15_0.02_250)] ${s.height}`}
      style={{ backgroundImage: s.gradient, boxShadow: s.glow }}
    >
      {/* Ambient flame glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.9 0.2 60) 0%, transparent 70%)" }}
      />

      <div className="absolute inset-x-0 top-3 text-center text-3xl drop-shadow-sm">{s.medal}</div>
      <div className="absolute right-3 top-3 rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
        #{rank}
      </div>
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${alive ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`}
        />
        {alive ? "Active today" : "Idle"}
      </div>

      <div className={`relative mb-3 overflow-hidden rounded-full bg-white/40 ${s.ring}`}>
        <StreakAvatar row={row} size={rank === 1 ? 88 : 72} />
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">{s.label}</p>
      <h3 className="mt-1 truncate text-lg font-bold">
        <NameLink entry={entry}>{row.display_name || "Anonymous"}</NameLink>
        {isMe && <span className="ml-1 text-sm font-normal opacity-70">(you)</span>}
      </h3>
      {entry?.student_unique_id && (
        <div className="mt-1">
          <StudentIdChip entry={entry} />
        </div>
      )}

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl">🔥</span>
        <span className="text-4xl font-extrabold tabular-nums">{row.current_streak}</span>
        <span className="text-sm font-medium opacity-70">days</span>
      </div>

      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-semibold">
        <span>{title.icon}</span>
        <span>{title.name}</span>
      </div>

      <div className="mt-2 text-xs opacity-80">
        Longest 🏆 <span className="font-semibold tabular-nums">{row.longest_streak}</span> days
      </div>
    </div>
  );
}

function EmptyStreakPlace({ rank }: { rank: 2 | 3 }) {
  const s = STREAK_RANK_STYLE[rank];
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center text-muted-foreground ${s.height}`}
    >
      <div className="text-3xl opacity-50">{s.medal}</div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest">Spot open</p>
      <p className="mt-1 text-sm">Rank #{rank} needs a streaker</p>
    </div>
  );
}

function StreakAvatar({ row, size }: { row: StreakLeaderRow; size: number }) {
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



function Podium({
  top3,
  meId,
  directory,
}: {
  top3: LeaderboardRow[];
  meId: string | null;
  directory: Directory;
}) {
  // Render order: 2nd, 1st, 3rd for podium look. Fall back gracefully when fewer than 3 exist.
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
      {/* 2nd */}
      <div className="order-2 sm:order-1">
        {second ? (
          <PodiumCard rank={2} row={second} meId={meId} entry={directory.get(second.user_id)} />
        ) : (
          <EmptyPlace rank={2} />
        )}
      </div>
      {/* 1st */}
      <div className="order-1 sm:order-2">
        <PodiumCard rank={1} row={first} meId={meId} entry={directory.get(first.user_id)} />
      </div>
      {/* 3rd */}
      <div className="order-3">
        {third ? (
          <PodiumCard rank={3} row={third} meId={meId} entry={directory.get(third.user_id)} />
        ) : (
          <EmptyPlace rank={3} />
        )}
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

function PodiumCard({
  rank,
  row,
  meId,
  entry,
}: {
  rank: 1 | 2 | 3;
  row: LeaderboardRow;
  meId: string | null;
  entry: DirectoryEntry | undefined;
}) {
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
        <NameLink entry={entry}>{row.display_name || "Anonymous"}</NameLink>
        {isMe && <span className="ml-1 text-sm font-normal opacity-70">(you)</span>}
      </h3>
      {entry?.student_unique_id && (
        <div className="mt-1">
          <StudentIdChip entry={entry} />
        </div>
      )}
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

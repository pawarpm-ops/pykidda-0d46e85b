import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type StreakRow = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  today_completed: boolean;
};

type LogRow = {
  id: string;
  user_id: string;
  activity_date: string;
  activity_type: string;
  activity_reference_id: string | null;
  streak_count_after_activity: number;
  points_earned: number;
  created_at: string;
};

type StudentLite = { user_id: string; name: string };

const COUNTING_TYPES = new Set([
  "practice_question_solved",
  "practice_set_completed",
  "mock_test_attempted",
  "coding_question_solved",
  "daily_challenge_completed",
  "homework_submitted",
]);

const IST_TZ = "Asia/Kolkata";

function todayIst(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function reasonFor(
  log: LogRow,
  prev: LogRow | undefined,
): { label: string; tone: "good" | "warn" | "muted" } {
  if (!COUNTING_TYPES.has(log.activity_type)) {
    return { label: "Logged only — activity does not count toward streak", tone: "muted" };
  }
  if (!prev) {
    return { label: "Streak started from this activity", tone: "good" };
  }
  if (prev.activity_date === log.activity_date) {
    return { label: "Streak already counted today — no change", tone: "muted" };
  }
  const prevD = new Date(prev.activity_date + "T00:00:00Z").getTime();
  const curD = new Date(log.activity_date + "T00:00:00Z").getTime();
  const diffDays = Math.round((curD - prevD) / 86400000);
  if (diffDays === 1) {
    return { label: `Streak continued from ${prev.activity_date}`, tone: "good" };
  }
  return { label: `Streak reset — missed ${diffDays - 1} day(s)`, tone: "warn" };
}

export function StreakDebugTab({ students }: { students: StudentLite[] }) {
  const [streaks, setStreaks] = useState<StreakRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [q, setQ] = useState("");

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) m.set(s.user_id, s.name);
    return m;
  }, [students]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("student_streaks")
        .select("user_id,current_streak,longest_streak,last_activity_date,today_completed")
        .order("current_streak", { ascending: false })
        .limit(500);
      setStreaks((data ?? []) as StreakRow[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setLogs([]);
      return;
    }
    (async () => {
      setLogsLoading(true);
      const { data } = await supabase
        .from("streak_activity_logs")
        .select("id,user_id,activity_date,activity_type,activity_reference_id,streak_count_after_activity,points_earned,created_at")
        .eq("user_id", selected)
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data ?? []) as LogRow[]);
      setLogsLoading(false);
    })();
  }, [selected]);

  const today = todayIst();
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = streaks.map((s) => ({
      ...s,
      name: nameById.get(s.user_id) ?? "Unknown",
    }));
    if (!needle) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.user_id.includes(needle),
    );
  }, [streaks, nameById, q]);

  const selectedRow = useMemo(
    () => streaks.find((s) => s.user_id === selected) ?? null,
    [streaks, selected],
  );
  const selectedName = selected ? nameById.get(selected) ?? "Unknown" : null;

  // Build "was this counted?" annotations by walking counting logs newest→oldest.
  const annotatedLogs = useMemo(() => {
    const countingSorted = [...logs]
      .filter((l) => COUNTING_TYPES.has(l.activity_type))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    // Map created_at → previous counting log (chronologically prior)
    const prevMap = new Map<string, LogRow | undefined>();
    for (let i = 0; i < countingSorted.length; i++) {
      prevMap.set(countingSorted[i].id, i === 0 ? undefined : countingSorted[i - 1]);
    }
    return logs.map((l) => ({ log: l, prev: prevMap.get(l.id) }));
  }, [logs]);

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold">🔥 Streak debug</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Streaks compute in {IST_TZ}. Today ({today}): a student is "done for today" once any
              qualifying activity is recorded.
            </p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-64"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No streak data.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Student</th>
                  <th className="text-right px-3 py-2">Current</th>
                  <th className="text-right px-3 py-2">Longest</th>
                  <th className="text-left px-3 py-2">Last active</th>
                  <th className="text-left px-3 py-2">Today</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((r) => {
                  const doneToday = r.last_activity_date === today;
                  return (
                    <tr
                      key={r.user_id}
                      className={`border-t border-border ${selected === r.user_id ? "bg-accent/10" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{r.user_id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">🔥 {r.current_streak}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.longest_streak}</td>
                      <td className="px-3 py-2">{r.last_activity_date ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            doneToday
                              ? "bg-[oklch(0.65_0.16_145/0.15)] text-[oklch(0.55_0.18_145)]"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {doneToday ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setSelected(r.user_id)}
                          className="text-xs rounded-md border border-border px-2 py-1 hover:border-accent"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold">Activity history · {selectedName}</h3>
              {selectedRow && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current 🔥 {selectedRow.current_streak} · Longest {selectedRow.longest_streak} ·
                  Last active {selectedRow.last_activity_date ?? "—"}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs rounded-md border border-border px-2 py-1 hover:border-accent"
            >
              Close
            </button>
          </div>

          {logsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : annotatedLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity logged.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Date (IST)</th>
                    <th className="text-left px-3 py-2">Activity</th>
                    <th className="text-right px-3 py-2">Streak after</th>
                    <th className="text-left px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {annotatedLogs.map(({ log, prev }) => {
                    const r = reasonFor(log, prev);
                    const toneClass =
                      r.tone === "good"
                        ? "text-[oklch(0.55_0.18_145)]"
                        : r.tone === "warn"
                          ? "text-[oklch(0.62_0.18_45)]"
                          : "text-muted-foreground";
                    return (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{log.activity_date}</td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {log.activity_type}
                          </span>
                          {log.activity_reference_id && (
                            <span className="ml-2 text-[11px] text-muted-foreground font-mono">
                              {log.activity_reference_id.slice(0, 12)}…
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {log.streak_count_after_activity}
                        </td>
                        <td className={`px-3 py-2 text-xs ${toneClass}`}>{r.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Student = { name: string; avg: number; best: number; rollNo?: string | null };
type SortMode = "rank" | "roll" | "high" | "low";

const COLORS = {
  avg: "oklch(0.62 0.18 250)",
  best: "oklch(0.72 0.16 60)",
};

function truncate(name: string, max = 14) {
  if (!name) return "";
  return name.length > max ? name.slice(0, max).trimEnd() + "…" : name;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as Student & { rank: number; fullName: string };
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{d.fullName}</p>
      <p className="text-muted-foreground">Rank: <span className="text-foreground font-medium">#{d.rank}</span></p>
      <p className="text-muted-foreground">Average: <span className="text-foreground font-medium">{d.avg}%</span></p>
      <p className="text-muted-foreground">Best: <span className="text-foreground font-medium">{d.best}%</span></p>
    </div>
  );
}

export function TopStudentsChart({ students }: { students: Student[] }) {
  const [topN, setTopN] = useState<5 | 10>(10);
  const [sortMode, setSortMode] = useState<SortMode>("rank");

  const ranked = useMemo(
    () => [...students].sort((a, b) => b.avg - a.avg).map((s, i) => ({ ...s, rank: i + 1 })),
    [students],
  );

  const sorted = useMemo(() => {
    const arr = [...ranked];
    if (sortMode === "roll") {
      arr.sort((a, b) => {
        const ar = (a.rollNo ?? "").toString();
        const br = (b.rollNo ?? "").toString();
        if (!ar && !br) return a.name.localeCompare(b.name);
        if (!ar) return 1;
        if (!br) return -1;
        return ar.localeCompare(br, undefined, { numeric: true, sensitivity: "base" });
      });
    } else if (sortMode === "low") {
      arr.sort((a, b) => a.avg - b.avg);
    } // "rank" and "high" already sorted by avg desc
    return arr;
  }, [ranked, sortMode]);

  const shown = useMemo(
    () =>
      sorted.slice(0, topN).map((s) => ({
        fullName: s.name,
        name: truncate(s.name),
        avg: s.avg,
        best: s.best,
        rank: s.rank,
      })),
    [sorted, topN],
  );

  const topPerformer = ranked[0];
  const highestBest = useMemo(
    () => ranked.reduce((m, s) => (s.best > (m?.best ?? -1) ? s : m), ranked[0]),
    [ranked],
  );
  const highestAvg = topPerformer;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Top Students Performance</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Average score compared with best score</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ranked.length > 5 && (
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              {([5, 10] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    topN === n ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(
              [
                { key: "roll", label: "Roll no." },
                { key: "high", label: "High → Low" },
                { key: "low", label: "Low → High" },
              ] as { key: SortMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortMode(opt.key)}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  sortMode === opt.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mock test data yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <SummaryCard label="Top performer" value={truncate(topPerformer.name, 18)} />
            <SummaryCard label="Highest best" value={`${highestBest.best}%`} />
            <SummaryCard label="Highest average" value={`${highestAvg.avg}%`} />
            <SummaryCard label="Students shown" value={String(shown.length)} />
          </div>

          <ResponsiveContainer width="100%" height={Math.max(260, shown.length * 46)}>
            <BarChart
              data={shown}
              layout="vertical"
              margin={{ top: 5, right: 24, left: 8, bottom: 5 }}
              barCategoryGap={12}
            >
              <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.35} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={110}
                interval={0}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(0.85 0.01 250 / 0.15)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="avg" fill={COLORS.avg} name="Average %" radius={[4, 4, 4, 4]} />
              <Bar dataKey="best" fill={COLORS.best} name="Best %" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-sm font-bold truncate" title={value}>{value}</p>
    </div>
  );
}

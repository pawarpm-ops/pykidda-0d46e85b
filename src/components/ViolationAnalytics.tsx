import { useMemo, useState } from "react";
import { ShieldAlert, AlertTriangle, UserX, Ban, Info } from "lucide-react";

export type ViolationMock = {
  user_id?: string | null;
  userId?: string | null;
  submission_type?: string | null;
  submissionType?: string | null;
  violation_reason?: string | null;
  violationReason?: string | null;
};

type Severity = "high" | "medium" | "low";

type ReasonRow = {
  short: string;
  full: string;
  count: number;
  pct: number;
  severity: Severity;
};

/** Map a raw/long violation reason to a short, teacher-friendly label + severity. */
function classifyReason(raw: string): { short: string; severity: Severity } {
  const s = raw.toLowerCase();

  if (s.includes("split") || s.includes("resiz")) return { short: "Window resized / split-screen", severity: "high" };
  if (s.includes("windows/command") || s.includes("meta key") || s.includes("cmd key")) return { short: "Windows / Command key", severity: "high" };
  if (s.includes("printscreen") || s.includes("print screen") || s.includes("prtsc")) return { short: "PrintScreen key", severity: "medium" };
  if (s.includes("snipping")) return { short: "Snipping shortcut", severity: "medium" };
  if (s.includes("screenshot") || s.includes("esc")) return { short: "Screenshot / Esc key", severity: "medium" };
  if (s.includes("fullscreen") && (s.includes("deni") || s.includes("permission"))) return { short: "Fullscreen denied", severity: "low" };
  if (s.includes("fullscreen") && s.includes("exit")) return { short: "Fullscreen exit", severity: "high" };
  if (s.includes("focus") || s.includes("blur")) return { short: "Window lost focus", severity: "high" };
  if (s.includes("tab") && (s.includes("switch") || s.includes("hidden") || s.includes("visibility"))) return { short: "Tab switched", severity: "high" };
  if (s.includes("copy") || s.includes("paste")) return { short: "Copy / paste attempt", severity: "medium" };
  if (s.includes("devtools") || s.includes("inspect")) return { short: "DevTools opened", severity: "high" };
  if (s.includes("right") && s.includes("click")) return { short: "Right-click blocked", severity: "low" };

  // Fallback: strip prefix, cap length
  const cleaned = raw.replace(/^auto-?submit(ted)?:\s*/i, "").replace(/—.*$/, "").trim();
  const short = cleaned.length > 40 ? cleaned.slice(0, 37) + "…" : cleaned || "Unknown reason";
  return { short, severity: "medium" };
}

const SEVERITY_STYLE: Record<Severity, { chip: string; bar: string; dot: string; label: string }> = {
  high: {
    chip: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
    bar: "linear-gradient(90deg, oklch(0.62 0.22 25), oklch(0.72 0.20 35))",
    dot: "bg-destructive",
    label: "High",
  },
  medium: {
    chip: "bg-[oklch(0.78_0.16_65)]/15 text-[oklch(0.78_0.16_65)] ring-1 ring-[oklch(0.78_0.16_65)]/30",
    bar: "linear-gradient(90deg, oklch(0.72 0.19 55), oklch(0.80 0.17 75))",
    dot: "bg-[oklch(0.78_0.16_65)]",
    label: "Medium",
  },
  low: {
    chip: "bg-[oklch(0.72_0.12_195)]/15 text-[oklch(0.72_0.12_195)] ring-1 ring-[oklch(0.72_0.12_195)]/30",
    bar: "linear-gradient(90deg, oklch(0.68 0.13 210), oklch(0.75 0.11 195))",
    dot: "bg-[oklch(0.72_0.12_195)]",
    label: "Low",
  },
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "danger" | "warn" | "info";
}) {
  const toneRing =
    tone === "danger"
      ? "border-l-destructive"
      : tone === "warn"
        ? "border-l-[oklch(0.78_0.16_65)]"
        : tone === "info"
          ? "border-l-[oklch(0.72_0.12_195)]"
          : "border-l-accent";
  const toneBg =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warn"
        ? "bg-[oklch(0.78_0.16_65)]/12 text-[oklch(0.78_0.16_65)]"
        : tone === "info"
          ? "bg-[oklch(0.72_0.12_195)]/12 text-[oklch(0.72_0.12_195)]"
          : "bg-accent/12 text-accent";
  return (
    <div className={`rounded-xl border border-border border-l-4 ${toneRing} bg-card p-4 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${toneBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none truncate" title={String(value)}>
            {value}
          </p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-muted-foreground truncate" title={sub}>{sub}</p>}
    </div>
  );
}

export function ViolationAnalytics({ mocks }: { mocks: ViolationMock[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { rows, totals } = useMemo(() => {
    const buckets = new Map<string, { full: string; count: number; severity: Severity; users: Set<string> }>();
    let totalViolations = 0;
    const affectedUsers = new Set<string>();

    for (const m of mocks) {
      const type = m.submission_type ?? m.submissionType;
      if (type !== "auto-violation") continue;
      const raw = (m.violation_reason ?? m.violationReason ?? "Unknown").trim();
      const { short, severity } = classifyReason(raw);
      const key = short;
      const uid = (m.user_id ?? m.userId ?? "") as string;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        if (uid) existing.users.add(uid);
      } else {
        buckets.set(key, { full: raw, count: 1, severity, users: uid ? new Set([uid]) : new Set() });
      }
      totalViolations += 1;
      if (uid) affectedUsers.add(uid);
    }

    const list: ReasonRow[] = Array.from(buckets.entries())
      .map(([short, v]) => ({
        short,
        full: v.full,
        count: v.count,
        pct: totalViolations > 0 ? Math.round((v.count / totalViolations) * 100) : 0,
        severity: v.severity,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      rows: list,
      totals: {
        total: totalViolations,
        top: list[0]?.short ?? "—",
        autoSubmitted: totalViolations,
        studentsAffected: affectedUsers.size,
      },
    };
  }, [mocks]);

  if (totals.total === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/12 text-emerald-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Mock Test Violation Reasons</h2>
            <p className="text-xs text-muted-foreground">Summary of auto-submit and security violation events</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No violations recorded. All students completed their tests inside the secure environment.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/15 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-semibold">Mock Test Violation Reasons</h2>
            <p className="text-xs text-muted-foreground">
              Summary of auto-submit and security violation events
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Total Violations" value={totals.total} tone="danger" />
        <SummaryCard icon={Ban} label="Most Common Reason" value={totals.top} tone="warn" />
        <SummaryCard icon={ShieldAlert} label="Auto-Submitted Tests" value={totals.autoSubmitted} tone="danger" />
        <SummaryCard icon={UserX} label="Students Affected" value={totals.studentsAffected} tone="info" />
      </div>

      {/* Chart */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
            Violation reason
          </p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
            Number of incidents
          </p>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((r) => {
            const w = Math.max(4, Math.round((r.count / maxCount) * 100));
            const style = SEVERITY_STYLE[r.severity];
            const isHovered = hovered === r.short;
            return (
              <div
                key={r.short}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                onMouseEnter={() => setHovered(r.short)}
                onMouseLeave={() => setHovered(null)}
                title={`${r.full} — ${r.count} incident${r.count === 1 ? "" : "s"} (${r.pct}%)`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                    <span
                      className="truncate text-sm font-medium text-foreground"
                      title={r.full}
                    >
                      {r.short}
                    </span>
                  </div>
                  <div
                    className="relative mt-1.5 h-3 w-full overflow-hidden rounded-full bg-secondary/60 ring-1 ring-border/60"
                    role="progressbar"
                    aria-valuenow={r.count}
                    aria-valuemin={0}
                    aria-valuemax={maxCount}
                    aria-label={r.full}
                  >
                    {/* soft grid ticks */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-40"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, transparent 0, transparent calc(20% - 1px), oklch(0.5 0 0 / 0.15) calc(20% - 1px), oklch(0.5 0 0 / 0.15) 20%)",
                      }}
                      aria-hidden
                    />
                    <div
                      className="h-full rounded-full transition-[width,filter] duration-500 ease-out"
                      style={{
                        width: `${w}%`,
                        background: style.bar,
                        boxShadow: isHovered ? "0 0 0 2px oklch(0.9 0 0 / 0.06) inset" : undefined,
                        filter: isHovered ? "brightness(1.08)" : undefined,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-1">
                  <span className="w-10 text-right text-sm font-bold tabular-nums">{r.count}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{r.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        <span>These events indicate students leaving or disturbing the secure test environment.</span>
      </p>

      {/* Detailed view */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold">Detailed view</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Violation reason</th>
                <th className="px-3 py-2 text-right font-semibold">Count</th>
                <th className="px-3 py-2 text-right font-semibold">Percentage</th>
                <th className="px-3 py-2 text-right font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const style = SEVERITY_STYLE[r.severity];
                return (
                  <tr key={r.short} className="border-t border-border/70 hover:bg-secondary/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                        <span className="font-medium" title={r.full}>{r.short}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pct}%</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getNextBadgeTargets, type NextBadgeTarget, TIER_STYLES } from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";
import { Target as TargetIcon } from "lucide-react";

export function YourNextBadges({ limit = 3 }: { limit?: number }) {
  const [rows, setRows] = useState<NextBadgeTarget[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const r = await getNextBadgeTargets(limit);
      if (!cancelled) setRows(r);
    };
    load();
    const handler = () => load();
    if (typeof window !== "undefined") window.addEventListener("pk:badge-earned", handler);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("pk:badge-earned", handler);
    };
  }, [limit]);

  if (rows === null) return null;
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
      <div className="flex items-center gap-2">
        <TargetIcon className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Your Next Badges</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Achievable milestones based on your current progress.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((b) => {
          const remaining = Math.max(0, (b.target_value ?? 0) - (b.current_value ?? 0));
          const t = TIER_STYLES[b.tier];
          return (
            <li
              key={b.badge_key}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
            >
              <BadgeMedallion icon={b.icon} tier={b.tier} earned={false} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{b.badge_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${t.text} bg-muted`}>
                    {t.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {b.unlock_hint ?? b.motivational_message ?? "Keep going!"}
                </p>
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full bg-gradient-to-r ${t.gradient}`}
                      style={{ width: `${Math.min(100, b.progress_pct)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {b.current_value} / {b.target_value}
                    {remaining > 0 ? ` · ${remaining} to go` : ""}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

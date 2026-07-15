import { useEffect, useState } from "react";
import { getAdminBadgeOverview, type AdminBadgeOverview, TIER_STYLES } from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";
import { Award, Sparkles, Star, Users } from "lucide-react";

function fmt(d: string) {
  try { return new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export function AdminBadgesOverview() {
  const [data, setData] = useState<AdminBadgeOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getAdminBadgeOverview();
      if (!cancelled) { setData(r); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading badge overview…</p>;
  }
  if (!data) {
    return <p className="text-sm text-destructive">Could not load badge overview.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        Total students: <span className="font-medium text-foreground">{data.total_students}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Most earned" icon={<Award className="h-4 w-4" />}>
          {data.most_earned.length === 0
            ? <p className="text-xs text-muted-foreground">No data yet.</p>
            : <ul className="space-y-2">
                {data.most_earned.map((b) => (
                  <li key={b.badge_key} className="flex items-center gap-3">
                    <BadgeMedallion icon={b.icon} tier={b.tier} earned size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.badge_name}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{TIER_STYLES[b.tier].label}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{b.earned_count}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
        <Panel title="Rarest" icon={<Star className="h-4 w-4" />}>
          {data.rarest.length === 0
            ? <p className="text-xs text-muted-foreground">No data yet.</p>
            : <ul className="space-y-2">
                {data.rarest.map((b) => (
                  <li key={b.badge_key} className="flex items-center gap-3">
                    <BadgeMedallion icon={b.icon} tier={b.tier} earned size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.badge_name}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{TIER_STYLES[b.tier].label}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{b.earned_count}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
      </div>
      <Panel title="Recently earned" icon={<Sparkles className="h-4 w-4" />}>
        {data.recent.length === 0
          ? <p className="text-xs text-muted-foreground">No recent awards.</p>
          : <ul className="space-y-2">
              {data.recent.map((b, i) => (
                <li key={`${b.badge_key}-${i}`} className="flex items-center gap-3">
                  <BadgeMedallion icon={b.icon} tier={b.tier} earned size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{b.student_name}</span> earned <span className="font-medium">{b.badge_name}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{fmt(b.earned_at)}</p>
                  </div>
                </li>
              ))}
            </ul>}
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

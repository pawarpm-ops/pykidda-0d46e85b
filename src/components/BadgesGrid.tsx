import { useEffect, useMemo, useState } from "react";
import { Award, Sparkles, Search } from "lucide-react";
import {
  getBadgeProgress,
  type BadgeProgress,
  type BadgeCategory,
  type BadgeTier,
  TIER_STYLES,
  CATEGORY_LABEL,
  RARITY_LABEL,
} from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function fmt(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

type StatusFilter = "all" | "earned" | "in_progress" | "locked";

export function BadgesGrid({ studentId, title = "Badge Gallery" }: { studentId: string; title?: string }) {
  const [rows, setRows] = useState<BadgeProgress[] | null>(null);
  const [category, setCategory] = useState<"all" | BadgeCategory>("all");
  const [tier, setTier] = useState<"all" | BadgeTier>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<BadgeProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const r = await getBadgeProgress(studentId);
      if (!cancelled) setRows(r);
    };
    load();
    const h = () => load();
    if (typeof window !== "undefined") window.addEventListener("pk:badge-earned", h);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("pk:badge-earned", h);
    };
  }, [studentId]);

  const earnedCount = (rows ?? []).filter((r) => r.earned).length;
  const total = rows?.length ?? 0;
  const pct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (tier !== "all" && r.tier !== tier) return false;
      if (status === "earned" && !r.earned) return false;
      if (status === "locked" && (r.earned || r.progress_pct > 0)) return false;
      if (status === "in_progress" && (r.earned || r.progress_pct === 0)) return false;
      return true;
    });
  }, [rows, category, tier, status]);

  const recentlyEarned = useMemo(() => {
    if (!rows) return [];
    return [...rows]
      .filter((r) => r.earned && r.earned_at)
      .sort((a, b) => (b.earned_at! < a.earned_at! ? -1 : 1))
      .slice(0, 4);
  }, [rows]);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {rows && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {earnedCount} / {total} earned · {pct}%
            </span>
          </div>
        )}
      </header>

      {rows && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={`Overall badge completion ${pct}%`}>
          <div className="h-full bg-gradient-to-r from-amber-500 via-primary to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {recentlyEarned.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Recently earned
          </h3>
          <div className="flex flex-wrap gap-3">
            {recentlyEarned.map((b) => (
              <button key={b.badge_key} onClick={() => setSelected(b)} className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 pr-3 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <BadgeMedallion icon={b.icon} tier={b.tier} earned size="sm" />
                <span className="text-xs font-medium">{b.badge_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterSelect
          label="Category"
          value={category}
          onChange={(v) => setCategory(v as "all" | BadgeCategory)}
          options={[["all", "All categories"], ...Object.entries(CATEGORY_LABEL)]}
        />
        <FilterSelect
          label="Tier"
          value={tier}
          onChange={(v) => setTier(v as "all" | BadgeTier)}
          options={[
            ["all", "All tiers"],
            ["bronze", "Bronze"],
            ["silver", "Silver"],
            ["gold", "Gold"],
            ["platinum", "Platinum"],
            ["legendary", "Legendary"],
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            ["all", "All"],
            ["earned", "Earned"],
            ["in_progress", "In progress"],
            ["locked", "Locked"],
          ]}
        />
      </div>

      {rows === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading achievements…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Search className="h-6 w-6" aria-hidden />
          No badges match these filters.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((b) => (
            <BadgeCard key={b.badge_key} b={b} onClick={() => setSelected(b)} />
          ))}
        </div>
      )}

      <BadgeDetailDialog badge={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs font-medium focus:outline-none"
      >
        {options.map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
      </select>
    </label>
  );
}

function BadgeCard({ b, onClick }: { b: BadgeProgress; onClick: () => void }) {
  const t = TIER_STYLES[b.tier];
  const showSecret = !b.earned && b.is_secret;
  const displayName = showSecret ? "Secret challenge" : b.badge_name;
  const displayDesc = showSecret ? "Keep learning to reveal this challenge." : b.description;
  return (
    <button
      onClick={onClick}
      aria-label={`${displayName} — ${b.earned ? "earned" : "locked"} (${t.label})`}
      className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        b.earned
          ? "border-primary/30 bg-gradient-to-br from-card to-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
          : "border-border bg-muted/30 hover:border-border/80"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <BadgeMedallion icon={b.icon} tier={b.tier} earned={b.earned} isSecret={b.is_secret} />
        <span className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${t.text}`}>
          {t.label}
        </span>
      </div>
      <p className="text-sm font-semibold leading-tight">{displayName}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{displayDesc}</p>
      {!showSecret && b.target_value && b.target_value > 1 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full bg-gradient-to-r ${t.gradient}`} style={{ width: `${Math.min(100, b.progress_pct)}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
            {b.current_value} / {b.target_value}
          </p>
        </div>
      )}
      <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {b.earned ? `Earned · ${fmt(b.earned_at)}` : b.is_secret ? "Secret" : "Locked"}
      </p>
    </button>
  );
}

function BadgeDetailDialog({ badge, onClose }: { badge: BadgeProgress | null; onClose: () => void }) {
  const open = badge !== null;
  const b = badge;
  const t = b ? TIER_STYLES[b.tier] : null;
  const showSecret = b ? !b.earned && b.is_secret : false;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {b && t && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <BadgeMedallion icon={b.icon} tier={b.tier} earned={b.earned} isSecret={b.is_secret} size="lg" />
                <div>
                  <DialogTitle>{showSecret ? "Secret challenge" : b.badge_name}</DialogTitle>
                  <DialogDescription className="mt-1">
                    <span className={`inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${t.text}`}>
                      {t.label}
                    </span>
                    <span className="ml-2 text-[11px] uppercase tracking-wider">
                      {RARITY_LABEL[b.rarity]} · {CATEGORY_LABEL[b.category]}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-2 space-y-3 text-sm">
              <p className="text-muted-foreground">
                {showSecret ? "Keep exploring PY Kidda to reveal this challenge." : b.description}
              </p>
              {!showSecret && b.unlock_hint && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  <span className="font-semibold">How to unlock: </span>{b.unlock_hint}
                </p>
              )}
              {!showSecret && b.target_value && b.target_value > 0 && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full bg-gradient-to-r ${t.gradient}`} style={{ width: `${Math.min(100, b.progress_pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Progress: {b.current_value} / {b.target_value} ({b.progress_pct}%)
                    {b.earned ? "" : ` · ${Math.max(0, b.target_value - b.current_value)} to go`}
                  </p>
                </div>
              )}
              {b.earned && (
                <p className="text-xs text-muted-foreground">
                  Earned on <span className="font-medium text-foreground">{fmt(b.earned_at)}</span>.
                </p>
              )}
              {b.motivational_message && !showSecret && (
                <p className="text-xs italic text-primary">“{b.motivational_message}”</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

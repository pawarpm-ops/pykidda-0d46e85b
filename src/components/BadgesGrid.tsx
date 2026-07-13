import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  Flame,
  Sprout,
  Trophy,
  Zap,
  CalendarCheck,
  Lock,
  Award,
  type LucideIcon,
} from "lucide-react";
import { listBadgesForStudent, type BadgeRow } from "@/lib/badges";

const ICONS: Record<string, LucideIcon> = {
  BookOpenCheck,
  Flame,
  Sprout,
  Trophy,
  Zap,
  CalendarCheck,
};

const GRADIENTS: Record<string, string> = {
  first_homework: "from-sky-500 to-cyan-400",
  streak_7: "from-orange-500 to-amber-400",
  python_beginner: "from-emerald-500 to-teal-400",
  top_scorer: "from-yellow-500 to-amber-400",
  fast_solver: "from-fuchsia-500 to-purple-500",
  consistent_learner: "from-indigo-500 to-blue-500",
};

function fmt(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function BadgesGrid({ studentId, title = "My Badges" }: { studentId: string; title?: string }) {
  const [rows, setRows] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await listBadgesForStudent(studentId);
      if (!cancelled) setRows(b);
    })();
    const handler = async () => {
      const b = await listBadgesForStudent(studentId);
      if (!cancelled) setRows(b);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pk:badge-earned", handler);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("pk:badge-earned", handler);
      }
    };
  }, [studentId]);

  const earned = (rows ?? []).filter((r) => r.earned);
  const locked = (rows ?? []).filter((r) => !r.earned);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {rows && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {earned.length} / {rows.length} earned
          </span>
        )}
      </div>

      {rows === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading achievements…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No badges configured yet.</p>
      ) : (
        <>
          {earned.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {earned.map((b) => <BadgeCard key={b.badge_key} b={b} />)}
            </div>
          )}
          {locked.length > 0 && (
            <>
              <h3 className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Locked
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {locked.map((b) => <BadgeCard key={b.badge_key} b={b} />)}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function BadgeCard({ b }: { b: BadgeRow }) {
  const Icon = ICONS[b.icon] ?? Award;
  const gradient = GRADIENTS[b.badge_key] ?? "from-primary to-primary/60";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
        b.earned
          ? "border-primary/30 bg-gradient-to-br from-card to-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
          : "border-border bg-muted/30 opacity-70 hover:opacity-100 hover:border-border/80"
      }`}
      title={b.earned ? `Earned ${fmt(b.earned_at)}` : "Locked"}
    >
      <div
        className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md ${
          b.earned ? "" : "grayscale"
        }`}
      >
        {b.earned ? <Icon className="h-6 w-6" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
      </div>
      <p className="text-sm font-semibold leading-tight">{b.badge_name}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.description}</p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {b.earned ? `Earned · ${fmt(b.earned_at)}` : "Locked"}
      </p>
    </div>
  );
}

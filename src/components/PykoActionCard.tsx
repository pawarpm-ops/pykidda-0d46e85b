import type { PykoAction } from "@/lib/pyko/navigation";
import { PYKO_NAVIGATION_ROUTES } from "@/lib/pyko/navigation";

type Props = {
  actions: PykoAction[];
  onNavigate?: (action: PykoAction) => void;
};

export function PykoActionCard({ actions, onNavigate }: Props) {
  if (!actions.length) return null;
  const primary = actions.find((a) => a.style === "primary") ?? actions[0];
  const secondaries = actions.filter((a) => a !== primary);
  const primaryEntry = PYKO_NAVIGATION_ROUTES[primary.routeKey];

  return (
    <div className="my-2 group rounded-xl border border-border bg-gradient-to-br from-card to-muted/40 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="text-2xl leading-none">{primaryEntry.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">{primaryEntry.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {primaryEntry.description}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onNavigate?.(primary)}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
        >
          {primary.label ?? primaryEntry.label}
          <span aria-hidden>→</span>
        </button>
        {secondaries.map((a) => {
          const entry = PYKO_NAVIGATION_ROUTES[a.routeKey];
          return (
            <button
              key={a.routeKey}
              type="button"
              onClick={() => onNavigate?.(a)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary/60 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <span aria-hidden>{entry.icon}</span>
              {a.label ?? entry.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

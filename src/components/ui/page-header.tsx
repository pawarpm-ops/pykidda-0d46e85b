import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Crumb = { label: string; to?: string };

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  icon,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((c, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {c.to && !last ? (
                  <Link to={c.to} className="hover:text-foreground truncate">
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className={cn("truncate", last && "text-foreground/80 font-medium")}
                    aria-current={last ? "page" : undefined}
                  >
                    {c.label}
                  </span>
                )}
                {!last && <ChevronRight size={12} className="shrink-0 opacity-60" />}
              </span>
            );
          })}
        </nav>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border/70 bg-card text-primary shadow-sm">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

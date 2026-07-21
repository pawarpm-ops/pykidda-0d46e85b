import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Brain, Search, X, Sparkles, ListChecks, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CodeQuestion } from "@/lib/questions";
import { listPublishedPracticeQuestions } from "@/lib/practice-admin.functions";
import { recordStreakActivity } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/practice/")({
  head: () => ({
    meta: [
      { title: "Practice · PY Kidda" },
      {
        name: "description",
        content: "Practice Python questions in-browser — no submission, just learn.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeListPage,
  ssr: false,
});

type DbQ = {
  id: string;
  unit: number;
  title: string;
  prompt: string;
  starter_code: string;
  tests: unknown[];
  hint: string | null;
  solution: string | null;
  marks: number;
};

function PracticeListPage() {
  useEffect(() => {
    void recordStreakActivity("practice_opened");
  }, []);

  const listFn = useServerFn(listPublishedPracticeQuestions);
  const { data: dbQs, isLoading, isError, refetch } = useQuery({
    queryKey: ["practice-published"],
    queryFn: () => listFn() as Promise<DbQ[]>,
  });

  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState<number | "all">("all");

  const allQuestions = useMemo<CodeQuestion[]>(() => {
    return (dbQs ?? []).map((r) => {
      const testCount = Array.isArray(r.tests) ? r.tests.length : 0;
      return {
        id: `db-${r.id}`,
        unit: r.unit,
        title: r.title,
        prompt: r.prompt,
        starterCode: r.starter_code ?? "",
        tests: Array.from({ length: testCount }, () => ({ expected: "" })),
        hint: r.hint ?? "",
        solution: r.solution ?? "",
        marks: r.marks,
      };
    });
  }, [dbQs]);

  const availableUnits = useMemo(() => {
    const s = new Set<number>();
    for (const q of allQuestions) s.add(q.unit);
    return Array.from(s).sort((a, b) => a - b);
  }, [allQuestions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allQuestions.filter((x) => {
      if (unitFilter !== "all" && x.unit !== unitFilter) return false;
      if (!q) return true;
      return (
        x.title.toLowerCase().includes(q) ||
        x.prompt.toLowerCase().includes(q)
      );
    });
  }, [allQuestions, query, unitFilter]);

  const grouped = useMemo(() => {
    const g = new Map<number, CodeQuestion[]>();
    for (const q of filtered) {
      const arr = g.get(q.unit) ?? [];
      arr.push(q);
      g.set(q.unit, arr);
    }
    return Array.from(g.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const hasActiveFilters = query.trim().length > 0 || unitFilter !== "all";
  const totalCount = allQuestions.length;
  const resultCount = filtered.length;

  const resetFilters = () => {
    setQuery("");
    setUnitFilter("all");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
        {/* Homework / Practice segmented switch */}
        <div
          role="tablist"
          aria-label="Learning mode"
          className="mb-5 inline-flex rounded-lg border border-border bg-card p-1 text-sm shadow-sm"
        >
          <Link
            to="/homework"
            role="tab"
            aria-selected="false"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Homework
          </Link>
          <span
            role="tab"
            aria-selected="true"
            aria-current="page"
            className="rounded-md px-3 py-1.5 font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Practice
          </span>
        </div>

        <PageHeader
          icon={<Brain className="h-5 w-5" aria-hidden />}
          eyebrow="Practice"
          title="Sharpen your Python"
          description="Pick any question, run tests in the browser, and learn at your own pace. Attempts aren't stored — practice freely."
        />

        {/* Toolbar: search + unit chips */}
        {!isError && (totalCount > 0 || query || unitFilter !== "all") && (
          <div className="mb-6 space-y-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label htmlFor="practice-search" className="sr-only">
                Search practice questions
              </label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="practice-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="Search by title or prompt…"
                  className="h-11 pl-9 pr-9"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="min-h-11 self-start sm:self-auto"
                >
                  Reset
                </Button>
              )}
            </div>

            {availableUnits.length > 1 && (
              <div
                role="group"
                aria-label="Filter by unit"
                className="flex flex-wrap items-center gap-1.5"
              >
                <UnitChip
                  active={unitFilter === "all"}
                  onClick={() => setUnitFilter("all")}
                  label="All units"
                />
                {availableUnits.map((u) => (
                  <UnitChip
                    key={u}
                    active={unitFilter === u}
                    onClick={() => setUnitFilter(u)}
                    label={`Unit ${u}`}
                  />
                ))}
              </div>
            )}

            {totalCount > 0 && (
              <p
                className="text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {hasActiveFilters
                  ? `${resultCount} of ${totalCount} question${totalCount === 1 ? "" : "s"}`
                  : `${totalCount} question${totalCount === 1 ? "" : "s"} available`}
              </p>
            )}
          </div>
        )}

        {/* Content states */}
        {isLoading ? (
          <LoadingState label="Loading practice questions…" />
        ) : isError ? (
          <ErrorState
            title="Couldn't load practice questions"
            description="Check your connection and try again."
            onRetry={() => void refetch()}
          />
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            title="No practice questions yet"
            description="Your teacher hasn't published any practice questions. Check back soon."
          />
        ) : resultCount === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden />}
            title="No matching questions"
            description="Try a different search term or clear the filters."
            action={
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {grouped.map(([unit, qs]) => (
              <section key={unit} aria-labelledby={`unit-${unit}-heading`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2
                    id={`unit-${unit}-heading`}
                    className="flex items-center gap-2 text-base font-semibold"
                  >
                    <span className="inline-flex items-center rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1 text-sm font-bold text-foreground shadow-sm dark:bg-accent/25 dark:text-accent-foreground">
                      Unit {unit}
                    </span>
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {qs.length} question{qs.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {qs.map((q) => (
                    <li key={q.id}>
                      <QuestionCard q={q} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function UnitChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (active
          ? "border-primary/60 bg-primary/15 text-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-accent/60 hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}

function QuestionCard({ q }: { q: CodeQuestion }) {
  return (
    <Link
      to="/practice/$qid"
      params={{ qid: q.id }}
      aria-label={`Open practice question: ${q.title}`}
      className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-accent/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug">
          {q.title}
        </h3>
        <Badge
          variant="outline"
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
        >
          {q.marks} marks
        </Badge>
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">{q.prompt}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5">
          <ListChecks className="h-3 w-3" aria-hidden />
          {q.tests.length} test{q.tests.length === 1 ? "" : "s"}
        </span>
        <span
          className="inline-flex items-center gap-0.5 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          Open
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

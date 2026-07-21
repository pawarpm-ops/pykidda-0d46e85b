import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listStudentHomework } from "@/lib/homework.functions";


export const Route = createFileRoute("/_authenticated/homework/")({
  head: () => ({
    meta: [
      { title: "My Homework · PY Kidda" },
      {
        name: "description",
        content:
          "Your Python homework, due dates, questions, and marks — all in one place.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeworkListPage,
  ssr: false,
});

type Tab = "pending" | "submitted" | "checked";

function fmtDue(due: string | null | undefined) {
  if (!due) return { text: "No deadline", tone: "muted" as const };
  const d = new Date(due);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return { text: `Overdue · ${d.toLocaleDateString()}`, tone: "bad" as const };
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return { text: `Due in ${hrs}h`, tone: "warn" as const };
  const days = Math.floor(hrs / 24);
  return { text: `Due in ${days}d`, tone: "muted" as const };
}

function statusBadge(sub: { status: string; is_late: boolean } | null) {
  if (!sub || sub.status === "not_submitted")
    return { text: "Incomplete", cls: "bg-secondary text-secondary-foreground border-border" };
  if (sub.status === "checked")
    return { text: "Checked", cls: "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40" };
  if (sub.status === "returned")
    return { text: "Returned", cls: "bg-destructive/10 text-destructive border-destructive/40" };
  if (sub.status === "late" || sub.is_late)
    return { text: "Submitted Late", cls: "bg-[oklch(0.72_0.16_60)]/15 text-[oklch(0.55_0.18_45)] border-[oklch(0.72_0.16_60)]/50" };
  return { text: "Submitted", cls: "bg-accent/15 text-accent-foreground border-accent/40" };
}

function HomeworkListPage() {
  const listFn = useServerFn(listStudentHomework);
  const [tab, setTab] = useState<Tab>("pending");
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-homework"],
    queryFn: () => listFn(),
  });

  type HRow = Awaited<ReturnType<typeof listStudentHomework>>[number];
  const filtered = ((data ?? []) as HRow[]).filter((h: HRow) => {
    const s = h.submission;
    if (tab === "pending") return !s || s.status === "not_submitted" || s.status === "returned";
    if (tab === "submitted") return s && (s.status === "submitted" || s.status === "late");
    return s?.status === "checked";
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-24">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <span
            className="rounded-md px-3 py-1.5 font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Homework
          </span>
          <Link
            to="/practice"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Practice
          </Link>
        </div>

        <PageHeader
          eyebrow="Assignments"
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
          title="My Homework"
          description="Complete each homework — answer all questions, then submit before the deadline."
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-2">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="checked">Checked</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading && <LoadingState label="Loading homework…" />}
        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}
        {data && filtered.length === 0 && !isLoading && (
          <EmptyState
            className="mt-6"
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
            title="Nothing here"
            description="Check another tab or come back later."
          />
        )}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((h: HRow) => {
            const badge = statusBadge(h.submission);
            const due = fmtDue(h.due_at);
            const DueIcon = due.tone === "bad" ? AlertTriangle : Clock;
            return (
              <li key={h.id}>
                <Link
                  to="/homework/$id"
                  params={{ id: h.id }}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-accent/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-tight line-clamp-2 break-words">{h.title}</h2>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                  {h.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{h.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                      {h.question_count} question{h.question_count === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                      {Number(h.total_marks)} marks
                    </span>
                    <span
                      aria-label={`Deadline: ${due.text}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                        due.tone === "bad"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : due.tone === "warn"
                          ? "border-[oklch(0.72_0.16_60)]/50 bg-[oklch(0.72_0.16_60)]/10 text-[oklch(0.55_0.18_45)]"
                          : "border-border bg-secondary/40"
                      }`}
                    >
                      <DueIcon className="h-3 w-3" aria-hidden /> {due.text}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}


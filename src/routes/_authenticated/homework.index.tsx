import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
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
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Homework 📚</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete each homework — answer all questions, then submit before the deadline.
          </p>
        </div>

        <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["pending", "submitted", "checked"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${
                tab === t
                  ? "font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
              style={tab === t ? { backgroundImage: "var(--gradient-sunrise)" } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}
        {data && filtered.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">Nothing here 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">Check another tab or come back later.</p>
          </div>
        )}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((h: HRow) => {
            const badge = statusBadge(h.submission);
            const due = fmtDue(h.due_at);
            return (
              <li key={h.id}>
                <Link
                  to="/homework/$id"
                  params={{ id: h.id }}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-tight line-clamp-2">{h.title}</h2>
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
                      className={`rounded-full border px-2 py-0.5 ${
                        due.tone === "bad"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : due.tone === "warn"
                          ? "border-[oklch(0.72_0.16_60)]/50 bg-[oklch(0.72_0.16_60)]/10 text-[oklch(0.55_0.18_45)]"
                          : "border-border bg-secondary/40"
                      }`}
                    >
                      ⏰ {due.text}
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

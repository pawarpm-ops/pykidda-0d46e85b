import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { listStudentAssignments } from "@/lib/assignments.functions";

export const Route = createFileRoute("/_authenticated/assignments/")({
  head: () => ({
    meta: [
      { title: "My Homework · PY Kidda" },
      { name: "description", content: "View your assigned Python homework, due dates, and marks." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyAssignmentsPage,
  ssr: false,
});

type Row = Awaited<ReturnType<typeof listStudentAssignments>>[number];

function fmtWhen(due: string | null | undefined, isSelfSolve: boolean) {
  if (isSelfSolve || !due) {
    return { text: "Self-solve · no deadline", tone: "default" as const, soon: false };
  }
  const d = new Date(due);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) {
    return { text: "Overdue", tone: "bad" as const, soon: false };
  }
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return { text: `Due in ${hrs}h ${Math.floor((diff % 3_600_000) / 60_000)}m`, tone: "warn" as const, soon: true };
  const days = Math.floor(hrs / 24);
  return { text: `Due in ${days}d`, tone: "default" as const, soon: false };
}

function statusBadge(row: Row) {
  const sub = row.submission;
  const isSelfSolve = (row as { submission_mode?: string }).submission_mode === "self_solve" || !row.due_at;
  if (sub?.status === "reviewed") {
    const late = sub.is_late ? " · Late" : "";
    return { text: `Reviewed · ${sub.marks_obtained ?? 0}/${row.total_marks}${late}`, cls: "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40" };
  }
  if (sub?.status === "late") return { text: "Submitted Late", cls: "bg-[oklch(0.72_0.16_60)]/15 text-[oklch(0.55_0.18_45)] border-[oklch(0.72_0.16_60)]/50" };
  if (sub?.status === "submitted") return { text: "Submitted", cls: "bg-accent/15 text-accent-foreground border-accent/40" };
  if (isSelfSolve) return { text: "Self-solve", cls: "bg-accent/10 text-accent-foreground border-accent/30" };
  const overdue = row.due_at ? new Date(row.due_at) < new Date() : false;
  if (overdue) return { text: "Overdue — submit late", cls: "bg-destructive/10 text-destructive border-destructive/40" };
  return { text: "Pending", cls: "bg-secondary text-secondary-foreground border-border" };
}

function MyAssignmentsPage() {
  const listFn = useServerFn(listStudentAssignments);
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assignments"],
    queryFn: () => listFn(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Homework 📝</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Python assignments from your teacher — write your answer, run it, and submit before the deadline.
            </p>
          </div>
        </div>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}
        {data && data.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">No homework yet 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">Your teacher hasn&apos;t assigned anything. Check back soon.</p>
          </div>
        )}

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {data?.map((row) => {
            const isSelfSolve = (row as { submission_mode?: string }).submission_mode === "self_solve" || !row.due_at;
            const when = fmtWhen(row.due_at, isSelfSolve);
            const badge = statusBadge(row);
            return (
              <li
                key={row.id}
                className={`card-glow group relative rounded-xl border border-border bg-card p-5 shadow-sm ${when.soon ? "ring-1 ring-accent/50" : ""}`}
              >
                {when.soon && (
                  <span className="pointer-events-none absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 32px oklch(0.72 0.16 60 / 0.15)" }} />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-accent">
                      {row.assignment_type} · {row.difficulty}
                      {row.unit != null ? ` · Unit ${row.unit}` : ""}
                    </p>
                    <h2 className="mt-1 text-lg font-bold leading-snug">{row.title}</h2>
                    {row.topic && <p className="text-xs text-muted-foreground">{row.topic}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{row.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                  <span className={
                    when.tone === "bad" ? "font-semibold text-destructive"
                    : when.tone === "warn" ? "font-semibold text-accent animate-pulse"
                    : "text-muted-foreground"
                  }>
                    ⏰ {when.text}
                  </span>
                  <span className="text-muted-foreground">{row.total_marks} marks</span>
                </div>
                <div className="mt-4">
                  <Link
                    to="/assignments/$id"
                    params={{ id: row.id }}
                    className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                    style={{ backgroundImage: "var(--gradient-sunrise)" }}
                  >
                    Open assignment →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

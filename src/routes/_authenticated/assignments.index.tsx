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
    return { text: `Reviewed${late}`, cls: "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40" };
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

        <ul className="mt-6 flex flex-col gap-2">
          {data?.map((row) => {
            const isSelfSolve = (row as { submission_mode?: string }).submission_mode === "self_solve" || !row.due_at;
            const when = fmtWhen(row.due_at, isSelfSolve);
            const badge = statusBadge(row);
            return (
              <li key={row.id}>
                <Link
                  to="/assignments/$id"
                  params={{ id: row.id }}
                  className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition hover:border-accent/60 hover:bg-card/80 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] ${when.soon ? "ring-1 ring-accent/50" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{row.title}</h2>
                      <span className={`hidden sm:inline-block shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.text}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.assignment_type} · {row.difficulty}
                      {row.unit != null ? ` · Unit ${row.unit}` : ""}
                      {row.topic ? ` · ${row.topic}` : ""}
                    </p>
                  </div>
                  <span className={`hidden sm:inline text-xs ${
                    when.tone === "bad" ? "font-semibold text-destructive"
                    : when.tone === "warn" ? "font-semibold text-accent"
                    : "text-muted-foreground"
                  }`}>
                    ⏰ {when.text}
                  </span>
                  <span className="hidden sm:inline text-xs text-muted-foreground">{row.total_marks} marks</span>
                  <span className={`sm:hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.text}</span>
                  <span className="text-accent opacity-0 transition group-hover:opacity-100">→</span>
                </Link>
              </li>
            );
          })}
        </ul>


      </main>
    </div>
  );
}

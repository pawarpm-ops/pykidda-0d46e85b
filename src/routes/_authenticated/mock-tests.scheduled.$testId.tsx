import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { listAiMockTests } from "@/lib/ai-mock.functions";
import { recordDailyStreakVisit } from "@/lib/streaks";

export const Route = createFileRoute("/_authenticated/mock-tests/scheduled/$testId")({
  head: () => ({ meta: [{ title: "Scheduled Mock Test · PY Kidda" }, { name: "robots", content: "noindex" }] }),
  component: ScheduledDetails,
  ssr: false,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-destructive">Couldn't load this scheduled test: {error.message}</p>
        <Link to="/mock-tests" className="mt-4 inline-block text-primary hover:underline">← Back to Mock Tests</Link>
      </main>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p>Scheduled test not found.</p>
        <Link to="/mock-tests" className="mt-4 inline-block text-primary hover:underline">← Back to Mock Tests</Link>
      </main>
    </div>
  ),
});

type Row = {
  id: string;
  title: string;
  description: string;
  duration_sec: number;
  total_marks: number;
  question_count: number;
  test_kind?: "normal" | "scheduled";
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  schedule_instructions?: string;
};

function ScheduledDetails() {
  const { testId } = Route.useParams();
  const listFn = useServerFn(listAiMockTests);
  const [test, setTest] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const rows = (await listFn({ data: { adminScope: false } })) as Row[];
        setTest(rows.find((r) => r.id === testId) ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn, testId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">Loading scheduled test…</main>
      </div>
    );
  }

  if (!test || test.test_kind !== "scheduled") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p>This scheduled test is not available.</p>
          <Link to="/mock-tests" className="mt-4 inline-block text-primary hover:underline">← Back to Mock Tests</Link>
        </main>
      </div>
    );
  }

  const now = Date.now();
  const s = test.scheduled_start_at ? new Date(test.scheduled_start_at).getTime() : 0;
  const e = test.scheduled_end_at ? new Date(test.scheduled_end_at).getTime() : 0;
  const status: "upcoming" | "live" | "closed" = now < s ? "upcoming" : now > e ? "closed" : "live";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
        <Link to="/mock-tests" className="text-sm text-primary hover:underline">← All Mock Tests</Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[oklch(0.55_0.18_260)]">
            📅 Scheduled Mock Test
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold">{test.title}</h1>
          {test.description && <p className="mt-2 text-muted-foreground">{test.description}</p>}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">📅 Date</p>
              <p className="font-semibold">{test.scheduled_start_at ? new Date(test.scheduled_start_at).toLocaleDateString() : "—"}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">⏰ Window</p>
              <p className="font-semibold">
                {test.scheduled_start_at ? new Date(test.scheduled_start_at).toLocaleTimeString() : "—"} → {test.scheduled_end_at ? new Date(test.scheduled_end_at).toLocaleTimeString() : "—"}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">⏱ Duration</p>
              <p className="font-semibold">{Math.round(test.duration_sec / 60)} minutes</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Questions</p>
              <p className="font-semibold">{test.question_count} Qs · {test.total_marks} marks</p>
            </div>
          </div>

          {test.schedule_instructions && (
            <div className="mt-5 rounded-md border border-accent/40 bg-accent/5 p-4 text-sm">
              <p className="font-semibold mb-1">Instructions</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{test.schedule_instructions}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
              status === "live" ? "bg-[oklch(0.65_0.16_145)] text-white"
              : status === "upcoming" ? "bg-[oklch(0.55_0.18_260)] text-white"
              : "bg-muted text-muted-foreground"
            }`}>
              {status === "live" ? "Available Now" : status === "upcoming" ? "Upcoming" : "Closed"}
            </span>
            {status === "live" ? (
              <Link
                to="/mock-tests/ai/$testId/warning"
                params={{ testId: test.id }}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Attend Test
              </Link>
            ) : (
              <button disabled className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground opacity-60">
                {status === "upcoming" ? "Not started yet" : "Scheduled test is closed"}
              </button>
            )}
          </div>
          {status === "upcoming" && test.scheduled_start_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              This test will start on {new Date(test.scheduled_start_at).toLocaleString()}.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

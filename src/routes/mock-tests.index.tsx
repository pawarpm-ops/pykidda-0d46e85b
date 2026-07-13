import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { MOCK_TESTS, mockTestQuestions } from "@/lib/questions";
import { listAiMockTests, listMyAiMockAttempts } from "@/lib/ai-mock.functions";
import { listMyMockResults } from "@/lib/mock-results.functions";

export const Route = createFileRoute("/mock-tests/")({
  head: () => ({
    meta: [
      { title: "Mock Tests · PY Kidda" },
      { name: "description", content: "Take secure full-screen Python coding mock tests on PY Kidda." },
    ],
  }),
  component: MockTestsList,
  ssr: false,
});

type AiTestRow = {
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

type Tab = "normal" | "scheduled";

function useTick(intervalMs = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function scheduledStatus(t: AiTestRow): { label: "Upcoming" | "Available Now" | "Closed"; msg: string; startable: boolean } {
  const now = Date.now();
  const s = t.scheduled_start_at ? new Date(t.scheduled_start_at).getTime() : 0;
  const e = t.scheduled_end_at ? new Date(t.scheduled_end_at).getTime() : 0;
  if (!s || !e) return { label: "Closed", msg: "Schedule not set.", startable: false };
  if (now < s) return {
    label: "Upcoming",
    msg: `This test will start on ${new Date(s).toLocaleString()}.`,
    startable: false,
  };
  if (now > e) return { label: "Closed", msg: "This scheduled test is closed.", startable: false };
  return { label: "Available Now", msg: `Ends at ${new Date(e).toLocaleTimeString()}.`, startable: true };
}

function MockTestsList() {
  const listFn = useServerFn(listAiMockTests);
  const [aiTests, setAiTests] = useState<AiTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("normal");
  useTick(30_000);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listFn({ data: { adminScope: false } });
        setAiTests(rows as AiTestRow[]);
      } catch {
        setAiTests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn]);

  const normalAi = aiTests.filter((t) => (t.test_kind ?? "normal") === "normal");
  const scheduledAi = aiTests.filter((t) => t.test_kind === "scheduled");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Exam mode</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Choose a mock test</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Use a laptop or desktop. Tests run in full-screen mode and{" "}
          <strong className="text-foreground">auto-submit if you exit</strong>. Coding questions are graded in your browser with real Python.
        </p>

        <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "normal"}
            onClick={() => setTab("normal")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${tab === "normal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            📘 Normal Mock Tests
          </button>
          <button
            role="tab"
            aria-selected={tab === "scheduled"}
            onClick={() => setTab("scheduled")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${tab === "scheduled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            📅 Scheduled Mock Tests {scheduledAi.length > 0 && <span className="ml-1 text-xs opacity-80">({scheduledAi.length})</span>}
          </button>
        </div>

        {tab === "normal" && (
          <section className="mt-6">
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading tests…</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {normalAi.map((t) => (
                  <div
                    key={`ai-${t.id}`}
                    className="card-glow rounded-xl border border-border bg-card p-5 flex flex-col relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-[oklch(0.65_0.16_145)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      AI
                    </div>
                    <h3 className="font-semibold text-lg pr-12">{t.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground flex-1">
                      {t.description || "AI-generated mock test."}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2 text-sm flex-wrap">
                      <span className="text-muted-foreground">
                        {t.question_count} Qs · {Math.round(t.duration_sec / 60)} min · {t.total_marks} marks
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/mock-tests/ai/$testId/warning"
                          params={{ testId: t.id }}
                          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                          style={{ backgroundImage: "var(--gradient-sunrise)" }}
                        >
                          Start
                        </Link>
                      </div>
                    </div>
                    <AiHistory testId={t.id} />
                  </div>
                ))}

                {MOCK_TESTS.map((t) => {
                  const qs = mockTestQuestions(t);
                  const marks = qs.reduce((a, q) => a + q.marks, 0);
                  return (
                    <div key={t.id} className="card-glow rounded-xl border border-border bg-card p-5 flex flex-col">
                      <h3 className="font-semibold text-lg">{t.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground flex-1">{t.description}</p>
                      <div className="mt-4 flex items-center justify-between gap-2 text-sm flex-wrap">
                        <span className="text-muted-foreground">
                          {qs.length} Qs · {Math.round(t.durationSec / 60)} min · {marks} marks
                        </span>
                        <Link
                          to="/mock-tests/$testId/warning"
                          params={{ testId: t.id }}
                          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                          style={{ backgroundImage: "var(--gradient-sunrise)" }}
                        >
                          Start
                        </Link>
                      </div>
                      <StaticHistory testId={t.id} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "scheduled" && (
          <section className="mt-6">
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading scheduled tests…</p>
            ) : scheduledAi.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No scheduled mock tests right now. Check back when your teacher publishes one.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {scheduledAi.map((t) => {
                  const st = scheduledStatus(t);
                  const badgeClass =
                    st.label === "Available Now" ? "bg-[oklch(0.65_0.16_145)] text-white"
                    : st.label === "Upcoming" ? "bg-[oklch(0.55_0.18_260)] text-white"
                    : "bg-muted text-muted-foreground";
                  return (
                    <div key={`sched-${t.id}`} className="card-glow rounded-xl border border-border bg-card p-5 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 right-0 rounded-bl-lg bg-[oklch(0.55_0.18_260)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                        📅 Scheduled
                      </div>
                      <h3 className="font-semibold text-lg pr-24">{t.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {t.description || "AI-generated mock test."}
                      </p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>📅 {t.scheduled_start_at ? new Date(t.scheduled_start_at).toLocaleDateString() : "—"}</p>
                        <p>⏰ {t.scheduled_start_at ? new Date(t.scheduled_start_at).toLocaleTimeString() : "—"} → {t.scheduled_end_at ? new Date(t.scheduled_end_at).toLocaleTimeString() : "—"}</p>
                        <p>⏱ {Math.round(t.duration_sec / 60)} min · {t.question_count} Qs · {t.total_marks} marks</p>
                      </div>
                      <div className="mt-3">
                        <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${badgeClass}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{st.msg}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          to="/mock-tests/scheduled/$testId"
                          params={{ testId: t.id }}
                          className="text-xs text-primary hover:underline"
                        >
                          View details
                        </Link>
                        {st.startable ? (
                          <Link
                            to="/mock-tests/ai/$testId/warning"
                            params={{ testId: t.id }}
                            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                            style={{ backgroundImage: "var(--gradient-sunrise)" }}
                          >
                            Attend Test
                          </Link>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground opacity-60"
                          >
                            Attend Test
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// ------- History components -------

function pctColor(p: number) {
  if (p >= 80) return "text-[oklch(0.55_0.16_145)]";
  if (p >= 60) return "text-primary";
  if (p >= 40) return "text-[oklch(0.65_0.16_85)]";
  return "text-destructive";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

type AiAttempt = {
  id: string;
  submitted_at: string | null;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  submission_type: string;
  time_taken_sec: number;
};

function AiHistory({ testId }: { testId: string }) {
  const fn = useServerFn(listMyAiMockAttempts);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<AiAttempt[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && attempts === null) {
      setLoading(true);
      try {
        const rows = await fn({ data: { test_id: testId } });
        setAttempts(rows as AiAttempt[]);
      } catch {
        setAttempts([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        onClick={toggle}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <span>{open ? "▾" : "▸"}</span> View history{attempts ? ` (${attempts.length})` : ""}
      </button>
      {open && (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !attempts || attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attempts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {attempts.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/mock-tests/ai/$testId/result"
                    params={{ testId }}
                    search={{ attempt: a.id }}
                    className="flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2 text-xs hover:bg-secondary/50 transition"
                  >
                    <span className="text-muted-foreground">{fmtDate(a.submitted_at)}</span>
                    <span className="flex items-center gap-2">
                      <span className={`font-bold ${pctColor(a.percentage)}`}>{a.percentage}%</span>
                      <span className="text-muted-foreground">Grade {a.grade}</span>
                      <span className="text-muted-foreground">· {fmtDuration(a.time_taken_sec)}</span>
                      {a.submission_type !== "normal" && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive uppercase">Auto</span>
                      )}
                      <span className="text-accent">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type StaticAttempt = {
  id: string;
  submitted_at: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  total_questions: number;
  time_taken_sec: number;
  submission_type: string;
  violation_reason: string | null;
};

function StaticHistory({ testId }: { testId: string }) {
  const fn = useServerFn(listMyMockResults);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<StaticAttempt[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && attempts === null) {
      setLoading(true);
      try {
        const rows = await fn({ data: { test_id: testId } });
        setAttempts(rows as StaticAttempt[]);
      } catch {
        setAttempts([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        onClick={toggle}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <span>{open ? "▾" : "▸"}</span> View history{attempts ? ` (${attempts.length})` : ""}
      </button>
      {open && (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !attempts || attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attempts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {attempts.map((a) => {
                const isOpen = openId === a.id;
                return (
                  <li key={a.id} className="rounded-md border border-border bg-background/60 text-xs overflow-hidden">
                    <button
                      onClick={() => setOpenId(isOpen ? null : a.id)}
                      className="flex w-full items-center justify-between px-3 py-2 hover:bg-secondary/50 transition"
                    >
                      <span className="text-muted-foreground">{fmtDate(a.submitted_at)}</span>
                      <span className="flex items-center gap-2">
                        <span className={`font-bold ${pctColor(a.percentage)}`}>{a.percentage}%</span>
                        <span className="text-muted-foreground">Grade {a.grade}</span>
                        {a.submission_type !== "normal" && (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive uppercase">Auto</span>
                        )}
                        <span className="text-accent">{isOpen ? "▾" : "▸"}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border/60 bg-card px-3 py-2 space-y-1">
                        <p><span className="text-muted-foreground">Score:</span> <b>{a.marks_obtained} / {a.total_marks}</b> marks ({a.percentage}%)</p>
                        <p><span className="text-muted-foreground">Grade:</span> <b>{a.grade}</b></p>
                        <p><span className="text-muted-foreground">Questions:</span> {a.total_questions}</p>
                        <p><span className="text-muted-foreground">Time taken:</span> {fmtDuration(a.time_taken_sec)}</p>
                        <p><span className="text-muted-foreground">Submitted:</span> {fmtDate(a.submitted_at)}</p>
                        {a.submission_type !== "normal" && (
                          <p className="text-destructive">Auto-submitted: {a.violation_reason ?? "violation"}</p>
                        )}
                        <p className="pt-1 text-[11px] text-muted-foreground italic">
                          Per-question analysis isn't stored for these tests. Retake the test to see live per-question feedback.
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Admin → Overview → Mock Test Overview
// Drill-down: Normal / Scheduled mock tests → per-test student list →
// per-student analysis with PDF download and teacher comment.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_TESTS } from "@/lib/questions";

type NormalAttempt = {
  id: string;
  user_id: string;
  test_id: string;
  test_name: string;
  student_name: string | null;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  total_questions: number;
  time_taken_sec: number;
  submission_type: string;
  violation_reason: string | null;
  submitted_at: string;
};

type ScheduledTest = {
  id: string;
  title: string;
  description: string | null;
  duration_sec: number;
  total_marks: number;
  question_count: number;
  status: string;
  published_at: string | null;
  created_at: string;
};

type GradedAnswer = {
  question_id: string;
  response: string;
  correct: boolean;
  marks_awarded: number;
  marks_total: number;
  correct_answer: string;
  explanation: string;
  code_passed: number | null;
  code_total: number | null;
};

type ScheduledAttempt = {
  id: string;
  user_id: string;
  test_id: string;
  started_at: string | null;
  submitted_at: string | null;
  submission_type: string;
  violation_reason: string | null;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  time_taken_sec: number;
  answers: GradedAnswer[] | null;
};

type CommentRow = {
  id: string;
  attempt_kind: "normal" | "scheduled";
  attempt_id: string;
  student_id: string;
  teacher_id: string;
  test_id: string;
  comment_text: string;
  updated_at: string;
};

function gradeTone(pct: number) {
  if (pct >= 80) return "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.4_0.16_145)] border-[oklch(0.65_0.16_145)]/40";
  if (pct >= 60) return "bg-primary/15 text-primary border-primary/40";
  if (pct >= 40) return "bg-[oklch(0.78_0.16_85)]/15 text-[oklch(0.5_0.16_85)] border-[oklch(0.78_0.16_85)]/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
}

function fmtTime(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function AdminMockOverview({
  mocks,
  profiles,
  currentUserId,
}: {
  mocks: NormalAttempt[];
  profiles: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }>;
  currentUserId: string | null;
}) {
  const [kind, setKind] = useState<"normal" | "scheduled">("normal");

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setKind("normal")}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            kind === "normal"
              ? "border-accent bg-accent/15 text-accent-foreground"
              : "border-border bg-card hover:border-accent/60 hover:bg-accent/5"
          }`}
        >
          📝 Normal Mock Tests
        </button>
        <button
          onClick={() => setKind("scheduled")}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            kind === "scheduled"
              ? "border-accent bg-accent/15 text-accent-foreground"
              : "border-border bg-card hover:border-accent/60 hover:bg-accent/5"
          }`}
        >
          📅 Scheduled Mock Tests
        </button>
      </div>

      {kind === "normal" ? (
        <NormalMockList mocks={mocks} profiles={profiles} currentUserId={currentUserId} />
      ) : (
        <ScheduledMockList profiles={profiles} currentUserId={currentUserId} />
      )}
    </section>
  );
}

// ---------- Normal ----------

function NormalMockList({
  mocks,
  profiles,
  currentUserId,
}: {
  mocks: NormalAttempt[];
  profiles: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }>;
  currentUserId: string | null;
}) {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const summaries = useMemo(() => {
    const byTest = new Map<string, { id: string; name: string; attempts: NormalAttempt[] }>();
    for (const t of MOCK_TESTS) byTest.set(t.id, { id: t.id, name: t.name, attempts: [] });
    for (const m of mocks) {
      const cur = byTest.get(m.test_id) ?? { id: m.test_id, name: m.test_name, attempts: [] };
      cur.attempts.push(m);
      byTest.set(m.test_id, cur);
    }
    return Array.from(byTest.values());
  }, [mocks]);

  if (selectedTestId) {
    const s = summaries.find((x) => x.id === selectedTestId);
    return (
      <NormalTestDetail
        testId={selectedTestId}
        testName={s?.name ?? selectedTestId}
        attempts={s?.attempts ?? []}
        profiles={profiles}
        currentUserId={currentUserId}
        onBack={() => setSelectedTestId(null)}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((s) => {
        const total = s.attempts.length;
        const avg = total ? Math.round(s.attempts.reduce((a, b) => a + b.percentage, 0) / total) : 0;
        const viol = s.attempts.filter((a) => a.submission_type === "auto-violation").length;
        return (
          <button
            key={s.id}
            onClick={() => setSelectedTestId(s.id)}
            className="card-glow group rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">📝 Normal test</p>
            <h3 className="mt-1 text-lg font-bold">{s.name}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Attempts</p>
                <p className="font-bold tabular-nums">{total}</p>
              </div>
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Avg %</p>
                <p className="font-bold tabular-nums">{avg}%</p>
              </div>
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Violations</p>
                <p className={`font-bold tabular-nums ${viol > 0 ? "text-destructive" : ""}`}>{viol}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground group-hover:text-accent transition">
              Open student list →
            </p>
          </button>
        );
      })}
      {summaries.length === 0 && (
        <p className="text-sm text-muted-foreground">No normal mock tests configured.</p>
      )}
    </div>
  );
}

function NormalTestDetail({
  testId,
  testName,
  attempts,
  profiles,
  currentUserId,
  onBack,
}: {
  testId: string;
  testName: string;
  attempts: NormalAttempt[];
  profiles: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }>;
  currentUserId: string | null;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState<NormalAttempt | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...attempts].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );
    if (!q) return list;
    return list.filter((a) => {
      const name = (a.student_name || profiles[a.user_id]?.display_name || "").toLowerCase();
      return name.includes(q) || a.user_id.toLowerCase().includes(q);
    });
  }, [attempts, profiles, query]);

  if (selectedAttempt) {
    return (
      <StudentAnalysis
        kind="normal"
        testId={testId}
        testName={testName}
        studentId={selectedAttempt.user_id}
        studentName={selectedAttempt.student_name || profiles[selectedAttempt.user_id]?.display_name || "Student"}
        studentEmailFallback={profiles[selectedAttempt.user_id]?.full_name ?? null}
        currentUserId={currentUserId}
        attemptId={selectedAttempt.id}
        submittedAt={selectedAttempt.submitted_at}
        submissionType={selectedAttempt.submission_type}
        violationReason={selectedAttempt.violation_reason}
        marksObtained={selectedAttempt.marks_obtained}
        totalMarks={selectedAttempt.total_marks}
        percentage={selectedAttempt.percentage}
        grade={selectedAttempt.grade}
        totalQuestions={selectedAttempt.total_questions}
        timeTakenSec={selectedAttempt.time_taken_sec}
        answers={null}
        onBack={() => setSelectedAttempt(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-accent transition"
        >
          ← Back to normal tests
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{testName}</h2>
            <p className="text-sm text-muted-foreground">{attempts.length} student attempts</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student…"
            className="w-full sm:w-64 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground text-center py-6">
            {attempts.length === 0 ? "No students have attempted this test yet." : "No student matched."}
          </p>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3 text-right">Score</th>
                  <th className="py-2 pr-3">Attempted</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => {
                  const name = a.student_name || profiles[a.user_id]?.display_name || a.user_id.slice(0, 8);
                  return (
                    <tr key={a.id} className="hover:bg-accent/5 transition-colors">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{a.user_id.slice(0, 12)}…</p>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${gradeTone(a.percentage)}`}>
                          {a.grade}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                        {a.marks_obtained}/{a.total_marks} · {a.percentage}%
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDate(a.submitted_at)}</td>
                      <td className="py-2 pr-3">
                        {a.submission_type === "auto-violation" ? (
                          <span className="text-destructive text-xs" title={a.violation_reason ?? ""}>⚠ Auto</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Normal</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button
                          onClick={() => setSelectedAttempt(a)}
                          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold hover:border-accent hover:bg-accent/10 transition"
                        >
                          Analyze →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Scheduled ----------

function ScheduledMockList({
  profiles,
  currentUserId,
}: {
  profiles: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }>;
  currentUserId: string | null;
}) {
  const [tests, setTests] = useState<ScheduledTest[]>([]);
  const [attemptsByTest, setAttemptsByTest] = useState<Record<string, ScheduledAttempt[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("ai_mock_tests" as never)
        .select("id,title,description,duration_sec,total_marks,question_count,status,published_at,created_at")
        .order("created_at", { ascending: false });
      const testList = (t ?? []) as unknown as ScheduledTest[];
      setTests(testList);

      const { data: a } = await supabase
        .from("ai_mock_attempts" as never)
        .select("id,user_id,test_id,started_at,submitted_at,submission_type,violation_reason,marks_obtained,total_marks,percentage,grade,time_taken_sec,answers")
        .order("submitted_at", { ascending: false })
        .limit(2000);
      const grouped: Record<string, ScheduledAttempt[]> = {};
      for (const row of (a ?? []) as unknown as ScheduledAttempt[]) {
        (grouped[row.test_id] ??= []).push(row);
      }
      setAttemptsByTest(grouped);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading scheduled mock tests…</p>;

  if (selectedTestId) {
    const t = tests.find((x) => x.id === selectedTestId);
    return (
      <ScheduledTestDetail
        test={t!}
        attempts={attemptsByTest[selectedTestId] ?? []}
        profiles={profiles}
        currentUserId={currentUserId}
        onBack={() => setSelectedTestId(null)}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((t) => {
        const list = attemptsByTest[t.id] ?? [];
        const avg = list.length ? Math.round(list.reduce((a, b) => a + b.percentage, 0) / list.length) : 0;
        const viol = list.filter((a) => a.submission_type === "auto-violation").length;
        return (
          <button
            key={t.id}
            onClick={() => setSelectedTestId(t.id)}
            className="card-glow group rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-accent font-semibold">📅 Scheduled</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                t.status === "published" ? "bg-[oklch(0.65_0.16_145)]/20 text-[oklch(0.4_0.16_145)]" : "bg-muted text-muted-foreground"
              }`}>
                {t.status}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-bold truncate">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.question_count} questions · {t.total_marks} marks</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Attempts</p>
                <p className="font-bold tabular-nums">{list.length}</p>
              </div>
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Avg %</p>
                <p className="font-bold tabular-nums">{avg}%</p>
              </div>
              <div className="rounded-md bg-secondary py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Viol.</p>
                <p className={`font-bold tabular-nums ${viol > 0 ? "text-destructive" : ""}`}>{viol}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground group-hover:text-accent transition">
              Open student list →
            </p>
          </button>
        );
      })}
      {tests.length === 0 && (
        <p className="text-sm text-muted-foreground">No scheduled mock tests yet. Use the AI Mock Creator to add one.</p>
      )}
    </div>
  );
}

function ScheduledTestDetail({
  test,
  attempts,
  profiles,
  currentUserId,
  onBack,
}: {
  test: ScheduledTest;
  attempts: ScheduledAttempt[];
  profiles: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }>;
  currentUserId: string | null;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState<ScheduledAttempt | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...attempts];
    if (!q) return list;
    return list.filter((a) => {
      const name = (profiles[a.user_id]?.display_name || "").toLowerCase();
      return name.includes(q) || a.user_id.toLowerCase().includes(q);
    });
  }, [attempts, profiles, query]);

  if (selectedAttempt) {
    return (
      <StudentAnalysis
        kind="scheduled"
        testId={test.id}
        testName={test.title}
        studentId={selectedAttempt.user_id}
        studentName={profiles[selectedAttempt.user_id]?.display_name || "Student"}
        studentEmailFallback={profiles[selectedAttempt.user_id]?.full_name ?? null}
        currentUserId={currentUserId}
        attemptId={selectedAttempt.id}
        submittedAt={selectedAttempt.submitted_at}
        submissionType={selectedAttempt.submission_type}
        violationReason={selectedAttempt.violation_reason}
        marksObtained={selectedAttempt.marks_obtained}
        totalMarks={selectedAttempt.total_marks}
        percentage={selectedAttempt.percentage}
        grade={selectedAttempt.grade}
        totalQuestions={selectedAttempt.answers?.length ?? test.question_count}
        timeTakenSec={selectedAttempt.time_taken_sec}
        answers={selectedAttempt.answers ?? null}
        onBack={() => setSelectedAttempt(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-accent transition">
        ← Back to scheduled tests
      </button>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{test.title}</h2>
            <p className="text-sm text-muted-foreground">
              {attempts.length} student attempts · {test.question_count} questions · {test.total_marks} marks
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student…"
            className="w-full sm:w-64 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground text-center py-6">
            {attempts.length === 0 ? "No students have attempted this test yet." : "No student matched."}
          </p>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3 text-right">Score</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Attempted</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => {
                  const name = profiles[a.user_id]?.display_name || a.user_id.slice(0, 8);
                  return (
                    <tr key={a.id} className="hover:bg-accent/5 transition-colors">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{a.user_id.slice(0, 12)}…</p>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${gradeTone(a.percentage)}`}>
                          {a.grade}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                        {a.marks_obtained}/{a.total_marks} · {a.percentage}%
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtTime(a.time_taken_sec)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDate(a.submitted_at)}</td>
                      <td className="py-2 pr-3">
                        {a.submission_type === "auto-violation" ? (
                          <span className="text-destructive text-xs" title={a.violation_reason ?? ""}>⚠ Auto</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Normal</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button
                          onClick={() => setSelectedAttempt(a)}
                          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold hover:border-accent hover:bg-accent/10 transition"
                        >
                          Analyze →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Student analysis (shared) ----------

function StudentAnalysis(props: {
  kind: "normal" | "scheduled";
  testId: string;
  testName: string;
  studentId: string;
  studentName: string;
  studentEmailFallback: string | null;
  currentUserId: string | null;
  attemptId: string;
  submittedAt: string | null;
  submissionType: string;
  violationReason: string | null;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  totalQuestions: number;
  timeTakenSec: number;
  answers: GradedAnswer[] | null;
  onBack: () => void;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState<CommentRow | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [commentLoaded, setCommentLoaded] = useState(false);

  // Load existing comment
  useEffect(() => {
    (async () => {
      setCommentLoaded(false);
      const { data } = await supabase
        .from("mock_test_attempt_comments" as never)
        .select("*")
        .eq("attempt_kind", props.kind)
        .eq("attempt_id", props.attemptId)
        .maybeSingle();
      if (data) {
        const row = data as unknown as CommentRow;
        setComment(row);
        setCommentDraft(row.comment_text);
      } else {
        setComment(null);
        setCommentDraft("");
      }
      setCommentLoaded(true);
    })();
  }, [props.kind, props.attemptId]);

  const saveComment = async () => {
    if (!props.currentUserId) return;
    setSavingComment(true);
    try {
      if (comment) {
        const { data, error } = await (supabase
          .from("mock_test_attempt_comments" as never) as any)
          .update({ comment_text: commentDraft, teacher_id: props.currentUserId })
          .eq("id", comment.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) setComment(data as unknown as CommentRow);
      } else {
        const { data, error } = await (supabase
          .from("mock_test_attempt_comments" as never) as any)
          .insert({
            attempt_kind: props.kind,
            attempt_id: props.attemptId,
            student_id: props.studentId,
            teacher_id: props.currentUserId,
            test_id: props.testId,
            comment_text: commentDraft,
          })
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) setComment(data as unknown as CommentRow);
      }
      setShowCommentBox(false);
    } catch (e) {
      console.error("save comment", e);
      alert("Could not save comment. Please try again.");
    } finally {
      setSavingComment(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setDownloadingPdf(true);
    try {
      const { exportNodeToPdf } = await import("@/lib/pdf-export");
      const safeStudent = props.studentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const safeTest = props.testName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await exportNodeToPdf(
        reportRef.current,
        `${safeTest}-${safeStudent}-${new Date().toISOString().slice(0, 10)}`,
      );
    } catch (err) {
      console.error("Mock report PDF export failed", err);
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const answers = props.answers ?? [];
  const attempted = answers.filter((a) => (a.response ?? "").trim().length > 0).length;
  const correct = answers.filter((a) => a.correct).length;
  const partial = answers.filter((a) => !a.correct && a.marks_awarded > 0).length;
  const wrong = answers.filter((a) => !a.correct && a.marks_awarded === 0 && (a.response ?? "").trim().length > 0).length;
  const skipped = Math.max(0, props.totalQuestions - attempted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={props.onBack} className="text-sm text-muted-foreground hover:text-accent transition">
          ← Back to student list
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCommentDraft(comment?.comment_text ?? "");
              setShowCommentBox((v) => !v);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:border-accent hover:bg-accent/10 transition"
            title="Add or edit teacher comment"
          >
            💬 {comment ? "Edit comment" : "Add comment"}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {downloadingPdf ? "Preparing…" : "⬇ Download PDF"}
          </button>
        </div>
      </div>

      {showCommentBox && (
        <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Teacher comment for {props.studentName}
          </label>
          <textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Write feedback for this student's attempt…"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setShowCommentBox(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              onClick={saveComment}
              disabled={savingComment}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {savingComment ? "Saving…" : "Save comment"}
            </button>
          </div>
        </div>
      )}

      <div ref={reportRef} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">
              {props.kind === "normal" ? "Normal mock test" : "Scheduled mock test"} · analysis
            </p>
            <h2 className="mt-1 text-2xl font-bold">{props.studentName}</h2>
            <p className="text-sm text-muted-foreground">{props.testName}</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">Student ID: {props.studentId}</p>
          </div>
          <div className={`rounded-2xl border-2 px-6 py-4 text-center ${gradeTone(props.percentage)}`}>
            <p className="text-4xl font-black tabular-nums">{props.percentage}%</p>
            <p className="text-xs uppercase tracking-widest mt-1">Grade {props.grade}</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatBox label="Marks obtained" value={`${props.marksObtained}/${props.totalMarks}`} />
          <StatBox label="Total questions" value={props.totalQuestions} />
          <StatBox label="Time taken" value={fmtTime(props.timeTakenSec)} />
          <StatBox
            label="Submission"
            value={props.submissionType === "auto-violation" ? "Auto (violation)" : "Normal"}
            tone={props.submissionType === "auto-violation" ? "bad" : "good"}
          />
        </div>

        {answers.length > 0 && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            <StatBox label="Attempted" value={attempted} tone="good" />
            <StatBox label="Correct" value={correct} tone="good" />
            <StatBox label="Partial" value={partial} tone="warn" />
            <StatBox label="Wrong" value={wrong} tone="bad" />
            <StatBox label="Not attempted" value={skipped} tone="warn" />
          </div>
        )}

        {props.submissionType === "auto-violation" && props.violationReason && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold">⚠ Violation reason</p>
            <p className="mt-1">{props.violationReason}</p>
          </div>
        )}

        {/* Question-wise breakdown (only if answers available) */}
        {answers.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Question-wise analysis
            </h3>
            <ol className="space-y-2">
              {answers.map((a, i) => {
                const tone = a.correct
                  ? "border-l-[oklch(0.65_0.16_145)]"
                  : a.marks_awarded > 0
                    ? "border-l-[oklch(0.78_0.16_85)]"
                    : "border-l-destructive";
                return (
                  <li key={a.question_id + i} className={`rounded-md border border-border border-l-4 ${tone} bg-background/40 p-3`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Q{i + 1} · {a.marks_awarded}/{a.marks_total} marks</p>
                      <span className={`text-xs font-bold ${a.correct ? "text-[oklch(0.4_0.16_145)]" : a.marks_awarded > 0 ? "text-[oklch(0.5_0.16_85)]" : "text-destructive"}`}>
                        {a.correct ? "✓ Correct" : a.marks_awarded > 0 ? "◐ Partial" : (a.response ?? "").trim() ? "✗ Wrong" : "— Skipped"}
                        {a.code_total !== null ? ` · ${a.code_passed ?? 0}/${a.code_total} tests` : ""}
                      </span>
                    </div>
                    {a.response && (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">Answer: </span>
                        <span className="font-mono">{a.response.length > 240 ? a.response.slice(0, 240) + "…" : a.response}</span>
                      </p>
                    )}
                    {a.correct_answer && !a.correct && (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">Expected: </span>
                        <span className="font-mono">{a.correct_answer}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background/40 p-4 text-sm text-muted-foreground">
            Per-question breakdown is not stored for normal mock tests. Aggregate stats above summarize this attempt.
          </div>
        )}

        {/* Overall performance summary */}
        <div className="rounded-md border border-border bg-background/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Performance summary
          </h3>
          <p className="text-sm">
            {props.studentName} scored <b>{props.marksObtained}/{props.totalMarks}</b> ({props.percentage}%, grade {props.grade})
            on <b>{props.testName}</b> in {fmtTime(props.timeTakenSec)}
            {answers.length > 0 && ` — ${correct} correct, ${partial} partial, ${wrong} wrong, ${skipped} not attempted`}.
            Submitted {fmtDate(props.submittedAt)}.
          </p>
        </div>

        {/* Teacher comment */}
        <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            💬 Teacher comment
          </h3>
          {!commentLoaded ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : comment && comment.comment_text ? (
            <>
              <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">Last updated {fmtDate(comment.updated_at)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No comment yet — click "Add comment" above.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const ring =
    tone === "good"
      ? "border-l-[oklch(0.65_0.16_145)]"
      : tone === "bad"
        ? "border-l-destructive"
        : tone === "warn"
          ? "border-l-[oklch(0.78_0.16_85)]"
          : "border-l-accent";
  return (
    <div className={`rounded-md border border-border border-l-4 ${ring} bg-background/60 p-3`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

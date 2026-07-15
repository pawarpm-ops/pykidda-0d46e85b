import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DueDateTimePicker } from "@/components/DueDateTimePicker";
import {
  adminGetHomework,
  adminUpdateHomework,
  adminAddQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminListSubmissions,
  adminGetSubmissionDetail,
  adminGradeAnswer,
  adminFinalizeCheck,
} from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/admin/homework/$id")({
  head: () => ({
    meta: [
      { title: "Edit Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomeworkEditor,
  ssr: false,
});

// ============================================================
// Types
// ============================================================

type Question = {
  id: string;
  homework_id: string;
  question_order: number;
  question_type: string;
  title: string;
  description: string;
  marks: number;
  test_cases: unknown;
};

type Homework = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  estimated_minutes: number | null;
  status: "draft" | "published" | "closed";
  total_marks: number;
};

type AnyRec = Record<string, unknown> & { [k: string]: any };

// ============================================================
// Helpers
// ============================================================

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Expected answer lives inside test_cases[0].expected so it stays hidden from
// students (getStudentHomework never selects test_cases).
function extractExpectedAnswer(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const first = raw[0];
  if (!first || typeof first !== "object") return "";
  const r = first as Record<string, unknown>;
  return typeof r.expected === "string" ? r.expected : "";
}

function makeExpectedAnswerPayload(answer: string) {
  return [{ input: "", expected: answer, visibility: "hidden" }];
}

// ============================================================
// Editor root
// ============================================================

function AdminHomeworkEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetHomework);
  const [tab, setTab] = useState<"edit" | "submissions">("edit");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-homework", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading || !data)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-8">Loading…</main>
      </div>
    );

  const homework = data.homework as Homework;
  const questions = (data.questions as Question[]).sort(
    (a, b) => a.question_order - b.question_order,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/admin/homework"
          className="text-sm text-muted-foreground hover:text-accent"
        >
          ← Back to homework list
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {homework.title || "Untitled homework"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-semibold capitalize">{homework.status}</span>{" "}
              · {questions.length} questions · {Number(homework.total_marks)} marks
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            {(["edit", "submissions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  tab === t
                    ? "font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
                style={
                  tab === t
                    ? { backgroundImage: "var(--gradient-sunrise)" }
                    : undefined
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === "edit" && (
          <EditPanel
            homework={homework}
            questions={questions}
            onChanged={refetch}
          />
        )}
        {tab === "submissions" && (
          <SubmissionsPanel homeworkId={id} questions={questions} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// Edit panel — simple manual creation flow
// ============================================================

function EditPanel({
  homework,
  questions,
  onChanged,
}: {
  homework: Homework;
  questions: Question[];
  onChanged: () => Promise<unknown> | void;
}) {
  const updateFn = useServerFn(adminUpdateHomework);

  const [title, setTitle] = useState(homework.title ?? "");
  const [description, setDescription] = useState(homework.description ?? "");
  const [dueAt, setDueAt] = useState(toLocalInput(homework.due_at));
  const [busy, setBusy] = useState<null | "save" | "publish">(null);
  const [msg, setMsg] = useState<
    | { kind: "ok" | "err"; text: string }
    | null
  >(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setTitle(homework.title ?? "");
    setDescription(homework.description ?? "");
    setDueAt(toLocalInput(homework.due_at));
  }, [homework.id, homework.title, homework.description, homework.due_at]);

  async function saveDetails(nextStatus?: "published") {
    if (!title.trim()) {
      setMsg({ kind: "err", text: "Title is required." });
      return;
    }
    if (nextStatus === "published") {
      if (!dueAt) {
        setMsg({ kind: "err", text: "Set a due date before publishing." });
        return;
      }
      if (questions.length === 0) {
        setMsg({ kind: "err", text: "Add at least one question before publishing." });
        return;
      }
    }
    setBusy(nextStatus === "published" ? "publish" : "save");
    setMsg(null);
    try {
      await updateFn({
        data: {
          id: homework.id,
          title: title.trim(),
          description,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          allow_late_submission: homework.allow_late_submission ?? true,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });
      await onChanged();
      setMsg({
        kind: "ok",
        text: nextStatus === "published" ? "Published!" : "Saved as draft.",
      });
    } catch (e) {
      setMsg({
        kind: "err",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Homework details */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Homework details</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Basic info shown to students on the homework page.
        </p>

        <div className="mt-4 grid gap-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3 — Functions & Recursion"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short summary of what this homework is about."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            />
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Scheduling — due date & time
            </p>
            <div className="mt-2">
              <DueDateTimePicker value={dueAt} onChange={setDueAt} />
            </div>
          </div>
        </div>

        {msg && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-xs ${
              msg.kind === "ok"
                ? "border border-accent/40 bg-accent/10 text-accent"
                : "border border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => saveDetails()}
            disabled={busy !== null}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          {homework.status !== "published" && (
            <button
              onClick={() => saveDetails("published")}
              disabled={busy !== null}
              className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </section>

      {/* Questions */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Questions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each question has the question text students see and an expected
              answer only you can see.
            </p>
          </div>
          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {questions.length} added
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-3">
          {questions.map((q, i) => (
            <li key={q.id}>
              <QuestionCard
                idx={i}
                question={q}
                onChanged={onChanged}
              />
            </li>
          ))}
          {questions.length === 0 && !adding && (
            <li className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              No questions yet. Click <span className="font-semibold">Add question</span> below to add one.
            </li>
          )}
        </ul>

        {adding ? (
          <div className="mt-4">
            <AddQuestionForm
              homeworkId={homework.id}
              nextOrder={(questions.at(-1)?.question_order ?? 0) + 1}
              onCancel={() => setAdding(false)}
              onAdded={async () => {
                await onChanged();
                setAdding(false);
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-dashed border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
          >
            <Plus size={16} /> Add question
          </button>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Add / edit a single question
// ============================================================

function AddQuestionForm({
  homeworkId,
  nextOrder,
  onCancel,
  onAdded,
}: {
  homeworkId: string;
  nextOrder: number;
  onCancel: () => void;
  onAdded: () => Promise<unknown> | void;
}) {
  const addFn = useServerFn(adminAddQuestion);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [marks, setMarks] = useState("5");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setErr(null);
    if (!question.trim()) {
      setErr("Please write the question.");
      return;
    }
    if (!answer.trim()) {
      setErr("Please write the expected answer.");
      return;
    }
    const marksNum = Math.max(1, Math.min(100, Number(marks) || 1));
    setBusy(true);
    try {
      const trimmedQ = question.trim();
      await addFn({
        data: {
          homework_id: homeworkId,
          question_order: nextOrder,
          question_type: "descriptive",
          title: trimmedQ.slice(0, 120),
          description: trimmedQ,
          marks: marksNum,
          difficulty: "easy",
          test_cases: makeExpectedAnswerPayload(answer.trim()),
        },
      });
      await onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-accent/50 bg-accent/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">New question</h3>
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-background p-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Question
          <textarea
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="Write the question exactly as the student will see it."
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Expected answer <span className="text-[10px] normal-case text-muted-foreground/70">(only visible to you — used as a reference while grading)</span>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="What answer do you expect from the student?"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Marks
          <input
            type="number"
            min={1}
            max={100}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="mt-1 w-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {err && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  idx,
  question,
  onChanged,
}: {
  idx: number;
  question: Question;
  onChanged: () => Promise<unknown> | void;
}) {
  const updateFn = useServerFn(adminUpdateQuestion);
  const deleteFn = useServerFn(adminDeleteQuestion);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.description ?? "");
  const [answer, setAnswer] = useState(extractExpectedAnswer(question.test_cases));
  const [marks, setMarks] = useState(String(Number(question.marks ?? 1)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(question.description ?? "");
    setAnswer(extractExpectedAnswer(question.test_cases));
    setMarks(String(Number(question.marks ?? 1)));
  }, [question.id, question.description, question.test_cases, question.marks]);

  async function handleSave() {
    setErr(null);
    if (!text.trim()) { setErr("Question is required."); return; }
    if (!answer.trim()) { setErr("Expected answer is required."); return; }
    const marksNum = Math.max(1, Math.min(100, Number(marks) || 1));
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: question.id,
          title: text.trim().slice(0, 120),
          description: text.trim(),
          marks: marksNum,
          test_cases: makeExpectedAnswerPayload(answer.trim()),
        },
      });
      await onChanged();
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: question.id } });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-accent/50 bg-accent/5 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Edit Q{idx + 1}</h3>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-border bg-background p-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Question
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Expected answer
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Marks
            <input
              type="number"
              min={1}
              max={100}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="mt-1 w-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>
        {err && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Q{idx + 1}</p>
        <span className="text-[11px] text-muted-foreground">
          {Number(question.marks)} marks
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{question.description}</p>
      <div className="mt-3 rounded-md border border-dashed border-border bg-secondary/30 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Expected answer (hidden from students)
        </p>
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
          {extractExpectedAnswer(question.test_cases) || (
            <span className="italic">Not set</span>
          )}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:border-accent/60"
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-destructive hover:border-destructive/60 disabled:opacity-50"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Submissions + grading (unchanged behaviour)
// ============================================================

function SubmissionsPanel({
  homeworkId,
  questions,
}: {
  homeworkId: string;
  questions: Question[];
}) {
  const listFn = useServerFn(adminListSubmissions);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hw-subs", homeworkId],
    queryFn: () => listFn({ data: { homework_id: homeworkId } }),
  });
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);

  if (isLoading)
    return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6">
      {(!data || data.length === 0) && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold">No submissions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Students will appear here after they submit.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((s: AnyRec) => {
          const name =
            s.profile?.display_name ?? s.profile?.full_name ?? s.student_id.slice(0, 8);
          const badge = statusBadgeAdmin(s.status, s.is_late);
          return (
            <li key={s.id}>
              <button
                onClick={() => setOpenSubmissionId(s.id)}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:border-accent/60"
              >
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.submitted_at
                      ? `Submitted ${new Date(s.submitted_at).toLocaleString()}`
                      : "Not submitted"}
                  </p>
                </div>
                {s.total_marks_obtained != null && (
                  <span className="text-xs text-muted-foreground">
                    {Number(s.total_marks_obtained)} marks
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                >
                  {badge.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {openSubmissionId && (
        <GradingModal
          submissionId={openSubmissionId}
          questions={questions}
          onClose={() => setOpenSubmissionId(null)}
          onDone={async () => {
            setOpenSubmissionId(null);
            await refetch();
          }}
        />
      )}
    </div>
  );
}

function statusBadgeAdmin(status: string, isLate: boolean) {
  if (status === "checked")
    return { text: "Checked", cls: "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40" };
  if (status === "returned")
    return { text: "Returned", cls: "bg-destructive/10 text-destructive border-destructive/40" };
  if (status === "late" || isLate)
    return { text: "Submitted Late", cls: "bg-[oklch(0.72_0.16_60)]/15 text-[oklch(0.55_0.18_45)] border-[oklch(0.72_0.16_60)]/50" };
  if (status === "submitted")
    return { text: "Submitted", cls: "bg-accent/15 text-accent-foreground border-accent/40" };
  return { text: "Not submitted", cls: "bg-secondary text-secondary-foreground border-border" };
}

function GradingModal({
  submissionId,
  questions,
  onClose,
  onDone,
}: {
  submissionId: string;
  questions: Question[];
  onClose: () => void;
  onDone: () => void;
}) {
  const getFn = useServerFn(adminGetSubmissionDetail);
  const gradeFn = useServerFn(adminGradeAnswer);
  const finalizeFn = useServerFn(adminFinalizeCheck);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hw-sub", submissionId],
    queryFn: () => getFn({ data: { submission_id: submissionId } }),
  });
  const [feedback, setFeedback] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !seeded) {
      setFeedback(data.submission.teacher_feedback ?? "");
      setSeeded(true);
    }
  }, [data, seeded]);

  async function finalize(returnForCorrection: boolean) {
    setBusy(true);
    try {
      await finalizeFn({
        data: {
          submission_id: submissionId,
          teacher_feedback: feedback || null,
          return_for_correction: returnForCorrection,
        },
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-4xl rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Grade submission</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
        {isLoading || !data ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mt-3 text-sm">
              <p className="font-semibold">
                {data.profile?.display_name ?? data.profile?.full_name ?? "Student"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.submission.submitted_at
                  ? `Submitted ${new Date(data.submission.submitted_at).toLocaleString()}`
                  : "Not submitted"}
                {data.submission.is_late ? " · Late" : ""}
                {" · Total: "}
                {Number(data.submission.total_marks_obtained ?? 0)} /{" "}
                {Number(data.homework?.total_marks ?? 0)}
              </p>
            </div>

            <ul className="mt-5 flex flex-col gap-4">
              {questions.map((q, i) => {
                const ans = data.answers.find(
                  (a: AnyRec) => a.homework_question_id === q.id,
                );
                return (
                  <li key={q.id}>
                    <GradeAnswerRow
                      idx={i}
                      q={q}
                      ans={ans ?? null}
                      onGraded={async (marks, comment) => {
                        if (!ans) return;
                        await gradeFn({
                          data: {
                            answer_id: ans.id,
                            marks_awarded: marks,
                            teacher_comment: comment || null,
                          },
                        });
                        await refetch();
                      }}
                    />
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-lg border border-border bg-background p-3">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Overall feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => finalize(false)}
                  disabled={busy}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Mark as checked
                </button>
                <button
                  onClick={() => finalize(true)}
                  disabled={busy}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm text-destructive"
                >
                  Return for correction
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GradeAnswerRow({
  idx,
  q,
  ans,
  onGraded,
}: {
  idx: number;
  q: Question;
  ans: {
    id: string;
    student_answer: string | null;
    student_code: string | null;
    execution_output: string | null;
    marks_awarded: number | null;
    teacher_comment: string | null;
    checked_status: string;
  } | null;
  onGraded: (marks: number | null, comment: string) => Promise<void>;
}) {
  const [marks, setMarks] = useState<string>(
    ans?.marks_awarded != null ? String(ans.marks_awarded) : "",
  );
  const [comment, setComment] = useState(ans?.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const expected = extractExpectedAnswer(q.test_cases);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">Q{idx + 1}</p>
        <span className="text-xs text-muted-foreground">
          out of {Number(q.marks)}
        </span>
      </div>
      {q.description && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
          {q.description}
        </p>
      )}

      {expected && (
        <div className="mt-2 rounded-md border border-dashed border-border bg-secondary/30 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Expected answer
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs">{expected}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Student answer
        </p>
        {ans?.student_answer && (
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-xs">
            {ans.student_answer}
          </pre>
        )}
        {ans?.student_code && (
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-[oklch(0.18_0.02_250)] p-2 font-mono text-xs text-[oklch(0.97_0.005_85)]">
            {ans.student_code}
          </pre>
        )}
        {!ans && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            No answer submitted.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          max={Number(q.marks)}
          step={0.5}
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="Marks"
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          disabled={!ans}
        />
        <span className="text-xs text-muted-foreground">/ {Number(q.marks)}</span>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment for this question (optional)"
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
          disabled={!ans}
        />
        <button
          disabled={!ans || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onGraded(marks === "" ? null : Number(marks), comment);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

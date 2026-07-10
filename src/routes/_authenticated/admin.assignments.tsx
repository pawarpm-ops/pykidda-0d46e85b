import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DueDateTimePicker } from "@/components/DueDateTimePicker";
import { useIsAdmin } from "@/lib/role";
import {
  adminCreateAssignment,
  adminDeleteAssignment,
  adminListAssignments,
  adminListSubmissions,
  adminReviewSubmission,
  adminUpdateAssignment,
} from "@/lib/assignments.functions";
import { GenerateAiDialog, RefineAiDialog, HomeworkEntryCards } from "@/components/HomeworkAiDialogs";


export const Route = createFileRoute("/_authenticated/admin/assignments")({
  head: () => ({
    meta: [
      { title: "Homework · Admin · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAssignmentsPage,
  ssr: false,
});

type FormState = {
  id?: string;
  title: string;
  description: string;
  unit: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  assignment_type: "coding" | "written" | "mixed";
  total_marks: string;
  due_at: string;
  allow_late_submission: boolean;
  status: "draft" | "published" | "closed";
  sample_input: string;
  sample_output: string;
  expected_output: string;
  starter_code: string;
  submission_mode: "submit" | "self_solve";
};

const empty: FormState = {
  title: "",
  description: "",
  unit: "",
  topic: "",
  difficulty: "medium",
  assignment_type: "coding",
  total_marks: "10",
  due_at: "",
  allow_late_submission: false,
  status: "draft",
  sample_input: "",
  sample_output: "",
  expected_output: "",
  starter_code: "",
  submission_mode: "submit",
};


function toISO(local: string) {
  // datetime-local returns "YYYY-MM-DDTHH:mm"
  if (!local) return "";
  const d = new Date(local);
  return d.toISOString();
}
function fromISO(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminAssignmentsPage() {
  const isAdmin = useIsAdmin();
  const listFn = useServerFn(adminListAssignments);
  const createFn = useServerFn(adminCreateAssignment);
  const updateFn = useServerFn(adminUpdateAssignment);
  const deleteFn = useServerFn(adminDeleteAssignment);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: () => listFn(),
    enabled: isAdmin === true,
  });

  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  if (isAdmin === false) return <Navigate to="/" />;
  if (isAdmin === null) return null;

  function loadInto(a: any) {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      unit: a.unit != null ? String(a.unit) : "",
      topic: a.topic ?? "",
      difficulty: a.difficulty,
      assignment_type: a.assignment_type,
      total_marks: String(a.total_marks),
      due_at: a.due_at ? fromISO(a.due_at) : "",
      allow_late_submission: !!a.allow_late_submission,
      status: a.status,
      sample_input: a.sample_input ?? "",
      sample_output: a.sample_output ?? "",
      expected_output: a.expected_output ?? "",
      starter_code: a.starter_code ?? "",
      submission_mode: (a.submission_mode as "submit" | "self_solve") ?? "submit",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function save(publishOverride?: "published" | "draft") {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        unit: form.unit ? Number(form.unit) : null,
        topic: form.topic || null,
        difficulty: form.difficulty,
        assignment_type: form.assignment_type,
        total_marks: Number(form.total_marks) || 10,
        due_at: form.submission_mode === "self_solve" ? null : (form.due_at ? toISO(form.due_at) : null),
        allow_late_submission: form.allow_late_submission,
        status: publishOverride ?? form.status,
        sample_input: form.sample_input || null,
        sample_output: form.sample_output || null,
        expected_output: form.expected_output || null,
        starter_code: form.starter_code || null,
        submission_mode: form.submission_mode,
      };
      if (!payload.title) throw new Error("Title required");
      if (form.submission_mode === "submit" && !payload.due_at) throw new Error("Due date required for submit-mode homework");

      if (form.id) {
        await updateFn({ data: { id: form.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
      setForm(empty);
      setMsg("Saved ✓");
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }


  async function remove(id: string) {
    if (!confirm("Delete assignment and all submissions?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    if (reviewing === id) setReviewing(null);
  }

  async function togglePublish(a: any) {
    const next = a.status === "published" ? "draft" : "published";
    await updateFn({ data: { id: a.id, status: next } });
    qc.invalidateQueries({ queryKey: ["admin-assignments"] });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Homework Admin 📚</h1>
            <p className="text-sm text-muted-foreground">Create, publish, and grade Python assignments.</p>
          </div>
          <Link to="/admin" className="text-sm text-accent hover:underline">← Back to Admin</Link>
        </div>
        <HomeworkAdminSection
          form={form}
          setForm={setForm}
          data={data}
          isLoading={isLoading}
          busy={busy}
          msg={msg}
          reviewing={reviewing}
          setReviewing={setReviewing}
          save={save}
          remove={remove}
          togglePublish={togglePublish}
          loadInto={loadInto}
          resetForm={() => setForm(empty)}
        />
      </main>
    </div>
  );
}

export function HomeworkAdminTab() {
  const isAdmin = useIsAdmin();
  const listFn = useServerFn(adminListAssignments);
  const createFn = useServerFn(adminCreateAssignment);
  const updateFn = useServerFn(adminUpdateAssignment);
  const deleteFn = useServerFn(adminDeleteAssignment);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: () => listFn(),
    enabled: isAdmin === true,
  });

  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  function loadInto(a: any) {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      unit: a.unit != null ? String(a.unit) : "",
      topic: a.topic ?? "",
      difficulty: a.difficulty,
      assignment_type: a.assignment_type,
      total_marks: String(a.total_marks),
      due_at: a.due_at ? fromISO(a.due_at) : "",
      allow_late_submission: !!a.allow_late_submission,
      status: a.status,
      sample_input: a.sample_input ?? "",
      sample_output: a.sample_output ?? "",
      expected_output: a.expected_output ?? "",
      starter_code: a.starter_code ?? "",
      submission_mode: (a.submission_mode as "submit" | "self_solve") ?? "submit",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function save(publishOverride?: "published" | "draft") {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        unit: form.unit ? Number(form.unit) : null,
        topic: form.topic || null,
        difficulty: form.difficulty,
        assignment_type: form.assignment_type,
        total_marks: Number(form.total_marks) || 10,
        due_at: form.submission_mode === "self_solve" ? null : (form.due_at ? toISO(form.due_at) : null),
        allow_late_submission: form.allow_late_submission,
        status: publishOverride ?? form.status,
        sample_input: form.sample_input || null,
        sample_output: form.sample_output || null,
        expected_output: form.expected_output || null,
        starter_code: form.starter_code || null,
        submission_mode: form.submission_mode,
      };
      if (!payload.title) throw new Error("Title required");
      if (form.submission_mode === "submit" && !payload.due_at) throw new Error("Due date required for submit-mode homework");
      if (form.id) await updateFn({ data: { id: form.id, ...payload } });
      else await createFn({ data: payload });
      setForm(empty);
      setMsg("Saved ✓");
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }


  async function remove(id: string) {
    if (!confirm("Delete assignment and all submissions?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    if (reviewing === id) setReviewing(null);
  }

  async function togglePublish(a: any) {
    const next = a.status === "published" ? "draft" : "published";
    await updateFn({ data: { id: a.id, status: next } });
    qc.invalidateQueries({ queryKey: ["admin-assignments"] });
  }

  if (isAdmin !== true) return null;

  return (
    <HomeworkAdminSection
      form={form}
      setForm={setForm}
      data={data}
      isLoading={isLoading}
      busy={busy}
      msg={msg}
      reviewing={reviewing}
      setReviewing={setReviewing}
      save={save}
      remove={remove}
      togglePublish={togglePublish}
      loadInto={loadInto}
      resetForm={() => setForm(empty)}
    />
  );
}

function HomeworkAdminSection({
  form, setForm, data, isLoading, busy, msg, reviewing, setReviewing,
  save, remove, togglePublish, loadInto, resetForm,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  data: any[] | undefined;
  isLoading: boolean;
  busy: boolean;
  msg: string | null;
  reviewing: string | null;
  setReviewing: (v: string | null) => void;
  save: (publishOverride?: "published" | "draft") => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePublish: (a: any) => Promise<void>;
  loadInto: (a: any) => void;
  resetForm: () => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const formOpen = showManual || !!form.id;
  return (
    <>
      {!formOpen && (
        <HomeworkEntryCards
          onManual={() => { setShowManual(true); setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 50); }}
          onAi={() => setShowAi(true)}
        />
      )}
      {showAi && <GenerateAiDialog onClose={() => setShowAi(false)} onSaved={() => setShowAi(false)} />}
      {refiningId && <RefineAiDialog assignmentId={refiningId} onClose={() => setRefiningId(null)} onApplied={() => setRefiningId(null)} />}

      {/* Create / Edit form */}
      {formOpen && (
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{form.id ? "Edit homework question" : "Create homework question"}</h2>
          <button
            onClick={() => { resetForm(); setShowManual(false); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Close form
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Title *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Topic">
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={inputCls} placeholder="e.g. Loops, Functions" />
          </Field>
          <Field label="Description / instructions" full>
            <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Unit">
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value.replace(/[^0-9]/g, "") })} className={inputCls} placeholder="1" />
          </Field>
          <Field label="Difficulty">
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Type">
            <select value={form.assignment_type} onChange={(e) => setForm({ ...form, assignment_type: e.target.value as any })} className={inputCls}>
              <option value="coding">Coding</option>
              <option value="written">Written</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>
          <Field label="Total marks">
            <input value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value.replace(/[^0-9]/g, "") })} className={inputCls} />
          </Field>
          <Field label="Mode">
            <select value={form.submission_mode} onChange={(e) => setForm({ ...form, submission_mode: e.target.value as "submit" | "self_solve" })} className={inputCls}>
              <option value="submit">Submit for grading</option>
              <option value="self_solve">Self-solve (like Practice)</option>
            </select>
          </Field>
          {form.submission_mode === "submit" && (
            <Field label="Due date & time *" full>
              <DueDateTimePicker value={form.due_at} onChange={(v) => setForm({ ...form, due_at: v })} />
            </Field>
          )}
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          {form.submission_mode === "submit" && (
            <Field label="" full>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allow_late_submission} onChange={(e) => setForm({ ...form, allow_late_submission: e.target.checked })} />
                Allow late submissions after due date
              </label>
            </Field>
          )}
          <Field label="Sample input">
            <textarea rows={3} value={form.sample_input} onChange={(e) => setForm({ ...form, sample_input: e.target.value })} className={inputCls + " font-mono text-xs"} />
          </Field>
          <Field label="Sample output">
            <textarea rows={3} value={form.sample_output} onChange={(e) => setForm({ ...form, sample_output: e.target.value })} className={inputCls + " font-mono text-xs"} />
          </Field>
          <Field label="Expected output (internal)">
            <textarea rows={3} value={form.expected_output} onChange={(e) => setForm({ ...form, expected_output: e.target.value })} className={inputCls + " font-mono text-xs"} />
          </Field>
          <Field label="Starter code">
            <textarea rows={3} value={form.starter_code} onChange={(e) => setForm({ ...form, starter_code: e.target.value })} className={inputCls + " font-mono text-xs"} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => save()} disabled={busy} className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50" style={{ backgroundImage: "var(--gradient-sunrise)" }}>
            {form.id ? "Save changes" : "Save draft"}
          </button>
          {!form.id && (
            <button onClick={() => save("published")} disabled={busy} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-50">
              Save & publish
            </button>
          )}
          {form.id && <button onClick={resetForm} className="rounded-md border border-border bg-background px-3 py-2 text-sm">Cancel edit</button>}
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </section>
      )}

      {/* List */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">All homework</h2>
        {isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
        <ul className="mt-3 space-y-3">
          {data?.map((a: any) => {
            const due = a.due_at ? new Date(a.due_at) : null;
            const overdue = due ? due < new Date() : false;
            const statusPill = a.status === "published"
              ? "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.45_0.16_145)] border-[oklch(0.65_0.16_145)]/40"
              : a.status === "closed" ? "bg-secondary text-secondary-foreground border-border"
              : "bg-secondary/50 text-muted-foreground border-border";
            const src = (a.question_source ?? "manual") as string;
            const srcLabel = src === "ai_generated" ? "🤖 AI-generated" : src === "migrated_practice" ? "📥 From Practice" : "✍ Manual";
            const srcCls = src === "ai_generated"
              ? "border-primary/40 bg-primary/10 text-primary"
              : src === "migrated_practice"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border bg-secondary text-secondary-foreground";
            return (
              <li key={a.id} className="card-glow rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{a.title}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPill}`}>{a.status}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${srcCls}`}>{srcLabel}</span>
                      {a.refined_by_ai && <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">✨ AI-refined</span>}
                      {a.submission_mode === "self_solve" && <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Self-solve</span>}
                      {overdue && a.status === "published" && (
                        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Overdue</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.assignment_type} · {a.difficulty}
                      {a.unit != null ? ` · Unit ${a.unit}` : ""} · {a.total_marks} marks
                      {due ? ` · Due ${due.toLocaleString()}` : " · No due date"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.counts.submitted} submitted · {a.counts.reviewed} reviewed
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReviewing(reviewing === a.id ? null : a.id)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                      {reviewing === a.id ? "Hide submissions" : "Submissions"}
                    </button>
                    <button
                      onClick={() => setRefiningId(a.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                      title="Rewrite this question with AI"
                    >
                      <Sparkles size={14} /> Refine with AI
                    </button>
                    <button onClick={() => loadInto(a)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">Edit</button>
                    <button onClick={() => togglePublish(a)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                      {a.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button onClick={() => remove(a.id)} className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">Delete</button>
                  </div>
                </div>
                {reviewing === a.id && <SubmissionsPanel assignmentId={a.id} totalMarks={a.total_marks} />}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );

}

const inputCls = "block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      {label && <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SubmissionsPanel({ assignmentId, totalMarks }: { assignmentId: string; totalMarks: number }) {
  const listFn = useServerFn(adminListSubmissions);
  const reviewFn = useServerFn(adminReviewSubmission);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "on_time" | "late">("all");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-submissions", assignmentId],
    queryFn: () => listFn({ data: { assignment_id: assignmentId } }),
  });

  const filtered = (data ?? []).filter((s: any) => {
    if (filter === "all") return true;
    if (filter === "late") return !!s.is_late;
    return !s.is_late && (s.status === "submitted" || s.status === "reviewed");
  });

  const counts = (data ?? []).reduce(
    (acc: { total: number; late: number; onTime: number }, s: any) => {
      acc.total++;
      if (s.is_late) acc.late++;
      else if (s.status === "submitted" || s.status === "reviewed") acc.onTime++;
      return acc;
    },
    { total: 0, late: 0, onTime: 0 },
  );

  const tabCls = (active: boolean) =>
    `rounded-md border px-3 py-1 text-xs font-semibold ${active ? "border-accent bg-accent/15 text-accent-foreground" : "border-border bg-background text-muted-foreground"}`;

  return (
    <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("all")} className={tabCls(filter === "all")}>All ({counts.total})</button>
        <button onClick={() => setFilter("on_time")} className={tabCls(filter === "on_time")}>On time ({counts.onTime})</button>
        <button onClick={() => setFilter("late")} className={tabCls(filter === "late")}>Late ({counts.late})</button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && filtered.length === 0 && <p className="text-sm text-muted-foreground">No submissions in this view.</p>}
      <ul className="space-y-3">
        {filtered.map((s: any) => (
          <SubmissionRow
            key={s.id}
            sub={s}
            totalMarks={totalMarks}
            onReview={async (marks, feedback) => {
              await reviewFn({ data: { submission_id: s.id, marks_obtained: marks, teacher_feedback: feedback } });
              qc.invalidateQueries({ queryKey: ["admin-submissions", assignmentId] });
              qc.invalidateQueries({ queryKey: ["admin-assignments"] });
              refetch();
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function SubmissionRow({ sub, totalMarks, onReview }: { sub: any; totalMarks: number; onReview: (m: number, f: string) => Promise<void> }) {
  const [marks, setMarks] = useState<string>(sub.marks_obtained != null ? String(sub.marks_obtained) : "");
  const [feedback, setFeedback] = useState<string>(sub.teacher_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const name = sub.profile?.full_name || sub.profile?.display_name || "Student";
  const statusCls = sub.status === "reviewed" ? "text-[oklch(0.45_0.16_145)]" : sub.status === "late" ? "text-destructive" : sub.status === "submitted" ? "text-accent" : "text-muted-foreground";

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{name}</p>
            {sub.is_late && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[oklch(0.72_0.16_60)]/60 bg-[oklch(0.72_0.16_60)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[oklch(0.55_0.18_45)]">
                ⚠️ Late Submission
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{sub.profile?.college_name ?? ""}</p>
        </div>
        <div className="text-right text-xs">
          <div>
            <span className={`font-semibold ${statusCls}`}>{sub.status.toUpperCase()}</span>
            {sub.submitted_at && <span className="ml-2 text-muted-foreground">Submitted {new Date(sub.submitted_at).toLocaleString()}</span>}
          </div>
        </div>
      </div>
      {sub.answer_text && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Written answer</p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-secondary/40 p-2 text-xs">{sub.answer_text}</pre>
        </div>
      )}
      {sub.code_answer && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Code</p>
          <pre className="mt-1 max-h-60 overflow-auto rounded border border-border bg-[oklch(0.18_0.02_250)] p-2 font-mono text-xs text-[oklch(0.97_0.005_85)]">{sub.code_answer}</pre>
        </div>
      )}
      {sub.code_output && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Student output</p>
          <pre className="mt-1 max-h-32 overflow-auto rounded border border-border bg-secondary/40 p-2 text-xs">{sub.code_output}</pre>
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Marks / {totalMarks}</label>
          <input
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Feedback</label>
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            placeholder="Great work / needs improvement…"
          />
        </div>
        <button
          disabled={saving}
          onClick={async () => {
            const n = Number(marks);
            if (Number.isNaN(n)) return;
            setSaving(true);
            try { await onReview(n, feedback); } finally { setSaving(false); }
          }}
          className="rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {sub.status === "reviewed" ? "Update review" : "Mark reviewed"}
        </button>
      </div>
    </li>
  );
}

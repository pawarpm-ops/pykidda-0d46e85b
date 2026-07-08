import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getStudentAssignment,
  saveDraftSubmission,
  submitAssignment,
} from "@/lib/assignments.functions";
import { loadPyodideOnce, runPython } from "@/lib/pyodide-runner";

export const Route = createFileRoute("/_authenticated/assignments/$id")({
  head: () => ({
    meta: [
      { title: "Assignment · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssignmentDetailPage,
  ssr: false,
});

function AssignmentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getStudentAssignment);
  const draftFn = useServerFn(saveDraftSubmission);
  const submitFn = useServerFn(submitAssignment);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["student-assignment", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [code, setCode] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [output, setOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [pyReady, setPyReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const seededRef = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data || seededRef.current) return;
    seededRef.current = true;
    setCode(data.submission?.code_answer ?? data.assignment.starter_code ?? "");
    setAnswerText(data.submission?.answer_text ?? "");
    setOutput(data.submission?.code_output ?? "");
    setStdin(data.assignment.sample_input ?? "");
  }, [data]);

  useEffect(() => {
    loadPyodideOnce().then(() => setPyReady(true)).catch(() => setPyReady(false));
  }, []);

  const submission = data?.submission ?? null;
  const isReviewed = submission?.status === "reviewed";
  const overdue = data ? new Date(data.assignment.due_at) < new Date() : false;
  const canSubmit = data
    ? !isReviewed && (!overdue || data.assignment.allow_late_submission)
    : false;
  const readOnly = isReviewed;

  // autosave draft
  useEffect(() => {
    if (!data || readOnly || !seededRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await draftFn({
          data: {
            assignment_id: id,
            code_answer: code || null,
            answer_text: answerText || null,
            code_output: output || null,
          },
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        // ignore auto-save errors
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, answerText, output, data, readOnly, id]);

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setOutput("Running…");
    try {
      await loadPyodideOnce();
      const r = await runPython(code, stdin);
      setOutput([r.stdout, r.stderr ? `\n--- stderr ---\n${r.stderr}` : ""].join(""));
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleFinalSubmit() {
    setConfirmOpen(false);
    try {
      const res = await submitFn({
        data: {
          assignment_id: id,
          code_answer: code || null,
          answer_text: answerText || null,
          code_output: output || null,
        },
      });
      setToast(res.is_late ? "Submitted (late) 📤" : "Submitted successfully 🎉");
      await refetch();
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Submit failed");
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8"><p>Loading…</p></main>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-destructive">{(error as Error)?.message ?? "Not found"}</p>
          <Link to="/assignments" className="mt-4 inline-block text-accent">← Back</Link>
        </main>
      </div>
    );
  }

  const a = data.assignment;
  const showCode = a.assignment_type === "coding" || a.assignment_type === "mixed";
  const showWritten = a.assignment_type === "written" || a.assignment_type === "mixed";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link to="/assignments" className="text-sm text-muted-foreground hover:text-accent">
          ← Back to homework
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-accent">
            {a.assignment_type} · {a.difficulty}{a.unit != null ? ` · Unit ${a.unit}` : ""}
          </span>
          <span className="text-xs text-muted-foreground">· {a.total_marks} marks</span>
        </div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{a.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className={overdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
            ⏰ Due {new Date(a.due_at).toLocaleString()}
          </span>
          {a.allow_late_submission && <span className="text-muted-foreground">Late submissions allowed</span>}
          {submission && (
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-semibold">
              Status: {submission.status}
            </span>
          )}
        </div>

        {a.description && (
          <div className="mt-5 rounded-xl border border-border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {a.description}
          </div>
        )}

        {(a.sample_input || a.sample_output) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {a.sample_input && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sample input</p>
                <pre className="mt-1 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-xs">{a.sample_input}</pre>
              </div>
            )}
            {a.sample_output && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sample output</p>
                <pre className="mt-1 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-xs">{a.sample_output}</pre>
              </div>
            )}
          </div>
        )}

        {showWritten && (
          <div className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your written answer</label>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={readOnly}
              rows={6}
              className="mt-1 block w-full rounded-md border border-border bg-card p-3 text-sm outline-none focus:border-accent"
              placeholder="Type your answer here…"
            />
          </div>
        )}

        {showCode && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Python code</label>
              <span className="text-xs text-muted-foreground">{pyReady ? "Python: ready" : "Python: loading…"}</span>
            </div>
            <div className="mt-1 rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)] shadow-inner">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={readOnly}
                spellCheck={false}
                rows={14}
                className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none"
                style={{ tabSize: 4 }}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const s = el.selectionStart;
                    const next = code.slice(0, s) + "    " + code.slice(el.selectionEnd);
                    setCode(next);
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
                  }
                }}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Custom input (stdin)</p>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  disabled={readOnly}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-border bg-card p-2 font-mono text-xs outline-none focus:border-accent"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Output</p>
                <pre className="mt-1 h-full min-h-[6rem] overflow-auto rounded-md border border-border bg-secondary/40 p-2 text-xs">{output || "(no output yet)"}</pre>
              </div>
            </div>

            {!readOnly && (
              <div className="mt-3">
                <button
                  onClick={handleRun}
                  disabled={running}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {running ? "Running…" : "▶ Run code"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!readOnly && canSubmit && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Submit assignment
            </button>
          )}
          {!readOnly && !canSubmit && overdue && (
            <span className="text-sm text-destructive font-semibold">Deadline passed — late submissions not allowed.</span>
          )}
          <span className="text-xs text-muted-foreground">
            {saving ? "Saving draft…" : savedAt ? `Draft saved at ${savedAt}` : readOnly ? "Reviewed — read-only" : "Autosaves as you type"}
          </span>
        </div>

        {submission?.status === "reviewed" && (
          <div className="mt-8 rounded-xl border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/10 p-5">
            <p className="text-lg font-bold">Teacher review</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {submission.marks_obtained ?? 0} <span className="text-base font-medium text-muted-foreground">/ {a.total_marks}</span>
            </p>
            {submission.teacher_feedback && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{submission.teacher_feedback}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="text-lg font-bold">Submit assignment?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {overdue
                ? "You are submitting after the deadline. This will be marked as Late."
                : "You can still edit your draft until the deadline, but a final submit changes your status."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={handleFinalSubmit}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

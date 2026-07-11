// Homework AI dialogs: Generate with AI, Refine with AI.
// Used inside the admin Homework tab.
import { useEffect, useState } from "react";

import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { X, Sparkles, Loader2, Check, RefreshCcw, Pencil, Paperclip, FileText } from "lucide-react";
import { DueDateTimePicker } from "@/components/DueDateTimePicker";
import {
  generateHomeworkQuestions,
  refineHomeworkQuestion,
  applyHomeworkRefinement,
  saveAiGeneratedHomework,
  type AiQuestion,
} from "@/lib/assignments-ai.functions";

const inputCls =
  "block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4">
      <div className={`mt-8 w-full ${wide ? "max-w-5xl" : "max-w-2xl"} rounded-2xl border border-border bg-card shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-bold flex items-center gap-2"><Sparkles size={16} className="text-accent" /> {title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// -------------------- Generate with AI --------------------

export function GenerateAiDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const generateFn = useServerFn(generateHomeworkQuestions);
  const saveFn = useServerFn(saveAiGeneratedHomework);
  const qc = useQueryClient();

  const [step, setStep] = useState<"form" | "preview">("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AiQuestion[]>([]);

  // form state
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(3);
  const [marks, setMarks] = useState(10);
  const [type, setType] = useState<"coding" | "written" | "mixed">("coding");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [mode, setMode] = useState<"submit" | "self_solve">("submit");
  const [refFile, setRefFile] = useState<{ name: string; mime: string; data_base64: string; size: number } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);

  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
  const ACCEPTED = ".pdf,.txt,.md,.markdown,image/*";

  async function handleFilePick(f: File | null) {
    setFileErr(null);
    if (!f) { setRefFile(null); return; }
    if (f.size > MAX_BYTES) { setFileErr("File is larger than 8 MB. Please upload a smaller file."); return; }
    const okMime =
      f.type === "application/pdf" ||
      f.type.startsWith("text/") ||
      f.type.startsWith("image/") ||
      /\.(md|markdown|txt)$/i.test(f.name);
    if (!okMime) { setFileErr("Only PDF, text/markdown, or image files are supported."); return; }
    const buf = await f.arrayBuffer();
    // base64 encode without blowing the stack for large files
    let bin = "";
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const b64 = btoa(bin);
    const mime = f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : "text/plain");
    setRefFile({ name: f.name, mime, data_base64: b64, size: f.size });
  }

  async function handleGenerate() {
    if (!topic.trim()) { setErr("Topic is required."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await generateFn({
        data: {
          topic: topic.trim(), difficulty, count, marks_per_question: marks, question_type: type, instructions,
          reference_file: refFile ? { name: refFile.name, mime: refFile.mime, data_base64: refFile.data_base64 } : null,
        },
      });
      setDrafts(res.questions);
      setStep("preview");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI could not generate questions right now. Please try again.");
    } finally { setBusy(false); }
  }

  async function handleSave(publish: boolean) {
    if (drafts.length === 0) return;
    if (mode === "submit" && !dueAt) { setErr("Please set a due date, or switch to Self-solve."); return; }
    setBusy(true); setErr(null);
    try {
      const due_at = mode === "submit" ? new Date(dueAt).toISOString() : null;
      await saveFn({ data: { publish, due_at, submission_mode: mode, topic: topic.trim(), questions: drafts } });
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally { setBusy(false); }
  }

  function updateDraft(i: number, patch: Partial<AiQuestion>) {
    setDrafts((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeDraft(i: number) { setDrafts((prev) => prev.filter((_, idx) => idx !== i)); }

  return (
    <Modal onClose={onClose} title={step === "form" ? "Generate homework with AI" : "Preview & save"} wide={step === "preview"}>
      {step === "form" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Topic *</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls + " mt-1"} placeholder="e.g. List comprehensions, Recursion, File I/O" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")} className={inputCls + " mt-1"}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Question type</label>
            <select value={type} onChange={(e) => setType(e.target.value as "coding" | "written" | "mixed")} className={inputCls + " mt-1"}>
              <option value="coding">Coding</option><option value="written">Written</option><option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How many? (1-10)</label>
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className={inputCls + " mt-1"} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Marks per question</label>
            <input type="number" min={1} max={100} value={marks} onChange={(e) => setMarks(Math.max(1, Number(e.target.value) || 1))} className={inputCls + " mt-1"} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Instructions for AI (optional)</label>
            <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputCls + " mt-1"} placeholder="e.g. Focus on real-world examples; include I/O for each question" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reference file (optional)</label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Upload a syllabus, unit plan, question paper or image (PDF, TXT, MD or image, max 8 MB). AI will base questions on it.
            </p>
            {!refFile ? (
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm hover:border-accent">
                <Paperclip size={16} className="text-accent" />
                <span className="text-muted-foreground">Click to attach a file</span>
                <input
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => void handleFilePick(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{refFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(refFile.size / 1024).toFixed(refFile.size > 1024 * 1024 ? 0 : 1)}{" "}
                      {refFile.size > 1024 * 1024 ? `KB · ${(refFile.size / 1024 / 1024).toFixed(2)} MB` : "KB"} · {refFile.mime}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRefFile(null)}
                  className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  type="button"
                >
                  Remove
                </button>
              </div>
            )}
            {fileErr && <p className="mt-1 text-xs text-destructive">{fileErr}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as "submit" | "self_solve")} className={inputCls + " mt-1"}>
              <option value="submit">Submit for grading</option>
              <option value="self_solve">Self-solve (like Practice)</option>
            </select>
          </div>
          {mode === "submit" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Due date & time</label>
              <div className="mt-1"><DueDateTimePicker value={dueAt} onChange={setDueAt} /></div>
            </div>
          )}
          {err && <p className="md:col-span-2 text-sm text-destructive">{err}</p>}
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-border bg-background px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={handleGenerate}
              disabled={busy || !topic.trim()}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {busy ? "Generating…" : "Generate with AI"}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <p className="text-sm text-muted-foreground">
            AI drafted <b>{drafts.length}</b> question{drafts.length === 1 ? "" : "s"} on <b>{topic}</b>. Edit anything, remove what you don't want, then save.
          </p>
          <ul className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {drafts.map((q, i) => (
              <li key={i} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <input value={q.title} onChange={(e) => updateDraft(i, { title: e.target.value })} className={inputCls + " font-semibold"} />
                  <button onClick={() => removeDraft(i)} className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">Remove</button>
                </div>
                <textarea value={q.problem_statement} onChange={(e) => updateDraft(i, { problem_statement: e.target.value })} rows={3} className={inputCls + " mt-2 text-xs"} placeholder="Problem statement" />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <textarea value={q.sample_input} onChange={(e) => updateDraft(i, { sample_input: e.target.value })} rows={2} className={inputCls + " font-mono text-[11px]"} placeholder="Sample input" />
                  <textarea value={q.sample_output} onChange={(e) => updateDraft(i, { sample_output: e.target.value })} rows={2} className={inputCls + " font-mono text-[11px]"} placeholder="Sample output" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <select value={q.difficulty} onChange={(e) => updateDraft(i, { difficulty: e.target.value as "easy" | "medium" | "hard" })} className={inputCls + " w-auto text-xs py-1"}>
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </select>
                  <label className="text-muted-foreground">Marks
                    <input type="number" min={1} value={q.marks} onChange={(e) => updateDraft(i, { marks: Math.max(1, Number(e.target.value) || 1) })} className={inputCls + " ml-2 w-20 text-xs py-1 inline-block"} />
                  </label>
                </div>
              </li>
            ))}
          </ul>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => setStep("form")} className="rounded-md border border-border bg-background px-4 py-2 text-sm">← Back</button>
            <button onClick={() => handleSave(false)} disabled={busy || drafts.length === 0} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-50">
              Save as drafts
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={busy || drafts.length === 0}
              className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              {busy ? "Saving…" : "Publish now"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// -------------------- Refine with AI --------------------

type RefinePatch = {
  title: string; description: string;
  input_format: string; output_format: string;
  sample_input: string; sample_output: string;
  constraints: string; hints: string;
  instructions: string; starter_code: string;
};

export function RefineAiDialog({ assignmentId, onClose, onApplied }: { assignmentId: string; onClose: () => void; onApplied: () => void }) {
  const refineFn = useServerFn(refineHomeworkQuestion);
  const applyFn = useServerFn(applyHomeworkRefinement);
  const qc = useQueryClient();

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [before, setBefore] = useState<Record<string, unknown> | null>(null);
  const [after, setAfter] = useState<RefinePatch | null>(null);
  const [editing, setEditing] = useState(false);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const res = await refineFn({ data: { id: assignmentId } });
      setBefore(res.before);
      setAfter(res.after);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI could not refine this question right now. Please try again.");
    } finally { setBusy(false); }
  }

  // load on mount
  useEffect(() => { void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [assignmentId]);


  async function accept() {
    if (!after) return;
    setBusy(true); setErr(null);
    try {
      await applyFn({ data: { id: assignmentId, patch: after } });
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save refinement.");
    } finally { setBusy(false); }
  }

  const beforeVal = (k: string) => String((before as Record<string, unknown> | null)?.[k] ?? "");

  return (
    <Modal onClose={onClose} title="Refine question with AI" wide>
      {busy && !after && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Asking AI to improve this question…</div>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {after && (
        <>
          <div className="grid gap-3 md:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
            <ColBlock heading="Before (current)" tone="muted">
              <FieldPair label="Title" value={beforeVal("title")} />
              <FieldPair label="Description" value={beforeVal("description")} multiline />
              <FieldPair label="Sample input" value={beforeVal("sample_input")} mono />
              <FieldPair label="Sample output" value={beforeVal("sample_output")} mono />
              <FieldPair label="Constraints" value={beforeVal("constraints")} multiline />
              <FieldPair label="Hints" value={beforeVal("hints")} multiline />
            </ColBlock>
            <ColBlock heading="After (AI suggestion)" tone="accent">
              <EditableField label="Title" value={after.title} editing={editing} onChange={(v) => setAfter({ ...after, title: v })} />
              <EditableField label="Description" value={after.description} editing={editing} onChange={(v) => setAfter({ ...after, description: v })} multiline />
              <EditableField label="Sample input" value={after.sample_input} editing={editing} onChange={(v) => setAfter({ ...after, sample_input: v })} mono />
              <EditableField label="Sample output" value={after.sample_output} editing={editing} onChange={(v) => setAfter({ ...after, sample_output: v })} mono />
              <EditableField label="Constraints" value={after.constraints} editing={editing} onChange={(v) => setAfter({ ...after, constraints: v })} multiline />
              <EditableField label="Hints" value={after.hints} editing={editing} onChange={(v) => setAfter({ ...after, hints: v })} multiline />
            </ColBlock>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-border bg-background px-4 py-2 text-sm">Reject</button>
            <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm">
              <Pencil size={14} /> {editing ? "Done editing" : "Edit manually"}
            </button>
            <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm disabled:opacity-50">
              <RefreshCcw size={14} /> Regenerate
            </button>
            <button
              onClick={accept}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              <Check size={14} /> Accept AI refinement
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ColBlock({ heading, tone, children }: { heading: string; tone: "muted" | "accent"; children: React.ReactNode }) {
  const cls = tone === "accent" ? "border-accent/40 bg-accent/5" : "border-border bg-background";
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{heading}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function FieldPair({ label, value, multiline, mono }: { label: string; value: string; multiline?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-0.5 whitespace-pre-wrap text-xs ${mono ? "font-mono" : ""} ${multiline ? "" : "truncate"}`}>{value || <span className="italic opacity-60">empty</span>}</p>
    </div>
  );
}

function EditableField({ label, value, editing, onChange, multiline, mono }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; multiline?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {editing ? (
        multiline ? (
          <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + " mt-1 text-xs " + (mono ? "font-mono" : "")} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + " mt-1 text-xs " + (mono ? "font-mono" : "")} />
        )
      ) : (
        <p className={`mt-0.5 whitespace-pre-wrap text-xs ${mono ? "font-mono" : ""}`}>{value || <span className="italic opacity-60">empty</span>}</p>
      )}
    </div>
  );
}

// -------------------- Entry cards --------------------

export function HomeworkEntryCards({ onManual, onAi }: { onManual: () => void; onAi: () => void }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <button
        onClick={onManual}
        className="group text-left rounded-2xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-accent hover:scale-[1.02] hover:shadow-[var(--shadow-warm)]"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/15 p-3 text-accent"><Pencil size={22} /></div>
          <h3 className="text-lg font-bold">Create Questions Manually</h3>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Write each homework question yourself — title, description, sample I/O, constraints, marks, and due date.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-accent group-hover:underline">Open manual form →</p>
      </button>
      <button
        onClick={onAi}
        className="group text-left rounded-2xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-primary hover:scale-[1.02] hover:shadow-[var(--shadow-warm)]"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-3 text-primary"><Sparkles size={22} /></div>
          <h3 className="text-lg font-bold">Generate Questions with AI</h3>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Give AI a topic, difficulty, and count — it drafts a full question set you can edit, refine, and publish.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-primary group-hover:underline">Open AI generator →</p>
      </button>
    </div>
  );
}

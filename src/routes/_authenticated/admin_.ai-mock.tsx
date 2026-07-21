// AI Mock Test Creator — admin-only page.
// Upload syllabus PDF, extract text client-side via pdfjs, send to Lovable AI,
// review/edit generated questions, save as draft, publish.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { useIsAdmin } from "@/lib/role";
import {
  generateAiMockTest,
  saveAiMockTest,
  publishAiMockTest,
  deleteAiMockTest,
  getAdminAiTest,
  listAiMockTests,
  refineAiMockTest,
  updateAiMockSchedule,
} from "@/lib/ai-mock.functions";
import { DateTimeRangePicker } from "@/components/DateTimeRangePicker";



export const Route = createFileRoute("/_authenticated/admin_/ai-mock")({
  head: () => ({ meta: [{ title: "AI Mock Test Creator · PY Kidda" }, { name: "robots", content: "noindex" }] }),
  component: AiMockAdmin,
  ssr: false,
});

type QType = "mcq" | "tf" | "fill" | "short" | "code";
type EditableQ = {
  id?: string;
  type: QType;
  prompt: string;
  options: string[];
  correct_answer: string;
  starter_code: string;
  code_tests: { stdin: string; expected: string }[];
  marks: number;
  explanation: string;
};

type TestRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  duration_sec: number;
  total_marks: number;
  question_count: number;
  created_at?: string;
  published_at?: string | null;
  test_kind?: "normal" | "scheduled";
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  schedule_instructions?: string;
  results_visibility?: "immediate" | "after_end";
};


const TYPE_LABEL: Record<QType, string> = {
  mcq: "Multiple choice",
  tf: "True / False",
  fill: "Fill the blank",
  short: "Short answer",
  code: "Coding",
};

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use bundled worker via URL import (Vite handles it)
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = worker.default;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" ");
    parts.push(items);
  }
  return parts.join("\n\n");
}

function AiMockAdmin() {
  const isAdmin = useIsAdmin();
  if (isAdmin === false) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10 pb-28">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Admin · Beta</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">🧪 AI Mock Test Creator</h1>
            <p className="mt-1 text-muted-foreground max-w-2xl">
              Upload a syllabus PDF, let AI draft a full mock test, then review, edit and publish it for students.
            </p>
          </div>
          <Link to="/admin" className="text-sm text-primary hover:underline">← Back to admin</Link>
        </div>

        {isAdmin === null ? (
          <p className="mt-10 text-muted-foreground">Loading…</p>
        ) : (
          <Editor />
        )}
      </main>
    </div>
  );
}

function Editor() {
  const generateFn = useServerFn(generateAiMockTest);
  const saveFn = useServerFn(saveAiMockTest);
  const publishFn = useServerFn(publishAiMockTest);
  const deleteFn = useServerFn(deleteAiMockTest);
  const getFn = useServerFn(getAdminAiTest);
  const listFn = useServerFn(listAiMockTests);
  const refineFn = useServerFn(refineAiMockTest);
  const updateScheduleFn = useServerFn(updateAiMockSchedule);


  const [tests, setTests] = useState<TestRow[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const refreshTests = async () => {
    setLoadingTests(true);
    try {
      const rows = await listFn({ data: { adminScope: true } });
      setTests(rows as TestRow[]);
    } finally {
      setLoadingTests(false);
    }
  };
  useEffect(() => { void refreshTests(); }, []);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questions, setQuestions] = useState<EditableQ[]>([]);
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusFileName, setSyllabusFileName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [refineChat, setRefineChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [refineDraft, setRefineDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ mcq: 0, tf: 0, fill: 0, short: 0, code: 5 });
  const fileRef = useRef<HTMLInputElement | null>(null);


  const totalMarks = useMemo(() => questions.reduce((a, q) => a + (q.marks || 0), 0), [questions]);

  const resetForm = () => {
    setEditingId(undefined);
    setTitle("");
    setDescription("");
    setDurationMinutes(30);
    setQuestions([]);
    setSyllabusText("");
    setSyllabusFileName("");
    setCustomInstructions("");
    setRefineChat([]);
    setRefineDraft("");
    setError(null);
  };

  const onPdfUpload = async (f: File | null) => {
    if (!f) return;
    setError(null);
    setBusy("Extracting text from PDF…");
    try {
      const text = await extractPdfText(f);
      if (text.trim().length < 20) {
        setError("Couldn't extract readable text — is the PDF a scanned image?");
        setBusy(null);
        return;
      }
      setSyllabusText(text);
      setSyllabusFileName(f.name);
      if (!title) setTitle(f.name.replace(/\.pdf$/i, "").slice(0, 80));
    } catch (e) {
      setError((e as Error).message || "Failed to parse PDF");
    } finally {
      setBusy(null);
    }
  };

  const onGenerate = async () => {
    setError(null);
    if (!title.trim()) { setError("Give the test a title."); return; }
    if (syllabusText.trim().length < 20 && customInstructions.trim().length < 20) {
      setError("Upload a syllabus PDF — that alone is enough. (Or, if you skip the PDF, write custom instructions of ~20+ chars.)");
      return;
    }
    setBusy("🧠 GPT-5 is drafting your test — this can take 20-60 seconds…");
    try {
      const draft = await generateFn({
        data: {
          title: title.trim(),
          description: description.trim(),
          syllabusText,
          customInstructions: customInstructions.trim(),
          durationMinutes,
          counts,
        },
      });
      setQuestions(
        draft.questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? [],
          correct_answer: q.correct_answer ?? "",
          starter_code: q.starter_code ?? "",
          code_tests: q.code_tests ?? [],
          marks: q.marks ?? 1,
          explanation: q.explanation ?? "",
        })),
      );
      setRefineChat([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onRefine = async () => {
    setError(null);
    const instruction = refineDraft.trim();
    if (!instruction) return;
    if (questions.length === 0) { setError("Generate a test first, then refine it."); return; }
    setRefineChat((c) => [...c, { role: "user", text: instruction }]);
    setRefineDraft("");
    setBusy("🧠 GPT-5 is revising the test…");
    try {
      const res = await refineFn({
        data: {
          title: title.trim() || "Untitled",
          description: description.trim(),
          instruction,
          syllabusText,
          questions: questions.map((q, i) => ({
            id: q.id,
            order_index: i,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            correct_answer: q.correct_answer,
            starter_code: q.starter_code,
            code_tests: q.code_tests,
            marks: q.marks,
            explanation: q.explanation,
          })),
        },
      });
      setQuestions(
        res.questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? [],
          correct_answer: q.correct_answer ?? "",
          starter_code: q.starter_code ?? "",
          code_tests: q.code_tests ?? [],
          marks: q.marks ?? 1,
          explanation: q.explanation ?? "",
        })),
      );
      setRefineChat((c) => [...c, { role: "ai", text: `Updated test — now ${res.questions.length} questions. Review the changes below.` }]);
    } catch (e) {
      setError((e as Error).message);
      setRefineChat((c) => [...c, { role: "ai", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(null);
    }
  };



  const onSaveDraft = async () => {
    setError(null);
    if (questions.length === 0) { setError("Nothing to save. Generate or add questions first."); return; }
    setBusy("Saving draft…");
    try {
      const res = await saveFn({
        data: {
          id: editingId,
          title: title.trim(),
          description: description.trim(),
          syllabus_snippet: syllabusText.slice(0, 1500),
          duration_sec: durationMinutes * 60,
          questions: questions.map((q, i) => ({
            id: q.id,
            order_index: i,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            correct_answer: q.correct_answer,
            starter_code: q.starter_code,
            code_tests: q.code_tests,
            marks: q.marks,
            explanation: q.explanation,
          })),
        },
      });
      setEditingId(res.id);
      await refreshTests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Schedule modal state
  const [scheduleOpen, setScheduleOpen] = useState<null | { mode: "publish" | "edit"; testId: string }>(null);
  const [schedDate, setSchedDate] = useState<string>("");
  const [schedStart, setSchedStart] = useState<string>("");
  const [schedEnd, setSchedEnd] = useState<string>("");
  const [schedInstr, setSchedInstr] = useState<string>("");
  const [schedResults, setSchedResults] = useState<"immediate" | "after_end">("immediate");

  const openScheduleForPublish = () => {
    if (!editingId) { setError("Save the draft first."); return; }
    setSchedDate("");
    setSchedStart("");
    setSchedEnd("");
    setSchedInstr("");
    setSchedResults("immediate");
    setScheduleOpen({ mode: "publish", testId: editingId });
  };

  const openScheduleForEdit = (t: TestRow) => {
    const start = t.scheduled_start_at ? new Date(t.scheduled_start_at) : new Date();
    const end = t.scheduled_end_at ? new Date(t.scheduled_end_at) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setSchedDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
    setSchedStart(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setSchedEnd(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
    setSchedInstr(t.schedule_instructions || "");
    setSchedResults(t.results_visibility || "immediate");
    setScheduleOpen({ mode: "edit", testId: t.id });
  };

  const buildScheduleISO = (): { start: string; end: string } | null => {
    if (!schedDate || !schedStart || !schedEnd) return null;
    const start = new Date(`${schedDate}T${schedStart}`);
    const end = new Date(`${schedDate}T${schedEnd}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const submitSchedule = async () => {
    if (!scheduleOpen) return;
    const iso = buildScheduleISO();
    if (!iso) { setError("Pick a valid date, start time, and end time (end after start)."); return; }
    setBusy(scheduleOpen.mode === "publish" ? "Publishing scheduled test…" : "Updating schedule…");
    try {
      if (scheduleOpen.mode === "publish") {
        await publishFn({
          data: {
            id: scheduleOpen.testId,
            publish: true,
            test_kind: "scheduled",
            scheduled_start_at: iso.start,
            scheduled_end_at: iso.end,
            schedule_instructions: schedInstr,
            results_visibility: schedResults,
          },
        });
      } else {
        await updateScheduleFn({
          data: {
            id: scheduleOpen.testId,
            scheduled_start_at: iso.start,
            scheduled_end_at: iso.end,
            schedule_instructions: schedInstr,
            results_visibility: schedResults,
          },
        });
      }
      setScheduleOpen(null);
      await refreshTests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const publishNormal = async () => {
    if (!editingId) { setError("Save the draft first."); return; }
    setBusy("Publishing…");
    try {
      await publishFn({ data: { id: editingId, publish: true, test_kind: "normal" } });
      await refreshTests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async (id?: string) => {
    const tid = id ?? editingId;
    if (!tid) return;
    setBusy("Unpublishing…");
    try {
      await publishFn({ data: { id: tid, publish: false } });
      await refreshTests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };


  const onLoadTest = async (id: string) => {
    setBusy("Loading test…");
    try {
      const { test, questions: qs } = await getFn({ data: { id } });
      const t = test as { id: string; title: string; description: string; duration_sec: number; syllabus_snippet: string };
      setEditingId(t.id);
      setTitle(t.title);
      setDescription(t.description);
      setDurationMinutes(Math.max(5, Math.round(t.duration_sec / 60)));
      setSyllabusText(t.syllabus_snippet || "");
      setSyllabusFileName(t.syllabus_snippet ? "(saved snippet)" : "");
      setQuestions(
        (qs as EditableQ[]).map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? [],
          correct_answer: q.correct_answer ?? "",
          starter_code: q.starter_code ?? "",
          code_tests: q.code_tests ?? [],
          marks: q.marks ?? 1,
          explanation: q.explanation ?? "",
        })),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this test permanently? Attempts stay in history.")) return;
    setBusy("Deleting…");
    try {
      await deleteFn({ data: { id } });
      if (editingId === id) resetForm();
      await refreshTests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const updateQ = (i: number, patch: Partial<EditableQ>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const moveQ = (i: number, dir: -1 | 1) => {
    setQuestions((qs) => {
      const arr = [...qs];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };
  const removeQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const addBlankQ = (type: QType) => {
    setQuestions((qs) => [
      ...qs,
      {
        type,
        prompt: "",
        options: type === "mcq" ? ["", "", "", ""] : [],
        correct_answer: type === "tf" ? "True" : "",
        starter_code: type === "code" ? "# Write your code here\n" : "",
        code_tests: type === "code" ? [{ stdin: "", expected: "" }] : [],
        marks: type === "code" ? 5 : type === "short" ? 2 : 1,
        explanation: "",
      },
    ]);
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📄</span> 1. Syllabus PDF
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Text-based PDFs work best (not scanned images). Skip this if you'd rather just tell the AI what to build below.</p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => onPdfUpload(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-2 file:font-semibold"
            />
            {syllabusFileName && (
              <span className="text-xs text-muted-foreground">
                ✓ {syllabusFileName} · {syllabusText.length.toLocaleString()} chars extracted
              </span>
            )}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-dashed border-accent/50 bg-accent/5 p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>✨</span> 2. Custom instructions to the AI
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Optional — leave blank if the syllabus PDF is enough. Otherwise write in plain English exactly how you want this test built: topics, difficulty, style, focus areas, wording, examples, marks weighting. GPT-5 will follow it precisely.
          </p>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={5}
            className="input mt-3"
            placeholder={`Example:\nBuild a Python OOP mock test for 2nd year students. Focus on classes, inheritance, and dunder methods. Keep MCQs conceptual, coding questions must involve a real-world example (bank account, library, etc.). Make one coding question tricky. Explanations should be beginner-friendly.`}
          />
        </section>


        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2"><span>⚙️</span> 3. Test settings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Unit 3 OOP mock test" />
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" min={5} max={240} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)} className="input" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="What this test covers (shown to students)" />
            </Field>
          </div>
          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Coding questions to generate:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label={TYPE_LABEL.code}>
                <input type="number" min={1} max={30} value={counts.code} onChange={(e) => setCounts((c) => ({ ...c, code: Math.max(1, Number(e.target.value) || 1) }))} className="input" />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">AI Mock Test Creator only generates coding questions.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={onGenerate}
              disabled={!!busy}
              className="rounded-md px-4 py-2 font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              🧠 Generate with GPT-5
            </button>
            {editingId && <button onClick={resetForm} className="text-sm text-muted-foreground hover:underline">New test</button>}
          </div>
        </section>

        {busy && <div className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">⏳ {busy}</div>}
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">⚠️ {error}</div>}

        {questions.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><span>📝</span> 4. Review & edit ({questions.length} Qs · {totalMarks} marks)</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addBlankQ("code")} className="text-xs rounded border border-border px-2 py-1 hover:bg-secondary">+ {TYPE_LABEL.code}</button>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {questions.map((q, i) => (
                <QuestionEditor key={i} q={q} i={i} onChange={(p) => updateQ(i, p)} onMove={(d) => moveQ(i, d)} onRemove={() => removeQ(i)} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={onSaveDraft} disabled={!!busy} className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">💾 Save draft</button>
              {editingId && (
                <>
                  <button onClick={publishNormal} disabled={!!busy} className="rounded-md bg-[oklch(0.65_0.16_145)] px-4 py-2 font-semibold text-white disabled:opacity-50">🚀 Publish as Normal Mock Test</button>
                  <button onClick={openScheduleForPublish} disabled={!!busy} className="rounded-md bg-[oklch(0.55_0.18_260)] px-4 py-2 font-semibold text-white disabled:opacity-50">📅 Publish as Scheduled Mock Test</button>
                  <button onClick={() => unpublish()} disabled={!!busy} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Unpublish</button>
                  <button onClick={() => onDelete(editingId)} disabled={!!busy} className="rounded-md border border-destructive/50 text-destructive px-4 py-2 text-sm hover:bg-destructive/10">Delete test</button>
                </>
              )}

            </div>
          </section>
        )}

        {questions.length > 0 && (
          <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-6 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2"><span>💬</span> 5. Chat with the AI to refine this test</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ask GPT-5 to change anything — "make Q3 harder", "add 2 more coding questions on recursion", "rewrite all MCQs in simpler English", "fix the answer to Q5", etc. It rewrites the test based on your instruction.
            </p>
            {refineChat.length > 0 && (
              <div className="mt-4 space-y-2 max-h-72 overflow-auto rounded-md border border-border bg-background p-3">
                {refineChat.map((m, i) => (
                  <div key={i} className={`text-sm rounded-md px-3 py-2 ${m.role === "user" ? "bg-primary/10 text-foreground ml-8" : "bg-accent/10 text-foreground mr-8"}`}>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mr-2">{m.role === "user" ? "You" : "GPT-5"}</span>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <textarea
                value={refineDraft}
                onChange={(e) => setRefineDraft(e.target.value)}
                rows={2}
                className="input flex-1"
                placeholder="e.g. Make the coding questions easier and add one more True/False on loops."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void onRefine(); }
                }}
              />
              <button
                onClick={onRefine}
                disabled={!!busy || !refineDraft.trim()}
                className="rounded-md px-4 py-2 font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50 self-end"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Tip: press ⌘/Ctrl + Enter to send. Save the draft after refining to keep changes.</p>
          </section>
        )}
      </div>


      <aside className="lg:sticky lg:top-4 self-start rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold flex items-center gap-2"><span>📚</span> My tests</h3>
        {loadingTests ? (
          <p className="text-sm text-muted-foreground mt-3">Loading…</p>
        ) : tests.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">No tests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 max-h-[70vh] overflow-auto">
            {tests.map((t) => {
              const kind = t.test_kind ?? "normal";
              const now = Date.now();
              const start = t.scheduled_start_at ? new Date(t.scheduled_start_at).getTime() : 0;
              const end = t.scheduled_end_at ? new Date(t.scheduled_end_at).getTime() : 0;
              let schedStatus: "upcoming" | "live" | "closed" | null = null;
              if (kind === "scheduled" && start && end) {
                schedStatus = now < start ? "upcoming" : now > end ? "closed" : "live";
              }
              return (
              <li key={t.id} className={`rounded-md border p-3 text-sm ${editingId === t.id ? "border-accent bg-accent/10" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.question_count} Qs · {t.total_marks} marks · {Math.round(t.duration_sec / 60)}m
                    </p>
                    <p className="text-xs mt-1 flex flex-wrap gap-1 items-center">
                      <span className={`inline-block rounded px-2 py-0.5 ${t.status === "published" ? "bg-[oklch(0.65_0.16_145)]/20 text-[oklch(0.45_0.16_145)]" : "bg-secondary text-muted-foreground"}`}>
                        {t.status}
                      </span>
                      {kind === "scheduled" && (
                        <span className="inline-block rounded px-2 py-0.5 bg-[oklch(0.55_0.18_260)]/20 text-[oklch(0.45_0.18_260)]">📅 scheduled</span>
                      )}
                      {schedStatus === "upcoming" && <span className="text-muted-foreground">upcoming</span>}
                      {schedStatus === "live" && <span className="text-[oklch(0.55_0.18_145)] font-semibold">LIVE</span>}
                      {schedStatus === "closed" && <span className="text-muted-foreground">closed</span>}
                    </p>
                    {kind === "scheduled" && t.scheduled_start_at && t.scheduled_end_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(t.scheduled_start_at).toLocaleString()} → {new Date(t.scheduled_end_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button onClick={() => onLoadTest(t.id)} className="text-primary hover:underline">Edit</button>
                  {kind === "scheduled" && t.status === "published" && schedStatus !== "closed" && (
                    <button onClick={() => openScheduleForEdit(t)} className="text-primary hover:underline">Edit schedule</button>
                  )}
                  {t.status === "published" ? (
                    <button onClick={() => unpublish(t.id)} className="text-muted-foreground hover:underline">Unpublish</button>
                  ) : null}
                  <button onClick={() => onDelete(t.id)} className="text-destructive hover:underline">Delete</button>
                </div>
              </li>
              );
            })}

          </ul>
        )}
      </aside>

      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setScheduleOpen(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span>📅</span> {scheduleOpen.mode === "publish" ? "Schedule this mock test" : "Edit schedule"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Students will be able to attend only during this window. Duration: {durationMinutes} min.
            </p>
            <div className="mt-4">
              <DateTimeRangePicker
                date={schedDate}
                startTime={schedStart}
                endTime={schedEnd}
                onDateChange={setSchedDate}
                onStartTimeChange={setSchedStart}
                onEndTimeChange={setSchedEnd}
                durationMinutes={durationMinutes}
              />
            </div>
            <div className="mt-3">
              <Field label="Instructions for students">
                <textarea value={schedInstr} onChange={(e) => setSchedInstr(e.target.value)} rows={3} className="input" placeholder="e.g. Attend in a quiet room. Fullscreen required. No tabs." />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Results visibility">
                <select value={schedResults} onChange={(e) => setSchedResults(e.target.value as "immediate" | "after_end")} className="input">
                  <option value="immediate">Show immediately after submit</option>
                  <option value="after_end">Show only after test window ends</option>
                </select>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setScheduleOpen(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
              <button onClick={submitSchedule} disabled={!!busy} className="rounded-md bg-[oklch(0.55_0.18_260)] px-4 py-2 font-semibold text-white disabled:opacity-50">
                {scheduleOpen.mode === "publish" ? "Publish scheduled" : "Save schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input{width:100%;border:1px solid oklch(from var(--color-border) l c h);background:var(--color-background);border-radius:6px;padding:8px 10px;font-size:14px;font-family:inherit}.input:focus{outline:2px solid var(--color-accent)}`}</style>

    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function QuestionEditor({
  q,
  i,
  onChange,
  onMove,
  onRemove,
}: {
  q: EditableQ;
  i: number;
  onChange: (p: Partial<EditableQ>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold rounded bg-accent/20 text-accent px-2 py-0.5">Q{i + 1}</span>
          <select value={q.type} onChange={(e) => onChange({ type: e.target.value as QType })} className="text-xs rounded border border-border bg-card px-2 py-1" disabled>
            <option value="code">{TYPE_LABEL.code}</option>
          </select>
          <label className="text-xs text-muted-foreground">Marks
            <input type="number" min={1} value={q.marks} onChange={(e) => onChange({ marks: Number(e.target.value) || 1 })} className="ml-1 w-14 rounded border border-border bg-card px-1 py-0.5 text-xs" />
          </label>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => onMove(-1)} className="rounded border border-border px-2 py-1 hover:bg-secondary">↑</button>
          <button onClick={() => onMove(1)} className="rounded border border-border px-2 py-1 hover:bg-secondary">↓</button>
          <button onClick={onRemove} className="rounded border border-destructive/50 text-destructive px-2 py-1 hover:bg-destructive/10">Remove</button>
        </div>
      </div>
      <textarea
        value={q.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        rows={2}
        className="input mt-3"
        placeholder="Question prompt"
      />
      {q.type === "mcq" && (
        <div className="mt-3 space-y-2">
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${i}`}
                checked={q.correct_answer === opt && opt !== ""}
                onChange={() => onChange({ correct_answer: opt })}
              />
              <input
                value={opt}
                onChange={(e) => {
                  const opts = [...q.options];
                  const old = opts[oi];
                  opts[oi] = e.target.value;
                  const patch: Partial<EditableQ> = { options: opts };
                  if (q.correct_answer === old) patch.correct_answer = e.target.value;
                  onChange(patch);
                }}
                className="input"
                placeholder={`Option ${oi + 1}`}
              />
              {q.options.length > 2 && (
                <button onClick={() => onChange({ options: q.options.filter((_, k) => k !== oi) })} className="text-xs text-destructive">×</button>
              )}
            </div>
          ))}
          <button onClick={() => onChange({ options: [...q.options, ""] })} className="text-xs text-primary">+ Add option</button>
        </div>
      )}
      {q.type === "tf" && (
        <div className="mt-3 flex gap-4 text-sm">
          {(["True", "False"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name={`tf-${i}`} checked={q.correct_answer === v} onChange={() => onChange({ correct_answer: v })} />
              {v}
            </label>
          ))}
        </div>
      )}
      {(q.type === "fill" || q.type === "short") && (
        <Field label={q.type === "fill" ? "Correct answer" : "Model answer / keywords"} className="mt-3">
          <textarea value={q.correct_answer} onChange={(e) => onChange({ correct_answer: e.target.value })} rows={q.type === "short" ? 3 : 1} className="input" />
        </Field>
      )}
      {q.type === "code" && (
        <div className="mt-3 space-y-3">
          <Field label="Starter code">
            <textarea value={q.starter_code} onChange={(e) => onChange({ starter_code: e.target.value })} rows={4} className="input font-mono text-xs" />
          </Field>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hidden test cases</p>
            {q.code_tests.map((tc, ti) => (
              <div key={ti} className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea value={tc.stdin} onChange={(e) => { const t = [...q.code_tests]; t[ti] = { ...t[ti], stdin: e.target.value }; onChange({ code_tests: t }); }} rows={2} className="input font-mono text-xs" placeholder="stdin (optional)" />
                <div className="flex gap-2">
                  <textarea value={tc.expected} onChange={(e) => { const t = [...q.code_tests]; t[ti] = { ...t[ti], expected: e.target.value }; onChange({ code_tests: t }); }} rows={2} className="input font-mono text-xs flex-1" placeholder="expected stdout" />
                  <button onClick={() => onChange({ code_tests: q.code_tests.filter((_, k) => k !== ti) })} className="text-xs text-destructive px-1">×</button>
                </div>
              </div>
            ))}
            <button onClick={() => onChange({ code_tests: [...q.code_tests, { stdin: "", expected: "" }] })} className="mt-2 text-xs text-primary">+ Add test case</button>
          </div>
        </div>
      )}
      <Field label="Explanation (shown after submission)" className="mt-3">
        <textarea value={q.explanation} onChange={(e) => onChange({ explanation: e.target.value })} rows={1} className="input text-xs" />
      </Field>
    </div>
  );
}

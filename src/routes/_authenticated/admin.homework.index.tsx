import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  adminListHomework,
  adminDeleteHomework,
  adminGenerateHomeworkWithAi,
} from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/admin/homework/")({
  head: () => ({
    meta: [
      { title: "Admin · Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomeworkList,
  ssr: false,
});

type Tab = "all" | "draft" | "published" | "closed";

function AdminHomeworkList() {
  const navigate = useNavigate();
  const listFn = useServerFn(adminListHomework);
  const deleteFn = useServerFn(adminDeleteHomework);

  const [tab, setTab] = useState<Tab>("all");
  const [showAi, setShowAi] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-homework"],
    queryFn: () => listFn(),
  });

  type HRow = Awaited<ReturnType<typeof adminListHomework>>[number];
  const filtered = ((data ?? []) as HRow[]).filter((h: HRow) => tab === "all" || h.status === tab);

  async function handleDelete(id: string) {
    if (!confirm("Delete this homework? This cannot be undone.")) return;
    try {
      await deleteFn({ data: { id } });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/submission\(s\)/i.test(msg) || /force=true/i.test(msg)) {
        if (!confirm(`${msg}\n\nDelete anyway, including all submissions?`)) return;
        await deleteFn({ data: { id, force: true } });
      } else {
        alert(msg);
        return;
      }
    }
    await refetch();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Homework 📚</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create multi-question homework, publish it, and grade student submissions.
            </p>
          </div>
          <Link
            to="/admin"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-accent/60"
          >
            ← Back to admin
          </Link>
        </div>

        {/* Two entry cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            to="/admin/homework/new"
            className="group text-left rounded-2xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-accent hover:scale-[1.02] hover:shadow-[var(--shadow-warm)]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/15 p-3 text-accent"><Pencil size={22} /></div>
              <h3 className="text-lg font-bold">Create Homework Manually</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Open the manual editor — set the title, description, due date, and add questions one by one.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-accent group-hover:underline">
              Open editor →
            </p>
          </Link>
          <button
            onClick={() => setShowAi(true)}
            className="group text-left rounded-2xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-primary hover:scale-[1.02] hover:shadow-[var(--shadow-warm)]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-3 text-primary"><Sparkles size={22} /></div>
              <h3 className="text-lg font-bold">Create Homework with AI</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Give AI a topic, difficulty, and question count — it drafts a full homework you can review, edit, and publish.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-primary group-hover:underline">Open AI generator →</p>
          </button>
        </div>

        {showAi && (
          <AiHomeworkDialog
            onClose={() => setShowAi(false)}
            onCreated={(id) => {
              setShowAi(false);
              navigate({ to: "/admin/homework/$id", params: { id } });
            }}
          />
        )}

        {/* Tabs + list */}
        <div className="mt-8 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["all", "draft", "published", "closed"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${
                tab === t
                  ? "font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
              style={tab === t ? { backgroundImage: "var(--gradient-sunrise)" } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">No {tab} homework yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "draft" ? "Use one of the options above to get started." : "Nothing in this bucket."}
            </p>
          </div>
        )}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((h: HRow) => (
            <li key={h.id}>
              <div className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold leading-tight line-clamp-2">{h.title}</h2>
                  <span className="shrink-0 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold capitalize">
                    {h.status}
                  </span>
                </div>
                {h.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{h.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                    {h.counts.questions} q · {Number(h.total_marks)} marks
                  </span>
                  <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                    {h.counts.submissions} submissions
                  </span>
                  <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                    {h.counts.checked} checked
                  </span>
                  {h.due_at && (
                    <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                      Due {new Date(h.due_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link
                    to="/admin/homework/$id"
                    params={{ id: h.id }}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-accent/60"
                  >
                    Edit & Grade
                  </Link>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-destructive hover:border-destructive/60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function AiHomeworkDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const generateFn = useServerFn(adminGenerateHomeworkWithAi);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(3);
  const [marks, setMarks] = useState(10);
  const [instructions, setInstructions] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refFile, setRefFile] = useState<{
    name: string;
    mime: string;
    size: number;
    data_url: string;
  } | null>(null);

  const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB raw
  const ACCEPTED = ".pdf,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp";

  async function onPickFile(f: File | null) {
    setErr(null);
    if (!f) { setRefFile(null); return; }
    if (f.size > MAX_FILE_BYTES) {
      setErr("File is too large. Please pick a file under 6 MB.");
      return;
    }
    const data_url: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error ?? new Error("Could not read file."));
      r.readAsDataURL(f);
    });
    setRefFile({
      name: f.name,
      mime: f.type || "application/octet-stream",
      size: f.size,
      data_url,
    });
  }

  async function handleGenerate() {
    if (!title.trim() || !topic.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await generateFn({
        data: {
          title: title.trim(),
          topic: topic.trim(),
          difficulty,
          count,
          marks_per_question: marks,
          instructions: instructions.trim(),
          publish,
          reference_file: refFile
            ? { name: refFile.name, mime: refFile.mime, data_url: refFile.data_url }
            : null,
        },
      });
      onCreated(res.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate homework.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h3 className="text-base font-bold">Generate homework with AI</h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:col-span-2">
          Homework title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Loops & Functions Practice"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:col-span-2">
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Recursion basics — factorial, Fibonacci, sum of digits"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Number of questions
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Marks per question
          <input
            type="number"
            min={1}
            max={100}
            value={marks}
            onChange={(e) => setMarks(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Publish immediately
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:col-span-2">
          Extra instructions (optional)
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Style, syllabus context, constraints…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
        </label>

        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:col-span-2">
          Reference file (optional)
          <div className="mt-1 rounded-md border border-dashed border-border bg-background p-3">
            {refFile ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-normal normal-case tracking-normal text-foreground">
                  <p className="font-semibold">{refFile.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {refFile.mime || "unknown"} · {(refFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRefFile(null)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col gap-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                <input
                  type="file"
                  accept={ACCEPTED}
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
                />
                <span>
                  PDF, image, or text (up to 6 MB). The AI will use its content to write the questions.
                </span>
              </label>
            )}
          </div>
        </div>
      </div>


      {err && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={busy || !title.trim() || !topic.trim()}
          className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {busy ? "Generating…" : "Generate homework"}
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

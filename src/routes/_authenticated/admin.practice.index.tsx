import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  adminListPracticeQuestions,
  adminDeletePracticeQuestion,
  adminSetPracticeQuestionStatus,
  adminGeneratePracticeWithAi,
} from "@/lib/practice-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/practice/")({
  head: () => ({
    meta: [
      { title: "Admin · Practice · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPracticePage,
  ssr: false,
});

type Tab = "all" | "draft" | "published";
type Row = Awaited<ReturnType<typeof adminListPracticeQuestions>>[number];

function AdminPracticePage() {
  const navigate = useNavigate();
  const listFn = useServerFn(adminListPracticeQuestions);
  const deleteFn = useServerFn(adminDeletePracticeQuestion);
  const setStatusFn = useServerFn(adminSetPracticeQuestionStatus);

  const [tab, setTab] = useState<Tab>("all");
  const [showAi, setShowAi] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-practice"],
    queryFn: () => listFn(),
  });

  const filtered = ((data ?? []) as Row[]).filter(
    (r) => tab === "all" || r.status === tab,
  );

  const groupMap = new Map<number, Row[]>();
  for (const r of filtered) {
    const arr = groupMap.get(r.unit) ?? [];
    arr.push(r);
    groupMap.set(r.unit, arr);
  }
  const grouped = Array.from(groupMap.entries()).sort((a, b) => a[0] - b[0]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this practice question? This cannot be undone.")) return;
    await deleteFn({ data: { id } });
    await refetch();
  }

  async function toggleStatus(row: Row) {
    const next = row.status === "published" ? "draft" : "published";
    await setStatusFn({ data: { id: row.id, status: next } });
    await refetch();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-8 pb-28">
        <PageHeader
          eyebrow="Admin"
          title="Practice 🧠"
          description="AI-generated practice questions. Publish to make them appear in the student Practice tab."
          breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Practice" }]}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/homework">← Homework / Practice</Link>
            </Button>
          }
        />

        <div>

          <button
            onClick={() => setShowAi(true)}
            className="group w-full text-left rounded-2xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-primary hover:scale-[1.01] hover:shadow-[var(--shadow-warm)]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-3 text-primary"><Sparkles size={22} /></div>
              <h3 className="text-lg font-bold">Create Practice Question with AI</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Choose a unit and difficulty, optionally attach a reference file, and AI drafts full practice questions with test cases you can publish.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-primary group-hover:underline">Open AI generator →</p>
          </button>
        </div>

        {showAi && (
          <AiPracticeDialog
            onClose={() => setShowAi(false)}
            onCreated={async () => {
              setShowAi(false);
              await refetch();
            }}
          />
        )}

        <div className="mt-8 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["all", "draft", "published"] as Tab[]).map((t) => (
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
            <p className="text-lg font-semibold">No {tab} practice questions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the AI generator above to create your first ones.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-8">
          {grouped.map(([unit, rows]) => (
            <section key={unit}>
              <h2 className="flex items-center gap-3">
                <span
                  className="inline-flex items-center rounded-lg px-3 py-1.5 text-base font-bold text-primary-foreground shadow-[var(--shadow-warm)]"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Unit {unit}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {rows.length} question{rows.length === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {rows.map((r) => (
                  <li key={r.id}>
                    <div className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold leading-tight line-clamp-2">{r.title}</h3>
                        <span className="shrink-0 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold capitalize">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{r.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                          {r.marks} marks
                        </span>
                        {r.difficulty && (
                          <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 capitalize">
                            {r.difficulty}
                          </span>
                        )}
                        <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                          {r.test_count} test{r.test_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleStatus(r)}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-accent/60"
                        >
                          {r.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() =>
                            navigate({ to: "/practice/$qid", params: { qid: `db-${r.id}` } })
                          }
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-accent/60"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-destructive hover:border-destructive/60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function AiPracticeDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const generateFn = useServerFn(adminGeneratePracticeWithAi);
  const [unit, setUnit] = useState(1);
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [instructions, setInstructions] = useState("");
  const [marks, setMarks] = useState(4);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refFile, setRefFile] = useState<{
    name: string;
    mime: string;
    size: number;
    data_url: string;
  } | null>(null);

  const MAX_FILE_BYTES = 6 * 1024 * 1024;
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
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await generateFn({
        data: {
          unit,
          count,
          difficulty,
          instructions: instructions.trim(),
          marks,
          publish,
          reference_file: refFile
            ? { name: refFile.name, mime: refFile.mime, data_url: refFile.data_url }
            : null,
        },
      });
      alert(`Created ${res.inserted} practice question${res.inserted === 1 ? "" : "s"}${res.publish ? " (published)" : " (draft)"}.`);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate practice questions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h3 className="text-base font-bold">Generate practice questions with AI</h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Unit
          <input
            type="number"
            min={1}
            max={20}
            value={unit}
            onChange={(e) => setUnit(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
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
                <span>PDF, image, or text (up to 6 MB). AI uses its content to write the questions.</span>
              </label>
            )}
          </div>
        </div>

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
          Marks per question
          <input
            type="number"
            min={1}
            max={50}
            value={marks}
            onChange={(e) => setMarks(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
          />
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

        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Publish immediately (appears in student Practice tab)
        </label>
      </div>

      {err && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          {busy ? "Generating…" : "Generate practice questions"}
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

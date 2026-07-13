import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  adminListHomework,
  adminCreateHomework,
  adminDeleteHomework,
} from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/admin/homework")({
  head: () => ({
    meta: [
      { title: "Admin · Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomeworkList,
  ssr: false,
});

type Tab = "draft" | "published" | "closed";

function AdminHomeworkList() {
  const navigate = useNavigate();
  const listFn = useServerFn(adminListHomework);
  const createFn = useServerFn(adminCreateHomework);
  const deleteFn = useServerFn(adminDeleteHomework);

  const [tab, setTab] = useState<Tab>("published");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-homework"],
    queryFn: () => listFn(),
  });

  const filtered = (data ?? []).filter((h) => h.status === tab);

  async function handleCreate() {
    if (!newTitle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          title: newTitle.trim(),
          description: "",
          status: "draft",
          allow_late_submission: true,
        },
      });
      setNewTitle("");
      setCreating(false);
      navigate({ to: "/admin/homework/$id", params: { id: res.id } });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this homework? This cannot be undone.")) return;
    await deleteFn({ data: { id } });
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
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-accent/60"
            >
              ← Back to admin
            </Link>
            <button
              onClick={() => setCreating((v) => !v)}
              className="rounded-md px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              + New Homework
            </button>
          </div>
        </div>

        {creating && (
          <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Homework title
            </label>
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Unit 3 — Functions & Recursion"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <button
                onClick={handleCreate}
                disabled={busy || !newTitle.trim()}
                className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewTitle("");
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["draft", "published", "closed"] as Tab[]).map((t) => (
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
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">No {tab} homework yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "draft" ? "Create a new homework to get started." : "Nothing in this bucket."}
            </p>
          </div>
        )}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((h) => (
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

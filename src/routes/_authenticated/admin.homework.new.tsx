import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { adminCreateHomework } from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/admin/homework/new")({
  head: () => ({
    meta: [
      { title: "Admin · New Homework · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewHomeworkPage,
  ssr: false,
});

function NewHomeworkPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(adminCreateHomework);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLate, setAllowLate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim() || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          title: title.trim(),
          description: description.trim(),
          status: "draft",
          allow_late_submission: allowLate,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
        },
      });
      navigate({ to: "/admin/homework/$id", params: { id: res.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create homework.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Admin · New homework</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight flex items-center gap-2">
              <Pencil size={22} className="text-accent" /> Create Homework Manually
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in the basics — you'll add questions on the next step.
            </p>
          </div>
          <Link
            to="/admin/homework"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-accent/60"
          >
            ← Back
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Title
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3 — Functions & Recursion"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Short summary students will see."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Due date (optional)
              </span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={allowLate}
                onChange={(e) => setAllowLate(e.target.checked)}
              />
              Allow late submissions
            </label>
          </div>

          {err && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {err}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={busy || !title.trim()}
              className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              {busy ? "Creating…" : "Create & add questions →"}
            </button>
            <Link
              to="/admin/homework"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

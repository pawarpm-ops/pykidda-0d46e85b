import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  listAnnouncements,
  listDismissedIds,
  listReadIds,
  markAllRead,
  markRead,
  dismissAnnouncement,
  dismissAllAnnouncements,
  type Announcement,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
  ssr: false,
});

function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    setLoading(true);
    const [a, r] = await Promise.all([listAnnouncements(), listReadIds(uid)]);
    setItems(a);
    setReadIds(r);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) void load(uid);
    });
  }, []);

  async function handleMarkAllRead() {
    if (!userId) return;
    const unreadIds = items.filter((i) => !readIds.has(i.id)).map((i) => i.id);
    await markAllRead(userId, unreadIds);
    setReadIds(new Set([...readIds, ...unreadIds]));
  }

  async function handleMarkOne(id: string) {
    if (!userId || readIds.has(id)) return;
    await markRead(userId, id);
    setReadIds(new Set([...readIds, id]));
  }

  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Inbox</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent transition"
            >
              Mark all as read
            </button>
          )}
        </div>

        <section className="mt-8 space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-lg font-semibold">No announcements yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When your teacher posts an announcement, it'll appear here.
              </p>
              <Link
                to="/practice"
                className="mt-4 inline-block rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold"
              >
                Back to practice
              </Link>
            </div>
          ) : (
            items.map((n) => {
              const unread = !readIds.has(n.id);
              return (
                <article
                  key={n.id}
                  onClick={() => handleMarkOne(n.id)}
                  className={`rounded-xl border bg-card p-5 cursor-pointer transition ${
                    unread ? "border-accent/40 bg-accent/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold leading-tight">{n.title}</h2>
                        {n.priority === "high" && (
                          <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                            High
                          </span>
                        )}
                        {n.target_user_id && (
                          <span className="rounded bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                            Direct
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">{n.body}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {unread && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent shrink-0" />}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

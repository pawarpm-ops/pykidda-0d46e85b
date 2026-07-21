import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    setLoading(true);
    const [a, r, d] = await Promise.all([listAnnouncements(), listReadIds(uid), listDismissedIds(uid)]);
    setItems(a);
    setReadIds(r);
    setDismissedIds(d);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) void load(uid);
    });
  }, []);

  const visibleItems = items.filter((i) => !dismissedIds.has(i.id));

  async function handleMarkAllRead() {
    if (!userId) return;
    const unreadIds = visibleItems.filter((i) => !readIds.has(i.id)).map((i) => i.id);
    await markAllRead(userId, unreadIds);
    setReadIds(new Set([...readIds, ...unreadIds]));
  }

  async function handleMarkOne(id: string) {
    if (!userId || readIds.has(id)) return;
    await markRead(userId, id);
    setReadIds(new Set([...readIds, id]));
  }

  async function handleDeleteOne(id: string) {
    if (!userId) return;
    setDismissedIds((prev) => new Set([...prev, id]));
    try {
      await dismissAnnouncement(userId, id);
    } catch {
      // rollback on failure
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeleteAll() {
    if (!userId || visibleItems.length === 0) return;
    if (!window.confirm("Delete all notifications? This will clear them from your inbox only.")) return;
    const ids = visibleItems.map((i) => i.id);
    const prev = dismissedIds;
    setDismissedIds(new Set([...prev, ...ids]));
    try {
      await dismissAllAnnouncements(userId, ids);
    } catch {
      setDismissedIds(prev);
    }
  }

  const unreadCount = visibleItems.filter((i) => !readIds.has(i.id)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
        <PageHeader
          eyebrow="Inbox"
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          icon={<Bell className="h-5 w-5" aria-hidden="true" />}
          actions={
            <>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="gap-1.5"
                  aria-label={`Mark all ${unreadCount} notifications as read`}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  Mark all as read
                </Button>
              )}
              {visibleItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAll}
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete all notifications"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete all
                </Button>
              )}
            </>
          }
        />

        <section className="mt-6 space-y-3" aria-label="Notifications list">
          {loading ? (
            <LoadingState label="Loading notifications…" className="min-h-[200px]" />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" aria-hidden="true" />}
              title="No announcements yet"
              description="When your teacher posts an announcement, it'll appear here."
              action={
                <Link
                  to="/practice"
                  className="inline-flex min-h-11 items-center rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold outline-none transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Back to practice
                </Link>
              }
            />
          ) : (
            visibleItems.map((n) => {
              const unread = !readIds.has(n.id);
              return (
                <article
                  key={n.id}
                  onClick={() => handleMarkOne(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleMarkOne(n.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${unread ? "Unread. " : ""}${n.title}. Activate to mark as read.`}
                  className={`rounded-xl border bg-card p-5 cursor-pointer transition outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    unread ? "border-accent/40 bg-accent/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className={`leading-tight break-words ${unread ? "font-bold" : "font-semibold text-foreground/90"}`}>
                          {unread && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </h2>
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
                      <p className="mt-2 text-sm whitespace-pre-wrap break-words text-foreground/90">{n.body}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {unread && (
                        <span
                          aria-hidden="true"
                          className="mt-1 h-2.5 w-2.5 rounded-full bg-accent"
                        />
                      )}
                      {n.action_url && (
                        <Link
                          to={n.action_url}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-h-9 items-center rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs font-semibold outline-none transition-colors hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                          aria-label={`View: ${n.title}`}
                        >
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteOne(n.id);
                        }}
                        aria-label={`Delete notification: ${n.title}`}
                        title="Delete this notification"
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Delete</span>
                      </button>
                    </div>
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

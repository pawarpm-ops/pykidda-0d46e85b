import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAnnouncements, listDismissedIds, listReadIds, markAllRead, type Announcement } from "@/lib/notifications";

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  async function refresh(uid: string) {
    const [a, r, d] = await Promise.all([listAnnouncements(), listReadIds(uid), listDismissedIds(uid)]);
    setItems(a);
    setReadIds(r);
    setDismissedIds(d);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) void refresh(uid);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("announcements-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        () => refresh(userId),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId]);

  if (!userId) return null;
  const unread = items.filter((i) => !readIds.has(i.id));

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    // When opening, mark every currently-unseen announcement as read
    // so the badge clears and stays cleared after refresh.
    if (next && userId && unread.length > 0) {
      const unreadIds = unread.map((i) => i.id);
      // Optimistic update so badge disappears immediately
      setReadIds((prev) => {
        const nextSet = new Set(prev);
        for (const id of unreadIds) nextSet.add(id);
        return nextSet;
      });
      try {
        await markAllRead(userId, unreadIds);
      } catch {
        // ignore — next refresh will reconcile
      }
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative rounded-md border border-border bg-background px-2.5 py-1.5 hover:border-accent transition"
        aria-label="Notifications"
      >
        <span className="text-base">🔔</span>
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto rounded-xl border border-border bg-card shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-accent underline"
            >
              View all
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.slice(0, 8).map((n) => {
                const isUnread = !readIds.has(n.id);
                return (
                  <li key={n.id} className={`px-4 py-3 text-sm ${isUnread ? "bg-accent/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight">{n.title}</p>
                      {isUnread && <span className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />}
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs line-clamp-3">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                      {n.target_user_id ? " · direct" : " · broadcast"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

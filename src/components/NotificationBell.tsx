import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/auth-cache";
import { listAnnouncements, listDismissedIds, listReadIds, markAllRead, type Announcement } from "@/lib/notifications";

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  async function refresh(uid: string) {
    const [a, r, d] = await Promise.all([listAnnouncements(), listReadIds(uid), listDismissedIds(uid)]);
    setItems(a);
    setReadIds(r);
    setDismissedIds(d);
  }

  useEffect(() => {
    getCachedUser().then(({ data }) => {
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

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!userId) return null;
  const visibleItems = items.filter((i) => !dismissedIds.has(i.id));
  const unread = visibleItems.filter((i) => !readIds.has(i.id));

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && userId && unread.length > 0) {
      const unreadIds = unread.map((i) => i.id);
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

  const bellLabel =
    unread.length > 0
      ? `Notifications, ${unread.length} unread`
      : "Notifications, no unread";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:border-accent hover:bg-accent/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={bellLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-auto rounded-xl border border-border bg-card shadow-lg z-50"
        >
          <div className="sticky top-0 z-10 bg-card px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/85 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              View all
            </Link>
          </div>
          {visibleItems.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleItems.slice(0, 8).map((n) => {
                const isUnread = !readIds.has(n.id);
                return (
                  <li key={n.id} className={`px-4 py-3 text-sm ${isUnread ? "bg-accent/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`leading-tight ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
                        {isUnread && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </p>
                      {isUnread && (
                        <span
                          aria-hidden="true"
                          className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs line-clamp-3 break-words">{n.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                        {n.target_user_id ? " · direct" : " · broadcast"}
                      </p>
                      {n.action_url && (
                        <Link
                          to={n.action_url}
                          onClick={() => setOpen(false)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/85 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        >
                          View
                        </Link>
                      )}
                    </div>
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

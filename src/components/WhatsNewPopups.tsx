import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Megaphone, BookOpen, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ItemType = "announcement" | "homework" | "mock_test";

type PopupItem = {
  type: ItemType;
  id: string;
  title: string;
  body: string;
  meta?: string;
  viewUrl?: string;
};

const TITLES: Record<ItemType, string> = {
  announcement: "What's New Announcement",
  homework: "What's New Homework",
  mock_test: "What's New Mock Test",
};

const ICONS: Record<ItemType, React.ComponentType<{ className?: string }>> = {
  announcement: Megaphone,
  homework: BookOpen,
  mock_test: ClipboardList,
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export function WhatsNewPopups() {
  const [queue, setQueue] = useState<PopupItem[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        if (!cancelled) setReady(true);
        return;
      }
      setUserId(uid);

      // Fetch seen ids for this user
      const { data: seenRows } = await supabase
        .from("user_seen_updates")
        .select("item_type,item_id")
        .eq("user_id", uid);
      const seen = new Set(
        (seenRows ?? []).map((r) => `${r.item_type}:${r.item_id}`),
      );

      const nowIso = new Date().toISOString();

      const [annRes, hwRes, mockRes] = await Promise.all([
        supabase
          .from("announcements")
          .select("id,title,body,scheduled_at,created_at,target_user_id,action_url")
          .or(`target_user_id.is.null,target_user_id.eq.${uid}`)
          .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("assignments")
          .select("id,title,description,due_at,total_marks,status,created_at")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("ai_mock_tests")
          .select(
            "id,title,description,duration_sec,total_marks,status,test_kind,scheduled_start_at,scheduled_end_at,published_at,created_at",
          )
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(15),
      ]);

      const next: PopupItem[] = [];

      const firstAnn = (annRes.data ?? []).find(
        (a) => !seen.has(`announcement:${a.id}`),
      );
      if (firstAnn) {
        next.push({
          type: "announcement",
          id: firstAnn.id,
          title: firstAnn.title,
          body: firstAnn.body ?? "",
          meta: `Published ${formatDate(firstAnn.scheduled_at ?? firstAnn.created_at)}`,
          viewUrl: firstAnn.action_url ?? "/notifications",
        });
      }

      const firstHw = (hwRes.data ?? []).find(
        (a) => !seen.has(`homework:${a.id}`),
      );
      if (firstHw) {
        const dueTxt = firstHw.due_at
          ? `Due ${formatDate(firstHw.due_at)}`
          : "No due date";
        next.push({
          type: "homework",
          id: firstHw.id,
          title: firstHw.title,
          body: firstHw.description ?? "",
          meta: `${dueTxt} · ${firstHw.total_marks ?? 0} marks`,
          viewUrl: `/assignments/${firstHw.id}`,
        });
      }

      const firstMock = (mockRes.data ?? []).find(
        (m) => !seen.has(`mock_test:${m.id}`),
      );
      if (firstMock) {
        const mins = Math.round((firstMock.duration_sec ?? 0) / 60);
        const isScheduled = firstMock.test_kind === "scheduled";
        const availability = isScheduled
          ? firstMock.scheduled_start_at
            ? `Available ${formatDate(firstMock.scheduled_start_at)}`
            : "Scheduled"
          : "Available now";
        next.push({
          type: "mock_test",
          id: firstMock.id,
          title: firstMock.title,
          body: firstMock.description ?? "",
          meta: `${mins} min · ${firstMock.total_marks ?? 0} marks · ${availability}`,
          viewUrl: isScheduled
            ? `/mock-tests/scheduled/${firstMock.id}`
            : `/mock-tests`,
        });
      }

      if (!cancelled) {
        setQueue(next);
        setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[0];

  async function markSeenAndAdvance() {
    if (!current || !userId) return;
    const item = current;
    // Optimistic advance
    setQueue((q) => q.slice(1));
    try {
      await supabase.from("user_seen_updates").insert({
        user_id: userId,
        item_type: item.type,
        item_id: item.id,
      });
    } catch {
      /* dedupe unique constraint is fine */
    }
  }

  // Dismiss without marking seen — popup can reappear next session.
  function dismissTemporarily() {
    setQueue((q) => q.slice(1));
  }

  function handleView() {
    const item = current;
    if (!item) return;
    void markSeenAndAdvance();
    if (item.viewUrl) {
      if (/^https?:\/\//.test(item.viewUrl)) {
        window.open(item.viewUrl, "_blank", "noopener");
      } else {
        navigate({ to: item.viewUrl });
      }
    }
  }

  if (!ready || !current) return null;

  const Icon = ICONS[current.type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[current.type]}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{
          boxShadow:
            "0 20px 60px -20px oklch(0 0 0 / 0.4), 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)",
        }}
      >
        {/* Accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        />

        <button
          type="button"
          onClick={markSeenAndAdvance}
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/70 hover:bg-secondary transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground shrink-0"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {TITLES[current.type]}
              </div>
              <h3 className="text-lg font-bold truncate">{current.title}</h3>
            </div>
          </div>

          {current.body && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">
              {current.body}
            </p>
          )}
          {current.meta && (
            <div className="mt-3 text-xs text-muted-foreground">
              {current.meta}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={markSeenAndAdvance}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:border-accent transition-colors"
            >
              Close
            </button>
            {current.viewUrl && (
              <button
                type="button"
                onClick={handleView}
                className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                View
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import type { AwardedBadge } from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";

const CELEBRATED_KEY = "pk:celebrated-badges";

function loadCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CELEBRATED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveCelebrated(set: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CELEBRATED_KEY, JSON.stringify(Array.from(set))); } catch { /* noop */ }
}

const MESSAGES = [
  "New badge unlocked!",
  "Your persistence paid off.",
  "You reached a new Python milestone.",
  "Keep learning — your next badge is close.",
];

function BadgeToastContent({ badge, reduced }: { badge: AwardedBadge; reduced: boolean }) {
  const line = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0.15 : 0.35, ease: "easeOut" }}
      className="flex items-center gap-3"
    >
      <BadgeMedallion icon={badge.icon} tier="gold" earned />
      <div className="min-w-0">
        <p className="text-sm font-semibold">🏆 {line}</p>
        <p className="text-sm">{badge.badge_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
      </div>
    </motion.div>
  );
}

/** Global listener — celebrates each new badge at most once per browser. */
export function BadgeToaster() {
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AwardedBadge>).detail;
      if (!detail) return;
      const celebrated = loadCelebrated();
      if (celebrated.has(detail.badge_key)) return;
      celebrated.add(detail.badge_key);
      saveCelebrated(celebrated);

      toast.custom(() => <BadgeToastContent badge={detail} reduced={reduced} />, {
        duration: 6000,
        action: {
          label: "View",
          onClick: () => { if (typeof window !== "undefined") window.location.href = "/profile"; },
        },
      });
    };
    window.addEventListener("pk:badge-earned", handler);
    return () => window.removeEventListener("pk:badge-earned", handler);
  }, [reduced]);

  return null;
}

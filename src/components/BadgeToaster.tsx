import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { useRouterState } from "@tanstack/react-router";
import type { AwardedBadge } from "@/lib/badges";
import { BadgeMedallion } from "@/components/BadgeMedallion";
import { Button } from "@/components/ui/button";

const CELEBRATED_KEY = "pk:celebrated-badges";
const QUEUE_KEY = "pk:pending-badge-celebrations";

function loadSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}
function saveSet(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch { /* noop */ }
}

function loadQueue(): AwardedBadge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AwardedBadge[]) : [];
  } catch { return []; }
}
function saveQueue(q: AwardedBadge[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* noop */ }
}

const HYPE_LINES = [
  "You just leveled up your Python journey!",
  "Consistency is your superpower — keep it going!",
  "Legendary move. Your future self is cheering.",
  "That's the mindset of a top coder.",
  "Small wins, big momentum. Onwards!",
  "You're rewriting what's possible for you.",
];

/** A mock test / exam-like screen is in progress — suppress celebrations. */
function isMockPathname(pathname: string): boolean {
  return (
    /\/mock-tests\/[^/]+\/run(\/|$)/.test(pathname) ||
    /\/mock-tests\/ai\/[^/]+\/take(\/|$)/.test(pathname)
  );
}

function fireConfetti(reduced: boolean) {
  if (reduced) return;
  const defaults = { spread: 90, ticks: 200, gravity: 0.9, decay: 0.94, startVelocity: 45, zIndex: 9999 };
  confetti({ ...defaults, particleCount: 120, origin: { x: 0.5, y: 0.35 } });
  setTimeout(() => confetti({ ...defaults, particleCount: 80, angle: 60, origin: { x: 0, y: 0.6 } }), 180);
  setTimeout(() => confetti({ ...defaults, particleCount: 80, angle: 120, origin: { x: 1, y: 0.6 } }), 320);
}

function CelebrationOverlay({
  badge, reduced, onClose,
}: { badge: AwardedBadge; reduced: boolean; onClose: () => void }) {
  const hype = HYPE_LINES[Math.floor(Math.random() * HYPE_LINES.length)];

  useEffect(() => {
    fireConfetti(reduced);
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [reduced, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      role="dialog"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 40 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-background via-background to-primary/10 p-8 text-center shadow-2xl"
      >
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-8 opacity-40"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(var(--primary)/0.5), transparent 40%, hsl(var(--primary)/0.5) 80%, transparent)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, ease: "linear", repeat: Infinity }}
          />
        )}
        <div className="relative">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Badge Unlocked
          </p>
          <motion.div
            className="mx-auto my-4 flex items-center justify-center"
            initial={reduced ? undefined : { scale: 0.4, rotate: -15 }}
            animate={reduced ? undefined : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
          >
            <div className="scale-[1.6]">
              <BadgeMedallion icon={badge.icon} tier="gold" earned />
            </div>
          </motion.div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">{badge.badge_name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{badge.description}</p>
          <p className="mt-4 text-base font-medium text-primary">🎉 {hype}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Awesome</Button>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                if (typeof window !== "undefined") window.location.href = "/profile";
              }}
            >
              View badges
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Global celebration listener. Queues events during mock tests; celebrates one at a time. */
export function BadgeToaster() {
  const reduced = useReducedMotion() ?? false;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [current, setCurrent] = useState<AwardedBadge | null>(null);
  const busyRef = useRef(false);

  const tryShowNext = useCallback(() => {
    if (typeof window === "undefined") return;
    if (busyRef.current) return;
    if (isMockPathname(window.location.pathname)) return;
    const queue = loadQueue();
    const celebrated = loadSet(CELEBRATED_KEY);
    while (queue.length) {
      const next = queue.shift()!;
      if (celebrated.has(next.badge_key)) continue;
      celebrated.add(next.badge_key);
      saveSet(CELEBRATED_KEY, celebrated);
      saveQueue(queue);
      busyRef.current = true;
      setCurrent(next);
      return;
    }
    saveQueue(queue);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AwardedBadge>).detail;
      if (!detail) return;
      const celebrated = loadSet(CELEBRATED_KEY);
      if (celebrated.has(detail.badge_key)) return;
      const queue = loadQueue();
      if (queue.some((b) => b.badge_key === detail.badge_key)) return;
      queue.push(detail);
      saveQueue(queue);
      tryShowNext();
    };
    window.addEventListener("pk:badge-earned", handler);
    return () => window.removeEventListener("pk:badge-earned", handler);
  }, [tryShowNext]);

  // When the user leaves a mock test screen, flush any pending celebrations.
  useEffect(() => {
    if (!isMockPathname(pathname)) tryShowNext();
  }, [pathname, tryShowNext]);

  const handleClose = useCallback(() => {
    setCurrent(null);
    busyRef.current = false;
    // Small delay so exit animation completes before the next one enters.
    setTimeout(tryShowNext, 350);
  }, [tryShowNext]);

  return (
    <AnimatePresence>
      {current && !isMockPathname(pathname) && (
        <CelebrationOverlay key={current.badge_key} badge={current} reduced={reduced} onClose={handleClose} />
      )}
    </AnimatePresence>
  );
}

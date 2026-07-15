import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Flame, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "pk:streak-warning-dismissed";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isMockPathname(pathname: string): boolean {
  return (
    /\/mock-tests\/[^/]+\/run(\/|$)/.test(pathname) ||
    /\/mock-tests\/ai\/[^/]+\/take(\/|$)/.test(pathname)
  );
}

/**
 * When the user's streak is at risk of breaking today (they had a streak
 * going, yesterday counted, today has no activity yet), show a warning
 * popup + toast. Suppressed during in-progress mock tests; fires as soon
 * as the user leaves the test.
 */
export function StreakWarningToaster() {
  const reduced = useReducedMotion() ?? false;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pending, setPending] = useState<{ streak: number } | null>(null);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    try {
      if (typeof window === "undefined") return;
      const dismissed = window.localStorage.getItem(DISMISSED_KEY);
      if (dismissed === todayKey()) return;

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;

      const { data } = await supabase
        .from("student_streaks")
        .select("current_streak, last_activity_date, today_completed")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data) return;

      const streak = data.current_streak ?? 0;
      if (streak < 1) return;
      if (data.today_completed) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      if (data.last_activity_date !== yStr) return;

      setPending({ streak });
    } catch (err) {
      console.warn("[streak-warning] check failed", err);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [check]);

  // Show the popup only when we're NOT on a mock-in-progress route.
  useEffect(() => {
    if (!pending) return;
    if (isMockPathname(pathname)) return;
    setOpen(true);
    toast.warning(`Your ${pending.streak}-day streak is about to break!`, {
      description: "Complete an activity today to keep it alive.",
      duration: 6000,
      icon: <Flame className="h-5 w-5 text-orange-500" />,
    });
  }, [pending, pathname]);

  const dismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY, todayKey());
    }
    setOpen(false);
    setPending(null);
  }, []);

  return (
    <AnimatePresence>
      {open && pending && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={dismiss}
          role="dialog"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: 30 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-destructive/40 bg-gradient-to-br from-background via-background to-destructive/10 p-8 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <motion.div
                animate={reduced ? undefined : { rotate: [0, -8, 8, -6, 6, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
              >
                <Flame className="h-9 w-9 text-orange-500" />
              </motion.div>
            </div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Streak at Risk
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Your {pending.streak}-day streak is about to break!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You haven't completed an activity today. Solve a practice question,
              submit homework, or take a mock test before midnight to keep your
              streak alive.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={dismiss}>
                Later
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  dismiss();
                  if (typeof window !== "undefined") {
                    window.location.href = "/practice";
                  }
                }}
              >
                Practice now
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

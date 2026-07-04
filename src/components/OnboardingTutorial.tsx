import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Step = {
  title: string;
  message: string;
  /** CSS selector for the element to highlight. Empty = centered, no highlight. */
  selector?: string;
  /** Navigate to this route before showing this step. */
  navigateTo?: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to PY Kidda Hub! 👋",
    message:
      "Hi! I'm Pyko, your Python guide. I'll quickly show you how to learn, practice, and take mock tests on this website.",
    navigateTo: "/",
  },
  {
    title: "Your dashboard",
    message:
      "This is your home base. From here you can jump into practice, take mock tests, and see your progress.",
    navigateTo: "/",
  },
  {
    title: "Practice Python",
    message:
      "Use the Practice section to solve Python questions unit-wise and topic-wise. Learn at your own speed.",
    selector: "[data-tour='nav-practice']",
  },
  {
    title: "Python coding area",
    message:
      "Inside each practice question you'll get an editor to write Python, run it instantly, and check your output.",
    navigateTo: "/practice",
  },
  {
    title: "Mock Tests",
    message:
      "Attempt time-based Python mock tests. Read every instruction carefully before you start.",
    selector: "[data-tour='nav-mock']",
  },
  {
    title: "Secure test mode",
    message:
      "During mock tests, secure mode is enabled. Follow the keyboard instructions. Leaving the screen may auto-submit your test.",
    selector: "[data-tour='nav-mock']",
  },
  {
    title: "Results",
    message:
      "After submitting, you can see your score, correct/wrong answers, time taken, and detailed performance.",
    selector: "[data-tour='nav-mock']",
  },
  {
    title: "Analytics & progress",
    message:
      "Your progress analytics help you understand your strong and weak topics — visual charts make it easy.",
    selector: "[data-tour='nav-analytics']",
  },
  {
    title: "Notifications",
    message:
      "Check notifications for new features, test announcements, teacher messages, and important updates.",
    selector: "[data-tour='nav-notifications']",
  },
  {
    title: "Profile & settings",
    message:
      "Update your profile, view your progress, and restart this tutorial any time from the Profile page.",
    selector: "[data-tour='nav-profile']",
  },
  {
    title: "You're all set! 🎉",
    message:
      "You're ready to start learning Python. Best of luck and happy coding!",
  },
];

import { isAdminEmail } from "@/lib/admin-emails";
const LOCAL_KEY = "pykidda:tutorial-status";

type Status = "not_started" | "completed" | "skipped";

function readLocal(): Status | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LOCAL_KEY);
  return v === "completed" || v === "skipped" || v === "not_started" ? v : null;
}
function writeLocal(v: Status) {
  try {
    window.localStorage.setItem(LOCAL_KEY, v);
  } catch {
    /* noop */
  }
}

export function OnboardingTutorial() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Decide whether to show
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      if (isAdminEmail(user.email)) return; // admin opt-out
      if (cancelled) return;
      setUserId(user.id);

      // Manual restart request?
      if (window.sessionStorage.getItem("pykidda:tutorial-force") === "1") {
        window.sessionStorage.removeItem("pykidda:tutorial-force");
        setStepIdx(0);
        setOpen(true);
        return;
      }

      // Local fast-path
      const local = readLocal();
      if (local === "completed" || local === "skipped") return;

      const { data: profile } = await supabase
        .from("profiles")
        // @ts-ignore — column added via migration, types may lag
        .select("tutorial_status")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // @ts-ignore
      const status = (profile?.tutorial_status as Status | undefined) ?? "not_started";
      if (status === "not_started") {
        writeLocal("not_started");
        setStepIdx(0);
        setOpen(true);
      } else {
        writeLocal(status);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for global restart event
  useEffect(() => {
    const h = () => {
      setStepIdx(0);
      setOpen(true);
    };
    window.addEventListener("pykidda:restart-tutorial", h);
    return () => window.removeEventListener("pykidda:restart-tutorial", h);
  }, []);

  const step = STEPS[stepIdx];

  // Auto-navigate if step requires
  useEffect(() => {
    if (!open || !step?.navigateTo) return;
    if (pathname !== step.navigateTo) {
      navigate({ to: step.navigateTo });
    }
  }, [open, step, pathname, navigate]);

  async function persist(status: Status) {
    writeLocal(status);
    if (!userId) return;
    try {
      await supabase
        .from("profiles")
        // @ts-ignore
        .upsert({ id: userId, tutorial_status: status }, { onConflict: "id" });
    } catch {
      /* offline / RLS — local fallback is fine */
    }
  }

  function next() {
    if (stepIdx >= STEPS.length - 1) {
      void persist("completed");
      setOpen(false);
      return;
    }
    setStepIdx((i) => i + 1);
  }
  function prev() {
    setStepIdx((i) => Math.max(0, i - 1));
  }
  function skip() {
    void persist("skipped");
    setOpen(false);
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <TutorialOverlay step={step} stepIdx={stepIdx} total={STEPS.length} onNext={next} onPrev={prev} onSkip={skip} />,
    document.body,
  );
}

function TutorialOverlay({
  step,
  stepIdx,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  step: Step;
  stepIdx: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Track highlighted element position
  useLayoutEffect(() => {
    if (!step.selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      } else {
        setRect(null);
      }
    };
    measure();
    // re-measure a few times in case route just changed
    const tries = [60, 200, 500, 900];
    const timers = tries.map((t) => window.setTimeout(measure, t));
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      timers.forEach((id) => clearTimeout(id));
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [step.selector]);

  // Position the speech bubble
  const bubblePos = useMemo(() => {
    if (!rect) {
      return {
        style: {
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        } as React.CSSProperties,
        place: "center" as const,
      };
    }
    const margin = 16;
    const bubbleW = 360;
    const bubbleH = 260;
    let left = rect.left + rect.width / 2 - bubbleW / 2;
    let top = rect.bottom + margin;
    let place: "below" | "above" = "below";
    if (top + bubbleH > window.innerHeight - 16) {
      top = Math.max(16, rect.top - bubbleH - margin);
      place = "above";
    }
    left = Math.min(Math.max(16, left), window.innerWidth - bubbleW - 16);
    return {
      style: { left, top, width: bubbleW } as React.CSSProperties,
      place,
    };
  }, [rect]);

  const PAD = 8;
  const cutout = rect
    ? {
        left: rect.left - PAD,
        top: rect.top - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tutorial"
    >
      {/* Dim overlay with a cutout */}
      <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <defs>
          <mask id="pyko-mask">
            <rect width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.width}
                height={cutout.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8, 12, 28, 0.72)" mask="url(#pyko-mask)" />
      </svg>

      {/* Glow ring around highlighted element */}
      {cutout && (
        <div
          className="absolute rounded-xl ring-4 ring-[oklch(0.85_0.18_85)] pointer-events-none animate-pulse"
          style={{
            left: cutout.left,
            top: cutout.top,
            width: cutout.width,
            height: cutout.height,
            boxShadow: "0 0 0 4px rgba(255, 209, 64, 0.35), 0 0 40px rgba(255, 209, 64, 0.45)",
          }}
        />
      )}

      {/* Speech bubble + mascot */}
      <div
        className="absolute pointer-events-auto"
        style={bubblePos.style}
      >
        <div className="flex items-end gap-3">
          <SnakeMascot />
          <div
            className="relative flex-1 rounded-2xl border-2 border-[oklch(0.85_0.18_85)] bg-card text-card-foreground p-5 shadow-2xl"
            style={{
              boxShadow:
                "0 20px 60px -10px rgba(0,0,0,0.5), 0 0 0 4px rgba(255, 209, 64, 0.15)",
            }}
          >
            {/* tail */}
            <div
              className="absolute -left-2 bottom-6 h-4 w-4 rotate-45 border-l-2 border-b-2 border-[oklch(0.85_0.18_85)] bg-card"
              aria-hidden
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                Step {stepIdx + 1} of {total}
              </div>
              <button
                onClick={onSkip}
                className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Skip tutorial
              </button>
            </div>
            <h3 className="mt-1 text-lg font-bold leading-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{step.message}</p>

            {/* progress bar */}
            <div className="mt-4 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${((stepIdx + 1) / total) * 100}%`,
                  backgroundImage: "var(--gradient-sunrise)",
                }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={onPrev}
                disabled={stepIdx === 0}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:border-accent"
              >
                ← Previous
              </button>
              <button
                onClick={onNext}
                className="rounded-md px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                {stepIdx === total - 1 ? "Finish 🎉" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnakeMascot() {
  return (
    <div className="shrink-0 select-none" aria-hidden>
      <svg
        width="84"
        height="96"
        viewBox="0 0 84 96"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-xl"
        style={{ animation: "pyko-bounce 2.2s ease-in-out infinite" }}
      >
        {/* Body coil */}
        <path
          d="M14 78 C 6 60, 22 50, 38 56 C 56 62, 74 52, 70 32 C 66 14, 46 10, 32 18"
          stroke="oklch(0.55 0.16 155)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M14 78 C 6 60, 22 50, 38 56 C 56 62, 74 52, 70 32 C 66 14, 46 10, 32 18"
          stroke="oklch(0.7 0.17 145)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 10"
          opacity="0.6"
        />
        {/* Head */}
        <ellipse cx="30" cy="20" rx="18" ry="14" fill="oklch(0.72 0.17 145)" />
        <ellipse cx="30" cy="22" rx="16" ry="11" fill="oklch(0.82 0.13 145)" />
        {/* Grad cap */}
        <rect x="14" y="6" width="32" height="4" rx="1" fill="#1a1a2e" />
        <polygon points="30,2 50,8 30,14 10,8" fill="#1a1a2e" />
        <circle cx="46" cy="10" r="1.6" fill="oklch(0.85 0.18 85)" />
        <path d="M46 11 L 50 22" stroke="oklch(0.85 0.18 85)" strokeWidth="1.4" />
        {/* Glasses */}
        <circle cx="24" cy="22" r="4" fill="white" stroke="#1a1a2e" strokeWidth="1.4" />
        <circle cx="36" cy="22" r="4" fill="white" stroke="#1a1a2e" strokeWidth="1.4" />
        <line x1="28" y1="22" x2="32" y2="22" stroke="#1a1a2e" strokeWidth="1.4" />
        {/* Eyes (blink) */}
        <circle cx="24" cy="22" r="1.6" fill="#1a1a2e">
          <animate attributeName="r" values="1.6;1.6;0.2;1.6" keyTimes="0;0.85;0.9;1" dur="3.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="36" cy="22" r="1.6" fill="#1a1a2e">
          <animate attributeName="r" values="1.6;1.6;0.2;1.6" keyTimes="0;0.85;0.9;1" dur="3.6s" repeatCount="indefinite" />
        </circle>
        {/* Smile */}
        <path d="M26 28 Q 30 31 34 28" stroke="#1a1a2e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Tongue tip */}
        <path d="M16 22 l -5 -1 l 2 2 l -2 2 l 5 -1" fill="oklch(0.65 0.22 25)" />
        {/* Tiny laptop */}
        <rect x="44" y="64" width="22" height="14" rx="2" fill="#1a1a2e" />
        <rect x="46" y="66" width="18" height="10" rx="1" fill="oklch(0.78 0.16 200)" />
        <rect x="42" y="78" width="26" height="2" rx="1" fill="#0f1024" />
      </svg>
      <style>{`
        @keyframes pyko-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/** Call this from anywhere to restart the tutorial (e.g. profile page button). */
export function restartTutorial() {
  try {
    window.sessionStorage.setItem("pykidda:tutorial-force", "1");
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent("pykidda:restart-tutorial"));
}

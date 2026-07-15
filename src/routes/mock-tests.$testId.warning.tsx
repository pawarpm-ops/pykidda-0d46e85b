import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMockTest, mockTestQuestions } from "@/lib/questions";
import { getStudentName, markTestStarted, setStudentName } from "@/lib/test-session";
import { supabase } from "@/integrations/supabase/client";
import { recordDailyStreakVisit } from "@/lib/streaks";

export const Route = createFileRoute("/mock-tests/$testId/warning")({
  head: () => ({
    meta: [
      { title: "Secure Keyboard-Only Mock Test · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Warning,
  ssr: false,
  notFoundComponent: () => <div className="p-10">Test not found.</div>,
  errorComponent: () => <div className="p-10">Something went wrong.</div>,
});

type Shortcut = { keys: string[]; label: string; accent?: boolean };

const SHORTCUTS: Shortcut[] = [
  { keys: ["Alt", "P"], label: "Previous Question" },
  { keys: ["Alt", "N"], label: "Save and Next" },
  { keys: ["Alt", "R"], label: "Reset / Clear Answer" },
  { keys: ["Alt", "S"], label: "Open Submit Confirmation" },
  { keys: ["Ctrl", "Enter"], label: "Confirm Final Submit", accent: true },
  { keys: ["Alt", "E"], label: "Focus Code Answer Box" },
  { keys: ["Alt", "H"], label: "Show / Hide Help Panel" },
  { keys: ["Tab"], label: "Indent Code" },
  { keys: ["Shift", "Tab"], label: "Remove Code Indent" },
  { keys: ["Esc"], label: "Auto-submit due to violation", accent: true },
  { keys: ["Alt", "1-4"], label: "Select MCQ Option A–D" },
];

function Key({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <kbd
      className={`inline-flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-1 font-mono text-xs font-bold shadow-sm ${
        accent
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-border bg-secondary text-foreground"
      }`}
    >
      {children}
    </kbd>
  );
}

function Warning() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const test = getMockTest(testId);
  const [seconds, setSeconds] = useState(10);
  const [name, setName] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [unsupported, setUnsupported] = useState<string | null>(null);

  useEffect(() => {
    // Block touch-primary / mobile / tablet devices — fullscreen + key-blocking can't be enforced.
    const isTouchOnly =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches &&
      !window.matchMedia?.("(pointer: fine)").matches;
    const tooSmall = typeof window !== "undefined" && (window.innerWidth < 900 || window.innerHeight < 600);
    const noFs =
      typeof document !== "undefined" &&
      !document.documentElement.requestFullscreen &&
      // @ts-expect-error vendor
      !document.documentElement.webkitRequestFullscreen;
    if (isTouchOnly || tooSmall) {
      setUnsupported("Mock tests can only be taken on a desktop or laptop with a physical keyboard and mouse. Please switch to a laptop/desktop in fullscreen mode.");
    } else if (noFs) {
      setUnsupported("Your browser does not support secure fullscreen mode. Please use the latest Chrome, Edge, or Firefox on desktop.");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setAuthChecked(true);
      const fromMeta = data.session.user.user_metadata?.full_name as string | undefined;
      setName(getStudentName() !== "Student" ? getStudentName() : fromMeta || "");
    });
  }, [navigate]);


  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Test not found.</p>
          <Link to="/mock-tests" className="underline mt-2 inline-block">Back to mock tests</Link>
        </div>
      </div>
    );
  }
  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (unsupported) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg rounded-xl border-2 border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-destructive font-bold">Device Not Supported</p>
          <h1 className="mt-2 text-xl font-bold">Mock test cannot start</h1>
          <p className="mt-3 text-sm text-foreground">{unsupported}</p>
          <Link to="/mock-tests" className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm font-medium">
            Back to mock tests
          </Link>
        </div>
      </div>
    );
  }

  const qs = mockTestQuestions(test);
  const marks = qs.reduce((a, q) => a + q.marks, 0);
  const ready = seconds <= 0;


  async function startTest() {
    if (!ready) return;
    if (name.trim()) setStudentName(name.trim());
    markTestStarted(testId);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* if denied, the run page will detect and auto-submit */
    }
    navigate({ to: "/mock-tests/$testId/run", params: { testId } });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.18_0.05_260)] via-background to-[oklch(0.22_0.06_220)] text-foreground px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-accent font-bold">PY Kidda Hub</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold leading-tight bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
            Secure Keyboard-Only Mock Test Mode
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl mx-auto">
            Mouse will be disabled during the test. Use only keyboard shortcuts.
          </p>
        </div>

        <div className="mt-6 rounded-xl border-2 border-destructive/50 bg-destructive/10 p-5 text-sm leading-relaxed">
          <p className="font-bold text-destructive uppercase tracking-wide text-xs">⚠ Anti-cheating Warning</p>
          <p className="mt-2 text-foreground">
            If you press <Key>Esc</Key>, exit fullscreen, switch tabs, minimize the browser, or
            leave the test window, your test will be{" "}
            <strong>automatically submitted</strong> as a violation.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-accent font-semibold">Test</p>
          <p className="font-bold text-lg mt-1">{test.name}</p>
          <p className="text-sm text-muted-foreground">
            {qs.length} questions · {Math.round(test.durationSec / 60)} minutes · {marks} marks · Coding (Python)
          </p>
        </div>

        <h2 className="mt-8 text-xl font-bold">Keyboard Shortcuts</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border bg-card p-4 transition hover:border-accent/60 hover:shadow-[var(--shadow-warm)] ${
                s.accent ? "border-accent/40" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Key accent={s.accent}>{k}</Key>
                    {i < s.keys.length - 1 && <span className="text-muted-foreground">+</span>}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">


          <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {seconds > 0
                ? `You can start the test after ${seconds} second${seconds === 1 ? "" : "s"}.`
                : "You may start the test now."}
            </p>
            <button
              disabled={!ready}
              onClick={startTest}
              className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              {seconds > 0 ? `Please wait ${seconds}s…` : "I Understand and Start Test"}
            </button>
          </div>

          <div className="mt-4">
            <Link to="/mock-tests" className="text-xs text-muted-foreground hover:text-accent underline">
              Cancel and go back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

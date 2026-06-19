import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMockTest } from "@/lib/mock-tests";
import { getStudentName, markTestStarted, setStudentName } from "@/lib/test-session";

export const Route = createFileRoute("/mock-tests/$testId/warning")({
  head: () => ({
    meta: [
      { title: "Test Warning · Python Mock Test" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Warning,
  notFoundComponent: () => <div className="p-10">Test not found.</div>,
  errorComponent: () => <div className="p-10">Something went wrong.</div>,
});

function Warning() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const test = getMockTest(testId);
  const [seconds, setSeconds] = useState(10);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(getStudentName());
  }, []);

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

  const ready = seconds <= 0 && name.trim().length > 0;

  async function startTest() {
    if (!ready) return;
    setStudentName(name.trim());
    markTestStarted(testId);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // If denied, still navigate — page will detect non-fullscreen and auto-submit.
    }
    navigate({ to: "/mock-tests/$testId/run", params: { testId } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-destructive/40 bg-card p-8 shadow-[var(--shadow-warm)]">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            !
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-destructive font-semibold">Important</p>
            <h1 className="text-2xl font-bold leading-tight">Read before you start</h1>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-secondary p-4 text-sm leading-relaxed">
          <p className="font-semibold text-foreground">{test.name}</p>
          <p className="text-muted-foreground mt-1">
            {test.questions.length} questions · {Math.round(test.durationSec / 60)} minutes ·{" "}
            {test.questions.reduce((a, q) => a + q.marks, 0)} marks
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-foreground">
          This mock test will open in <strong>full-screen mode</strong>. Do <strong>not</strong> switch tabs,
          minimize the browser, resize the window, press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Esc</kbd>,
          open another app, or exit full-screen mode. If you leave the full-screen test window, your test will be
          <strong> automatically submitted</strong> and your result will be generated immediately.
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-medium">Your full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., Aarav Sharma"
          />
        </label>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {seconds > 0
              ? `You can start the test after ${seconds} second${seconds === 1 ? "" : "s"}.`
              : "You may start the test now."}
          </p>
          <button
            disabled={!ready}
            onClick={startTest}
            className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            I Understand and Start Test
          </button>
        </div>

        <div className="mt-4">
          <Link to="/mock-tests" className="text-xs text-muted-foreground hover:text-accent underline">
            Cancel and go back
          </Link>
        </div>
      </div>
    </div>
  );
}

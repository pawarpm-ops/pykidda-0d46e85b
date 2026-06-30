import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMockTest, mockTestQuestions, type CodeQuestion } from "@/lib/questions";
import {
  clearTestStarted,
  getStudentName,
  getTestStartedAt,
  gradeFor,
  isTestStarted,
  markTestStarted,
  saveResult,
  type AttemptResult,
  type QuestionAttempt,
} from "@/lib/test-session";
import { loadPyodideOnce, outputsMatch, runPython } from "@/lib/pyodide-runner";
import { recordMockResult } from "@/lib/progress";
import { syncMyScore } from "@/lib/leaderboard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/mock-tests/$testId/run")({
  head: () => ({
    meta: [
      { title: "Mock Test in progress" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RunTest,
  ssr: false,
  notFoundComponent: () => <div className="p-10">Test not found.</div>,
  errorComponent: () => <div className="p-10">Something went wrong.</div>,
});

type CodeMap = Record<string, string>;

const SECURE_CSS = `
.secure-keyboard-test, .secure-keyboard-test * { cursor: none !important; }
.secure-keyboard-test { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.secure-keyboard-test button,
.secure-keyboard-test label,
.secure-keyboard-test .question-nav,
.secure-keyboard-test .submit-button,
.secure-keyboard-test .reset-button { pointer-events: none !important; }
.secure-keyboard-test .code-editor { pointer-events: none !important; }
.secure-keyboard-test .code-editor textarea { pointer-events: none !important; user-select: text; -webkit-user-select: text; }
@media print { body.secure-test-printing-blocked * { display: none !important; visibility: hidden !important; } }
`;


function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold">
      {children}
    </kbd>
  );
}

function RunTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const test = getMockTest(testId);
  const questions: CodeQuestion[] = useMemo(() => (test ? mockTestQuestions(test) : []), [test]);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(isTestStarted(testId));
    loadPyodideOnce().catch(() => {});
  }, [testId]);

  const startedAt = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState<number>(test?.durationSec ?? 0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  currentIdxRef.current = currentIdx;
  const [codes, setCodes] = useState<CodeMap>({});
  const codesRef = useRef<CodeMap>({});
  codesRef.current = codes;
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const [grading, setGrading] = useState(false);
  const [gradeMsg, setGradeMsg] = useState("Submitting…");
  const [showHelp, setShowHelp] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const showSubmitConfirmRef = useRef(false);
  showSubmitConfirmRef.current = showSubmitConfirm;

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!test || allowed !== true) return;
    const existingStartedAt = getTestStartedAt(testId);
    const persistedStartedAt = existingStartedAt ?? Date.now();
    if (!existingStartedAt) markTestStarted(testId, persistedStartedAt);
    startedAt.current = persistedStartedAt;
    const elapsed = Math.max(0, Math.floor((Date.now() - persistedStartedAt) / 1000));
    setRemaining(Math.max(0, test.durationSec - elapsed));
  }, [test, testId, allowed]);

  useEffect(() => {
    if (!test) return;
    setCodes((c) => {
      const next = { ...c };
      let changed = false;
      for (const q of questions) {
        if (!(q.id in next)) {
          next[q.id] = q.starterCode;
          changed = true;
        }
      }
      return changed ? next : c;
    });
  }, [test, questions]);

  const submit = useCallback(
    async (submissionType: "normal" | "auto-violation" = "normal", violationReason?: string) => {
      if (submittedRef.current || !test) return;
      submittedRef.current = true;
      submittingRef.current = true;
      setGrading(true);
      setGradeMsg(submissionType === "auto-violation" ? "Auto-submitting & grading…" : "Grading your code…");

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const attempts: QuestionAttempt[] = [];
      let marksObtained = 0;
      let totalMarks = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const code = codesRef.current[q.id] ?? q.starterCode;
        totalMarks += q.marks;
        setGradeMsg(`Grading Q${i + 1} of ${questions.length}…`);
        const results: QuestionAttempt["results"] = [];
        let passed = 0;
        for (const tc of q.tests) {
          // eslint-disable-next-line no-await-in-loop
          const r = await runPython(code, tc.stdin ?? "");
          const ok = r.ok && outputsMatch(r.stdout, tc.expected);
          if (ok) passed++;
          results.push({ passed: ok, expected: tc.expected, actual: r.stdout, stderr: r.stderr });
        }
        const allPassed = passed === q.tests.length;
        const marks = allPassed ? q.marks : 0;
        marksObtained += marks;
        attempts.push({
          questionId: q.id,
          code,
          passed,
          total: q.tests.length,
          marksObtained: marks,
          marksTotal: q.marks,
          results,
        });
      }

      const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
      const timeTakenSec = Math.min(test.durationSec, Math.floor((Date.now() - startedAt.current) / 1000));
      const result: AttemptResult = {
        testId: test.id,
        testName: test.name,
        studentName: getStudentName(),
        totalQuestions: questions.length,
        marksObtained,
        totalMarks,
        percentage,
        grade: gradeFor(percentage),
        timeTakenSec,
        submissionType,
        violationReason,
        attempts,
        submittedAt: Date.now(),
      };
      saveResult(result);
      try {
        const { data } = await supabase.auth.getUser();
        recordMockResult(data.user?.id ?? null, result);
      } catch {
        recordMockResult(null, result);
      }
      void syncMyScore();
      clearTestStarted(testId);
      navigate({ to: "/mock-tests/$testId/result", params: { testId } });
    },
    [navigate, questions, test, testId],
  );

  // Timer
  useEffect(() => {
    if (!test || allowed !== true) return;
    let timeoutId: number | undefined;
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000));
      const nextRemaining = Math.max(0, test.durationSec - elapsed);
      setRemaining(nextRemaining);
      if (nextRemaining <= 0) {
        void submit("normal");
        return;
      }
      const msUntilNextSecond = 1000 - ((Date.now() - startedAt.current) % 1000);
      timeoutId = window.setTimeout(tick, Math.max(100, msUntilNextSecond));
    };
    tick();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [test, allowed, submit]);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  // Auto-focus editor when question changes
  useEffect(() => {
    if (allowed === true) focusEditor();
  }, [currentIdx, allowed, focusEditor]);

  // Anti-cheat + keyboard-only mode
  const testActiveRef = useRef(false);
  useEffect(() => {
    if (!test || allowed !== true) return;

    testActiveRef.current = true;

    const autoSubmit = (reason: string) => {
      if (!testActiveRef.current || submittedRef.current) return;
      void submit("auto-violation", reason);
    };

    const onFsChange = () => {
      const fsEl =
        document.fullscreenElement ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).webkitFullscreenElement ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).mozFullScreenElement ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).msFullscreenElement;
      if (!fsEl) autoSubmit("Exited fullscreen mode / Esc pressed");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") autoSubmit("Tab switched or browser minimized");
    };
    const onBlur = () => autoSubmit("Window lost focus");
    const onPageHide = () => autoSubmit("Page hidden or closed");
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Mouse-blocking (capture phase) — except for the active editor textarea
    const blockedMouseEvents = [
      "click",
      "dblclick",
      "mousedown",
      "mouseup",
      "mousemove",
      "pointerdown",
      "pointerup",
      "pointermove",
      "contextmenu",
      "dragstart",
      "dragover",
      "dragend",
      "drop",
      "selectstart",
      "auxclick",
      "touchstart",
      "touchend",
      "touchmove",
      "gesturestart",
      "gesturechange",
      "gestureend",
    ];
    const blockMouse = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };


    // Keyboard handler
    const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
    const goNext = () => {
      setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
    };
    const resetCurrent = () => {
      const q = questions[currentIdxRef.current];
      if (!q) return;
      setCodes((c) => ({ ...c, [q.id]: q.starterCode }));
      focusEditor();
    };

    const onKey = (e: KeyboardEvent) => {
      if (!testActiveRef.current || submittedRef.current) return;

      const lower = e.key.toLowerCase();

      // === Screenshot detection — every known combo auto-submits ===
      // 1) PrintScreen (any modifier: plain / Alt+ / Ctrl+ / Shift+ / Win+)
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        try { navigator.clipboard?.writeText(""); } catch { /* ignore */ }
        const mods = [
          e.ctrlKey && "Ctrl",
          e.altKey && "Alt",
          e.shiftKey && "Shift",
          e.metaKey && "Win/Cmd",
        ].filter(Boolean).join("+");
        autoSubmit(`Auto-submitted: screenshot attempt (${mods ? mods + "+" : ""}PrintScreen key)`);
        return;
      }

      // 2) Windows Snipping Tool: Win+Shift+S
      if (e.shiftKey && (e.metaKey || e.getModifierState?.("Meta")) && lower === "s") {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (Windows Snipping Tool — Win+Shift+S)");
        return;
      }

      // 3) Windows Game Bar screenshot: Win+Alt+PrintScreen / Win+G / Win+Alt+G
      if ((e.metaKey || e.getModifierState?.("Meta")) && (lower === "g")) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (Windows Game Bar — Win+G)");
        return;
      }

      // 4) macOS screenshot: Cmd+Shift+3 / 4 / 5 / 6, and Cmd+Ctrl+Shift+3/4 (to clipboard)
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit(`Auto-submitted: screenshot attempt (macOS Cmd+Shift+${e.key})`);
        return;
      }
      if (e.metaKey && e.ctrlKey && e.shiftKey && ["3", "4"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit(`Auto-submitted: screenshot attempt (macOS Cmd+Ctrl+Shift+${e.key})`);
        return;
      }

      // 5) ChromeOS screenshot: Ctrl+Show-Windows (F5) / Ctrl+Shift+Show-Windows
      if (e.ctrlKey && (e.key === "F5" || (e.shiftKey && e.key === "F5"))) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (ChromeOS Ctrl+Show-Windows)");
        return;
      }

      // 6) Lone Windows / Meta key press (opens Start / could trigger snip overlays)
      if (e.key === "Meta" || e.key === "OS" || e.code === "MetaLeft" || e.code === "MetaRight") {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: Windows/Command key pressed (possible screenshot/menu trigger)");
        return;
      }

      // 6b) Shift+F10 / dedicated ContextMenu key — opens right-click menu without mouse
      if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu" || e.code === "ContextMenu") {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: context-menu key combination");
        return;
      }

      // 6c) Reload attempts: F5 / Ctrl+R / Ctrl+Shift+R / Ctrl+F5
      if (
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && lower === "r") ||
        ((e.ctrlKey || e.metaKey) && e.key === "F5")
      ) {
        e.preventDefault();
        e.stopPropagation();
        try { sessionStorage.setItem(`pykidda:violation:${testId}`, "reload-attempt"); } catch { /* ignore */ }
        autoSubmit("Auto-submitted: page reload attempt");
        return;
      }

      // 6d) Browser tab/window control: Ctrl+T / Ctrl+N / Ctrl+W / Ctrl+Shift+T / Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+PgUp / Ctrl+PgDn
      if (
        (e.ctrlKey || e.metaKey) &&
        (["t", "n", "w"].includes(lower) ||
          (e.shiftKey && lower === "t") ||
          e.key === "Tab" ||
          e.key === "PageUp" ||
          e.key === "PageDown")
      ) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit(`Auto-submitted: browser tab/window shortcut (${e.key})`);
        return;
      }

      // 6e) Alt+F4 / Alt+Space (close / system menu on Windows)
      if (e.altKey && (e.key === "F4" || e.key === " " || e.code === "Space")) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: window-close shortcut");
        return;
      }

      // === Clipboard / save / view-source — silently blocked (no auto-submit) ===
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "p", "u"].includes(lower)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Ctrl+S used to be blocked outright; if you also want auto-submit on save, swap to autoSubmit
      if ((e.ctrlKey || e.metaKey) && lower === "s" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Block F12 / Ctrl+Shift+I/J/C/K (devtools across browsers)
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(lower))
      ) {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: developer tools shortcut detected");
        return;
      }


      // Esc → auto-submit violation (primary detector is fullscreen, this is backup)
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        autoSubmit("Auto-submitted: Escape key pressed");
        return;
      }

      // Submit-confirm modal: Ctrl+Enter to confirm
      if (showSubmitConfirmRef.current && e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        setShowSubmitConfirm(false);
        showSubmitConfirmRef.current = false;
        void submit("normal");
        return;
      }

      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        void submit("normal");
        return;
      }

      if (e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "p") { e.preventDefault(); goPrev(); return; }
        if (k === "n") { e.preventDefault(); goNext(); return; }
        if (k === "r") { e.preventDefault(); resetCurrent(); return; }
        if (k === "s") {
          e.preventDefault();
          setShowSubmitConfirm(true);
          showSubmitConfirmRef.current = true;
          return;
        }
        if (k === "e") { e.preventDefault(); focusEditor(); return; }
        if (k === "h") { e.preventDefault(); setShowHelp((v) => !v); return; }
      }
    };



    // Block clipboard operations and printing
    const blockClipboard = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const ce = e as ClipboardEvent;
        ce.clipboardData?.setData("text/plain", "");
      } catch { /* ignore */ }
    };
    const onBeforePrint = () => {
      autoSubmit("Print attempt detected");
    };


    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("mozfullscreenchange", onFsChange);
    document.addEventListener("MSFullscreenChange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("copy", blockClipboard, true);
    document.addEventListener("cut", blockClipboard, true);
    document.addEventListener("paste", blockClipboard, true);
    window.addEventListener("beforeprint", onBeforePrint);
    document.body.classList.add("secure-test-printing-blocked");


    const container = containerRef.current;
    const mouseListener = (e: Event) => {
      // allow keyboard-focused editor textarea typing; we still block mouse events on it
      const target = e.target as HTMLElement | null;
      // We block ALL mouse-derived events. selectstart inside editor allowed for keyboard selection.
      if (e.type === "selectstart" && target?.tagName === "TEXTAREA") return;
      blockMouse(e);
    };
    if (container) {
      for (const evt of blockedMouseEvents) {
        container.addEventListener(evt, mouseListener, true);
      }
    }

    // Re-request fullscreen if not active
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        autoSubmit("Fullscreen permission denied");
      });
    }

    return () => {
      testActiveRef.current = false;
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("mozfullscreenchange", onFsChange);
      document.removeEventListener("MSFullscreenChange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("copy", blockClipboard, true);
      document.removeEventListener("cut", blockClipboard, true);
      document.removeEventListener("paste", blockClipboard, true);
      window.removeEventListener("beforeprint", onBeforePrint);
      document.body.classList.remove("secure-test-printing-blocked");
      if (container) {
        for (const evt of blockedMouseEvents) {
          container.removeEventListener(evt, mouseListener, true);
        }
      }
    };
  }, [test, allowed, submit, questions, focusEditor]);


  if (allowed === false) return <Navigate to="/mock-tests/$testId/warning" params={{ testId }} />;
  if (!test || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const q = questions[currentIdx];
  const totalSec = test.durationSec;
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const criticalTime = remaining <= 60;
  const lowTime = remaining <= 300; // 5 min warning
  const elapsedPct = totalSec > 0 ? Math.min(100, ((totalSec - remaining) / totalSec) * 100) : 0;
  const timeColor = criticalTime
    ? "text-red-500"
    : lowTime
      ? "text-amber-500"
      : "text-foreground";
  const barColor = criticalTime
    ? "bg-red-500"
    : lowTime
      ? "bg-amber-500"
      : "bg-accent";
  const currentCode = codes[q.id] ?? q.starterCode;

  return (
    <div ref={containerRef} className="secure-keyboard-test min-h-screen bg-background text-foreground flex flex-col">
      <style>{SECURE_CSS}</style>

      {/* Top keyboard help strip */}
      <div className="sticky top-0 z-20 border-b border-accent/30 bg-accent/10 backdrop-blur px-4 py-2 text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold text-accent">🔒 KEYBOARD-ONLY</span>
        <span><Kbd>Alt</Kbd>+<Kbd>P</Kbd> Previous</span>
        <span><Kbd>Alt</Kbd>+<Kbd>N</Kbd> Save & Next</span>
        <span><Kbd>Alt</Kbd>+<Kbd>R</Kbd> Reset</span>
        <span><Kbd>Alt</Kbd>+<Kbd>S</Kbd> Submit</span>
        <span><Kbd>Alt</Kbd>+<Kbd>E</Kbd> Code Box</span>
        <span><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> Confirm Submit</span>
        <span><Kbd>Alt</Kbd>+<Kbd>H</Kbd> Toggle Help</span>
        <span className="ml-auto text-muted-foreground">Mouse disabled — use keyboard only.</span>
      </div>

      <header className="border-b border-border bg-card">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Mock Test · PY Kidda</p>
            <p className="font-semibold leading-tight">{test.name}</p>
          </div>
          <div
            className={`text-right ${timeColor} ${criticalTime ? "animate-pulse" : ""}`}
            role="timer"
            aria-live={criticalTime ? "assertive" : "polite"}
            aria-label={`Time remaining: ${hrs} hours ${mins} minutes ${secs} seconds`}
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80">
              {criticalTime ? "⏰ Time Almost Up!" : lowTime ? "⚠ Time Running Out" : "Time Left"}
            </p>
            <p className="font-mono text-2xl font-bold leading-tight tabular-nums">
              {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </p>
            <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">
              {hrs}h {mins}m {secs}s left
            </p>

          </div>
        </div>
        {/* Progress bar showing elapsed time */}
        <div className="h-1 w-full bg-border/40 overflow-hidden" aria-hidden="true">
          <div
            className={`h-full ${barColor} transition-all duration-1000 ease-linear`}
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-6 grid lg:grid-cols-[1fr_240px] gap-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question <strong className="text-foreground">{currentIdx + 1}</strong> of {questions.length}
            </span>
            <span className="text-muted-foreground">Marks: {q.marks}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug">{q.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{q.prompt}</p>

          <div className="code-editor mt-5 rounded-lg border border-border bg-[oklch(0.18_0.02_250)] text-[oklch(0.97_0.005_85)]">
            <div className="border-b border-white/10 px-3 py-2 text-xs font-mono uppercase tracking-widest opacity-70 flex justify-between">
              <span>solution.py</span>
              <span>Press <Kbd>Alt</Kbd>+<Kbd>E</Kbd> to focus</span>
            </div>
            <textarea
              ref={editorRef}
              key={q.id}
              value={currentCode}
              onChange={(e) => setCodes((c) => ({ ...c, [q.id]: e.target.value }))}
              spellCheck={false}
              rows={16}
              autoFocus
              className="block w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none"
              style={{ tabSize: 4 }}
              onKeyDown={(e) => {
                // Tab insert / Shift+Tab dedent
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  if (e.shiftKey) {
                    // remove up to 4 leading spaces from line containing caret
                    const lineStart = currentCode.lastIndexOf("\n", start - 1) + 1;
                    const before = currentCode.slice(0, lineStart);
                    const line = currentCode.slice(lineStart, end);
                    const after = currentCode.slice(end);
                    let removed = 0;
                    let newLine = line;
                    const m = line.match(/^ {1,4}/);
                    if (m) {
                      removed = m[0].length;
                      newLine = line.slice(removed);
                    }
                    const next = before + newLine + after;
                    setCodes((c) => ({ ...c, [q.id]: next }));
                    requestAnimationFrame(() => {
                      el.selectionStart = el.selectionEnd = Math.max(lineStart, start - removed);
                    });
                  } else {
                    const next = currentCode.slice(0, start) + "    " + currentCode.slice(end);
                    setCodes((c) => ({ ...c, [q.id]: next }));
                    requestAnimationFrame(() => {
                      el.selectionStart = el.selectionEnd = start + 4;
                    });
                  }
                }
              }}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              disabled={currentIdx === 0}
              className="reset-button rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              ← Previous <Kbd>Alt</Kbd>+<Kbd>P</Kbd>
            </button>
            <button className="reset-button rounded-md border border-border bg-background px-3 py-2 text-sm">
              Reset <Kbd>Alt</Kbd>+<Kbd>R</Kbd>
            </button>
            <div className="ml-auto flex gap-2">
              {currentIdx < questions.length - 1 ? (
                <button
                  className="submit-button rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Save &amp; Next <Kbd>Alt</Kbd>+<Kbd>N</Kbd>
                </button>
              ) : (
                <button
                  className="submit-button rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  Submit Test <Kbd>Alt</Kbd>+<Kbd>S</Kbd>
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card p-4 h-fit">
          <p className="text-sm font-semibold">Question Navigator</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((qq, i) => {
              const touched = (codes[qq.id] ?? qq.starterCode) !== qq.starterCode;
              const isCurrent = i === currentIdx;
              return (
                <div
                  key={qq.id}
                  className={`question-nav h-9 w-full rounded text-sm font-semibold border flex items-center justify-center ${
                    touched ? "bg-accent border-accent text-accent-foreground" : "bg-background border-border"
                  } ${isCurrent ? "ring-2 ring-ring" : ""}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <button
            className="submit-button mt-4 w-full rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Submit <Kbd>Alt</Kbd>+<Kbd>S</Kbd>
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
            Anti-cheating active. Exiting fullscreen, switching tabs, or pressing Esc auto-submits.
          </p>
        </aside>
      </main>

      {/* Floating help panel */}
      {showHelp && (
        <div className="fixed bottom-4 right-4 z-30 w-72 rounded-xl border border-accent/40 bg-card p-4 shadow-[var(--shadow-warm)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-accent font-bold">Shortcuts</p>
            <span className="text-[10px] text-muted-foreground"><Kbd>Alt</Kbd>+<Kbd>H</Kbd> to hide</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            <li className="flex justify-between"><span>Previous</span><span><Kbd>Alt</Kbd>+<Kbd>P</Kbd></span></li>
            <li className="flex justify-between"><span>Save & Next</span><span><Kbd>Alt</Kbd>+<Kbd>N</Kbd></span></li>
            <li className="flex justify-between"><span>Reset</span><span><Kbd>Alt</Kbd>+<Kbd>R</Kbd></span></li>
            <li className="flex justify-between"><span>Submit confirm</span><span><Kbd>Alt</Kbd>+<Kbd>S</Kbd></span></li>
            <li className="flex justify-between"><span>Final submit</span><span><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span></li>
            <li className="flex justify-between"><span>Focus editor</span><span><Kbd>Alt</Kbd>+<Kbd>E</Kbd></span></li>
            <li className="flex justify-between"><span>Indent / dedent</span><span><Kbd>Tab</Kbd>/<Kbd>⇧Tab</Kbd></span></li>
          </ul>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && !grading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-xl border-2 border-accent/50 bg-card px-8 py-6 text-center shadow-[var(--shadow-warm)] max-w-md">
            <p className="text-lg font-bold">Are you sure you want to submit?</p>
            <p className="mt-2 text-sm text-muted-foreground">Press <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to confirm final submission.</p>
            <p className="mt-4 text-xs text-muted-foreground">Press <Kbd>Alt</Kbd>+<Kbd>S</Kbd> again or any other shortcut to dismiss is not available — only Ctrl+Enter submits.</p>
          </div>
        </div>
      )}

      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-xl border border-border bg-card px-8 py-6 text-center shadow-[var(--shadow-warm)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="mt-4 font-semibold">{gradeMsg}</p>
            <p className="mt-1 text-sm text-muted-foreground">Running your code through Python — don't close this tab.</p>
          </div>
        </div>
      )}
    </div>
  );
}

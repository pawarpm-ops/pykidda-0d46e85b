// AI mock test — take page. Loads sanitized questions, enforces the same secure
// keyboard-only, mouse-disabled, anti-cheat runtime as built-in mock tests.
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PythonCodeEditor } from "@/components/PythonCodeEditor";
import { useServerFn } from "@tanstack/react-start";
import { getStudentAiTest, submitAiMockAttempt } from "@/lib/ai-mock.functions";
import { startPykoAssessment, endPykoAssessment } from "@/lib/pyko/assessment.functions";
import { loadPyodideOnce, runPython } from "@/lib/pyodide-runner";
import { recordStreakActivity } from "@/lib/streaks";
import { syncMyScore } from "@/lib/leaderboard";
import {
  clearTestStarted,
  getTestStartedAt,
  isTestStarted,
  markTestStarted,
} from "@/lib/test-session";

export const Route = createFileRoute("/mock-tests/ai/$testId/take")({
  head: () => ({ meta: [{ title: "AI Mock Test" }, { name: "robots", content: "noindex" }] }),
  component: TakeAiMock,
  ssr: false,
});

const SECURE_CSS = `
.secure-keyboard-test, .secure-keyboard-test * { cursor: none !important; }
.secure-keyboard-test { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.secure-keyboard-test button,
.secure-keyboard-test label,
.secure-keyboard-test .question-nav,
.secure-keyboard-test .submit-button,
.secure-keyboard-test .reset-button { pointer-events: none !important; }
.secure-keyboard-test .answer-editor { pointer-events: none !important; }
.secure-keyboard-test .answer-editor textarea { pointer-events: none !important; user-select: text; -webkit-user-select: text; }
@media print { body.secure-test-printing-blocked * { display: none !important; visibility: hidden !important; } }
`;

type QType = "mcq" | "tf" | "fill" | "short" | "code";
type Q = {
  id: string;
  order_index: number;
  type: QType;
  prompt: string;
  options: string[];
  starter_code: string;
  code_tests: { stdin: string; expected: string }[];
  marks: number;
};
type Test = {
  id: string;
  title: string;
  description: string;
  duration_sec: number;
  total_marks: number;
  question_count: number;
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold">
      {children}
    </kbd>
  );
}

function TakeAiMock() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getStudentAiTest);
  const submitFn = useServerFn(submitAiMockAttempt);
  const pykoStart = useServerFn(startPykoAssessment);
  const pykoEnd = useServerFn(endPykoAssessment);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(isTestStarted(testId));
    loadPyodideOnce().catch(() => {});
  }, [testId]);

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  currentRef.current = current;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const startedAtRef = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState(0);
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [gradeMsg, setGradeMsg] = useState("Submitting…");
  const [showHelp, setShowHelp] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const showSubmitConfirmRef = useRef(false);
  showSubmitConfirmRef.current = showSubmitConfirm;
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const questionsRef = useRef<Q[]>([]);
  questionsRef.current = questions;

  useEffect(() => {
    if (allowed !== true) return;
    (async () => {
      try {
        const { test, questions: qs } = await getFn({ data: { id: testId } });
        setTest(test as Test);
        setQuestions(qs as Q[]);
        const seed: Record<string, string> = {};
        for (const q of qs as Q[]) seed[q.id] = q.type === "code" ? q.starter_code : "";
        setAnswers(seed);

        const existing = getTestStartedAt(testId);
        const persisted = existing ?? Date.now();
        if (!existing) markTestStarted(testId, persisted);
        startedAtRef.current = persisted;
        const elapsed = Math.max(0, Math.floor((Date.now() - persisted) / 1000));
        setRemaining(Math.max(0, (test as Test).duration_sec - elapsed));

        void pykoStart({
          data: {
            assessmentId: `ai:${testId}`,
            type: "ai",
            durationMinutes: Math.max(1, Math.ceil((test as Test).duration_sec / 60) + 5),
          },
        }).catch(() => { /* non-blocking */ });
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
    return () => {
      void pykoEnd({ data: { assessmentId: `ai:${testId}`, reason: "abandoned" } }).catch(() => { /* noop */ });
    };
  }, [getFn, testId, allowed, pykoStart, pykoEnd]);

  const submit = useCallback(
    async (submission_type: "normal" | "auto-violation" = "normal", violation_reason?: string) => {
      if (submittedRef.current || !test) return;
      submittedRef.current = true;
      setSubmitting(true);
      setGradeMsg(submission_type === "auto-violation" ? "Auto-submitting & grading…" : "Grading your test…");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

      const graded: Array<{
        question_id: string;
        response: string;
        runs?: Array<{ stdin: string; stdout: string; stderr: string; ok: boolean }>;
      }> = [];
      const currentAnswers = answersRef.current;
      const qs = questionsRef.current;
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        const response = currentAnswers[q.id] ?? "";
        setGradeMsg(`Grading Q${i + 1} of ${qs.length}…`);
        if (q.type === "code") {
          const runs: Array<{ stdin: string; stdout: string; stderr: string; ok: boolean }> = [];
          for (const tc of q.code_tests) {
            // eslint-disable-next-line no-await-in-loop
            const r = await runPython(response || q.starter_code, tc.stdin ?? "", { timeoutMs: 5000 });
            runs.push({
              stdin: tc.stdin ?? "",
              stdout: r.stdout ?? "",
              stderr: r.stderr ?? "",
              ok: !!r.ok,
            });
          }
          graded.push({ question_id: q.id, response, runs });
        } else {
          graded.push({ question_id: q.id, response });
        }
      }
      const timeTaken = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      try {
        const res = await submitFn({
          data: {
            test_id: testId,
            submission_type,
            violation_reason,
            time_taken_sec: timeTaken,
            answers: graded,
          },
        });
        void recordStreakActivity("mock_test_attempted", testId);
        void syncMyScore();
        void pykoEnd({ data: { assessmentId: `ai:${testId}`, reason: "completed" } }).catch(() => { /* noop */ });
        sessionStorage.setItem(`pykidda:ai-mock-result:${res.attempt_id}`, JSON.stringify(res));
        clearTestStarted(testId);
        navigate({ to: "/mock-tests/ai/$testId/result", params: { testId }, search: { attempt: res.attempt_id } });
      } catch (e) {
        alert("Submit failed: " + (e as Error).message);
        submittedRef.current = false;
        setSubmitting(false);
      }
    },
    [navigate, submitFn, testId, test, pykoEnd],
  );

  // Timer
  useEffect(() => {
    if (!test || allowed !== true) return;
    let timeoutId: number | undefined;
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      const rem = Math.max(0, test.duration_sec - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        void submit("normal");
        return;
      }
      const msUntilNext = 1000 - ((Date.now() - startedAtRef.current) % 1000);
      timeoutId = window.setTimeout(tick, Math.max(100, msUntilNext));
    };
    tick();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [test, allowed, submit]);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  useEffect(() => {
    if (allowed === true) focusEditor();
  }, [current, allowed, focusEditor]);

  // Anti-cheat + keyboard-only
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

    const goPrev = () => {
      setCurrent((i) => Math.max(0, i - 1));
    };
    const goNext = () => {
      setCurrent((i) => Math.min(questionsRef.current.length - 1, i + 1));
    };
    const resetCurrent = () => {
      const q = questionsRef.current[currentRef.current];
      if (!q) return;
      setAnswers((a) => ({ ...a, [q.id]: q.type === "code" ? q.starter_code : "" }));
      focusEditor();
    };
    const pickOption = (idx: number) => {
      const q = questionsRef.current[currentRef.current];
      if (!q) return;
      if (q.type === "mcq" && q.options[idx]) {
        setAnswers((a) => ({ ...a, [q.id]: q.options[idx] }));
      } else if (q.type === "tf") {
        const v = idx === 0 ? "True" : idx === 1 ? "False" : null;
        if (v) setAnswers((a) => ({ ...a, [q.id]: v }));
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!testActiveRef.current || submittedRef.current) return;
      const lower = e.key.toLowerCase();

      // Screenshot / snip combos
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        try { navigator.clipboard?.writeText(""); } catch { /* ignore */ }
        const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Win/Cmd"].filter(Boolean).join("+");
        autoSubmit(`Auto-submitted: screenshot attempt (${mods ? mods + "+" : ""}PrintScreen key)`);
        return;
      }
      if (e.shiftKey && (e.metaKey || e.getModifierState?.("Meta")) && lower === "s") {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (Windows Snipping Tool — Win+Shift+S)");
        return;
      }
      if ((e.metaKey || e.getModifierState?.("Meta")) && lower === "g") {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (Windows Game Bar — Win+G)");
        return;
      }
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit(`Auto-submitted: screenshot attempt (macOS Cmd+Shift+${e.key})`);
        return;
      }
      if (e.metaKey && e.ctrlKey && e.shiftKey && ["3", "4"].includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit(`Auto-submitted: screenshot attempt (macOS Cmd+Ctrl+Shift+${e.key})`);
        return;
      }
      if (e.ctrlKey && (e.key === "F5" || (e.shiftKey && e.key === "F5"))) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: screenshot attempt (ChromeOS Ctrl+Show-Windows)");
        return;
      }
      if (e.key === "Meta" || e.key === "OS" || e.code === "MetaLeft" || e.code === "MetaRight") {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: Windows/Command key pressed");
        return;
      }
      if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu" || e.code === "ContextMenu") {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: context-menu key combination");
        return;
      }
      if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && lower === "r") || ((e.ctrlKey || e.metaKey) && e.key === "F5")) {
        e.preventDefault(); e.stopPropagation();
        try { sessionStorage.setItem(`pykidda:violation:${testId}`, "reload-attempt"); } catch { /* ignore */ }
        autoSubmit("Auto-submitted: page reload attempt");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (["t", "n", "w"].includes(lower) || (e.shiftKey && lower === "t") || e.key === "Tab" || e.key === "PageUp" || e.key === "PageDown")) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit(`Auto-submitted: browser tab/window shortcut (${e.key})`);
        return;
      }
      if (e.altKey && (e.key === "F4" || e.key === " " || e.code === "Space")) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: window-close shortcut");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "p", "u"].includes(lower)) {
        e.preventDefault(); e.stopPropagation();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && lower === "s" && !e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation();
        return;
      }
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(lower))) {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: developer tools shortcut detected");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        autoSubmit("Auto-submitted: Escape key pressed");
        return;
      }
      if (showSubmitConfirmRef.current && e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        setShowSubmitConfirm(false);
        showSubmitConfirmRef.current = false;
        void submit("normal");
        return;
      }
      if (showSubmitConfirmRef.current && e.altKey && lower === "b") {
        e.preventDefault();
        setShowSubmitConfirm(false);
        showSubmitConfirmRef.current = false;
        return;
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        void submit("normal");
        return;
      }
      // Arrow keys for prev/next — ignore when typing in editor/input/textarea
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        const isEditable = !!t && (t === editorRef.current || tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          if (e.key === "ArrowLeft") goPrev(); else goNext();
          return;
        }
      }
      if (e.altKey) {
        const k = lower;
        if (k === "p") { e.preventDefault(); goPrev(); return; }
        if (k === "n") { e.preventDefault(); goNext(); return; }
        if (k === "r") { e.preventDefault(); resetCurrent(); return; }
        if (k === "s") { e.preventDefault(); setShowSubmitConfirm(true); showSubmitConfirmRef.current = true; return; }
        if (k === "e") { e.preventDefault(); focusEditor(); return; }
        if (k === "h") { e.preventDefault(); setShowHelp((v) => !v); return; }
        if (k === "1") { e.preventDefault(); pickOption(0); return; }
        if (k === "2") { e.preventDefault(); pickOption(1); return; }
        if (k === "3") { e.preventDefault(); pickOption(2); return; }
        if (k === "4") { e.preventDefault(); pickOption(3); return; }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!testActiveRef.current || submittedRef.current) return;
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        e.preventDefault(); e.stopPropagation();
        try { navigator.clipboard?.writeText(""); } catch { /* ignore */ }
        autoSubmit("Auto-submitted: PrintScreen key (captured on release)");
      }
    };

    const onContextMenu = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };

    const blockedMouse = [
      "click", "dblclick", "mousedown", "mouseup", "mousemove",
      "pointerdown", "pointerup", "pointermove", "contextmenu",
      "dragstart", "dragover", "dragend", "drop", "selectstart",
      "auxclick", "touchstart", "touchend", "touchmove",
      "gesturestart", "gesturechange", "gestureend",
    ];
    const blockMouse = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t === editorRef.current) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("drop", onDrop, true);
    for (const ev of blockedMouse) document.addEventListener(ev, blockMouse, true);
    document.body.classList.add("secure-test-printing-blocked");
    document.body.classList.add("secure-keyboard-test");

    return () => {
      testActiveRef.current = false;
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("drop", onDrop, true);
      for (const ev of blockedMouse) document.removeEventListener(ev, blockMouse, true);
      document.body.classList.remove("secure-test-printing-blocked");
      document.body.classList.remove("secure-keyboard-test");
    };
  }, [test, allowed, submit, focusEditor, testId]);

  const q = useMemo(() => questions[current], [questions, current]);

  if (allowed === false) {
    return <Navigate to="/mock-tests/ai/$testId/warning" params={{ testId }} />;
  }
  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      </div>
    );
  }
  if (!test || !q) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading test…</div>;
  }

  return (
    <div className="secure-keyboard-test min-h-screen bg-background text-foreground">
      <style dangerouslySetInnerHTML={{ __html: SECURE_CSS }} />

      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{test.title}</p>
          <p className="text-sm font-semibold">
            Q{current + 1} of {questions.length} · {q.marks} marks · Keyboard-only mode
          </p>
        </div>
        <div className={`font-mono text-xl font-bold tabular-nums ${remaining < 60 ? "text-destructive" : ""}`}>
          ⏱ {fmt(remaining)}
        </div>
        <button
          className="submit-button rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-60"
          title="Use Alt+S then Ctrl+Enter"
        >
          Submit (Alt+S)
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="question-nav flex flex-wrap gap-1 mb-4">
          {questions.map((qq, i) => {
            const ans = answers[qq.id];
            const filled = qq.type === "code" ? ans && ans.trim() !== qq.starter_code.trim() : !!ans;
            return (
              <span
                key={qq.id}
                className={`w-9 h-9 flex items-center justify-center rounded text-xs font-semibold ${
                  i === current
                    ? "bg-accent text-accent-foreground"
                    : filled
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-accent font-semibold">
            {q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / False" : q.type === "fill" ? "Fill in the blank" : q.type === "short" ? "Short answer" : "Coding"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base">{q.prompt}</p>

          {q.type === "mcq" && (
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    type="button"
                    key={oi}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                      selected
                        ? "border-accent bg-accent/20 ring-2 ring-accent shadow-sm"
                        : "border-border hover:border-accent/60 hover:bg-accent/5"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                        selected
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border"
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className={`flex-1 ${selected ? "font-semibold text-foreground" : ""}`}>{opt}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">Alt+{oi + 1}</span>
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "tf" && (
            <div className="mt-4 flex gap-3">
              {(["True", "False"] as const).map((v, oi) => {
                const selected = answers[q.id] === v;
                return (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    aria-pressed={selected}
                    className={`flex-1 rounded-md border p-4 text-center font-semibold transition ${
                      selected
                        ? "border-accent bg-accent/20 ring-2 ring-accent shadow-sm text-foreground"
                        : "border-border hover:border-accent/60 hover:bg-accent/5"
                    }`}
                  >
                    {v}
                    <span className="ml-2 text-[10px] font-mono text-muted-foreground">Alt+{oi + 1}</span>
                  </button>
                );
              })}
            </div>
          )}


          {(q.type === "fill" || q.type === "short" || q.type === "code") && (
            <div className="answer-editor mt-4">
              {q.type === "code" ? (
                <PythonCodeEditor
                  ref={editorRef}
                  value={answers[q.id] ?? q.starter_code ?? ""}
                  onChange={(v: string) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  rows={14}
                  className="rounded-md border border-border bg-[oklch(0.15_0.02_250)]"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Tab" && e.shiftKey) {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      const val = el.value;
                      const before = val.slice(0, start);
                      const lineStart = before.lastIndexOf("\n") + 1;
                      if (val.slice(lineStart, lineStart + 4) === "    ") {
                        const newVal = val.slice(0, lineStart) + val.slice(lineStart + 4);
                        setAnswers((a) => ({ ...a, [q.id]: newVal }));
                        requestAnimationFrame(() => {
                          el.selectionStart = Math.max(lineStart, start - 4);
                          el.selectionEnd = Math.max(lineStart, end - 4);
                        });
                      }
                    }
                  }}
                />
              ) : (
                <textarea
                  ref={editorRef}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={q.type === "short" ? 5 : 2}
                  spellCheck={false}
                  className="w-full rounded-md border border-border bg-background p-3 text-sm"
                  placeholder="Type your answer…"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <Kbd>←</Kbd>/<Kbd>Alt</Kbd>+<Kbd>P</Kbd> Prev · <Kbd>→</Kbd>/<Kbd>Alt</Kbd>+<Kbd>N</Kbd> Next · <Kbd>Alt</Kbd>+<Kbd>E</Kbd> Focus answer
          </span>
          <span>
            <Kbd>Alt</Kbd>+<Kbd>S</Kbd> then <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to submit
          </span>
        </div>

        {showHelp && (
          <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4 text-xs text-foreground/80">
            <p className="font-semibold text-accent uppercase tracking-widest">Reminders</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Mouse is disabled — only keyboard works.</li>
              <li>Exiting fullscreen, switching tabs, or reloading auto-submits your test.</li>
              <li>Press <Kbd>Alt</Kbd>+<Kbd>H</Kbd> to hide/show this panel.</li>
            </ul>
          </div>
        )}
      </div>

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-40 bg-background/85 flex items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
            <p className="text-xs uppercase tracking-widest text-accent font-bold">Confirm submit</p>
            <h2 className="mt-2 text-xl font-bold">Submit test now?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Once submitted you cannot change your answers.
            </p>
            <p className="mt-4 text-sm">
              Press <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to confirm submit.
            </p>
            <p className="mt-2 text-sm">
              Changed your mind? Press <Kbd>Alt</Kbd>+<Kbd>B</Kbd> to go back and resume the test.
            </p>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl animate-pulse">🐍</div>
            <p className="mt-3 font-semibold">{gradeMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

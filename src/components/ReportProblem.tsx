import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/auth-cache";
import { AlertTriangle, Bug, Loader2, Send, X } from "lucide-react";

const PROBLEM_TYPES = [
  "Bug / Technical Issue",
  "Wrong Question",
  "Wrong Answer",
  "Coding Editor Issue",
  "Mock Test Issue",
  "Login / Account Issue",
  "Result / Marks Issue",
  "UI / Display Issue",
  "Other",
] as const;

const SECTIONS = [
  "Dashboard",
  "Practice",
  "Mock Test",
  "Coding Practice",
  "Result Page",
  "Profile",
  "Login / Signup",
  "Other",
] as const;

function inferSectionFromPath(path: string): (typeof SECTIONS)[number] {
  if (path.startsWith("/practice")) return "Practice";
  if (path.includes("/mock-tests") && path.endsWith("/result")) return "Result Page";
  if (path.includes("/mock-tests")) return "Mock Test";
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/auth") || path.startsWith("/onboarding")) return "Login / Signup";
  if (path === "/" || path.startsWith("/analytics") || path.startsWith("/leaderboard")) return "Dashboard";
  return "Other";
}

function extractRefs(path: string) {
  const out: { question_id?: string; test_id?: string } = {};
  const practice = path.match(/\/practice\/([^/?#]+)/);
  if (practice) out.question_id = decodeURIComponent(practice[1]);
  const mock = path.match(/\/mock-tests\/([^/?#]+)/);
  if (mock) out.test_id = decodeURIComponent(mock[1]);
  return out;
}

export function ReportProblem() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [rollNumber] = useState<string>("");

  // form
  const refs = useMemo(() => extractRefs(pathname), [pathname]);
  const [problemType, setProblemType] = useState<string>("Bug / Technical Issue");
  const [section, setSection] = useState<string>(inferSectionFromPath(pathname));
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority] = useState<string>("Medium");
  const [questionId, setQuestionId] = useState(refs.question_id ?? "");
  const [testId, setTestId] = useState(refs.test_id ?? "");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getCachedUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserId(u.id);
      setEmail(u.email ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", u.id)
        .maybeSingle();
      setDisplayName(p?.display_name || p?.full_name || u.email?.split("@")[0] || "");
    });
  }, []);

  // Allow other parts of the app to open the modal via a custom event.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-report-problem", handler);
    return () => window.removeEventListener("open-report-problem", handler);
  }, []);

  // Re-sync auto-fill when route changes and modal is closed
  useEffect(() => {
    if (open) return;
    setSection(inferSectionFromPath(pathname));
    const r = extractRefs(pathname);
    setQuestionId(r.question_id ?? "");
    setTestId(r.test_id ?? "");
  }, [pathname, open]);

  // Hide on active mock test run route to avoid breaking secure mode.
  const hideButton =
    /\/mock-tests\/[^/]+\/run$/.test(pathname) ||
    /\/mock-tests\/[^/]+\/warning$/.test(pathname) ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding");

  const reset = () => {
    setSubject("");
    setDescription("");
    setProblemType("Bug / Technical Issue");
    setScreenshot(null);
    if (fileRef.current) fileRef.current.value = "";
    setOkMsg(null);
    setErrMsg(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErrMsg(null);
    setOkMsg(null);
    if (!userId) {
      setErrMsg("You need to be signed in to report a problem.");
      return;
    }
    const s = subject.trim();
    const d = description.trim();
    if (!s || s.length > 140) return setErrMsg("Subject is required (max 140 chars).");
    if (!d || d.length > 3000) return setErrMsg("Description is required (max 3000 chars).");

    setSubmitting(true);
    try {
      let screenshot_url: string | null = null;
      if (screenshot) {
        if (screenshot.size > 5 * 1024 * 1024) throw new Error("Screenshot must be ≤ 5 MB.");
        const ext = (screenshot.name.split(".").pop() || "png").toLowerCase();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("report-screenshots")
          .upload(path, screenshot, { contentType: screenshot.type || "image/png" });
        if (upErr) throw upErr;
        screenshot_url = path;
      }

      const payload = {
        user_id: userId,
        student_name: displayName || null,
        student_email: email,
        roll_number: rollNumber || null,
        problem_type: problemType,
        related_section: section,
        subject: s,
        description: d,
        priority,
        question_id: questionId || null,
        test_id: testId || null,
        page_url: typeof window !== "undefined" ? window.location.href : null,
        browser_info: typeof navigator !== "undefined" ? navigator.userAgent : null,
        screenshot_url,
        status: "Open",
      };

      const { error } = await supabase.from("problem_reports").insert(payload);
      if (error) throw error;
      setOkMsg("Your report has been submitted successfully. Admin will review it soon.");
      reset();
      setTimeout(() => {
        setOpen(false);
        setOkMsg(null);
      }, 1800);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (hideButton) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a problem"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-24 right-4 sm:bottom-5 sm:right-5 z-40 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(234,88,12,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-transform motion-safe:hover:scale-105 motion-safe:active:scale-95"
        style={{
          backgroundImage: "linear-gradient(135deg,#f59e0b 0%,#ea580c 50%,#dc2626 100%)",
        }}
      >
        <Bug className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Report a problem</span>
      </button>

      {open && (
        <ReportDialog
          onClose={() => setOpen(false)}
          onSubmit={submit}
          state={{
            problemType, setProblemType,
            section, setSection,
            subject, setSubject,
            description, setDescription,
            screenshot, setScreenshot,
            fileRef,
            submitting,
            okMsg,
            errMsg,
          }}
        />
      )}
    </>
  );
}

type DialogState = {
  problemType: string; setProblemType: (v: string) => void;
  section: string; setSection: (v: string) => void;
  subject: string; setSubject: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  screenshot: File | null; setScreenshot: (f: File | null) => void;
  fileRef: React.MutableRefObject<HTMLInputElement | null>;
  submitting: boolean;
  okMsg: string | null;
  errMsg: string | null;
};

function ReportDialog({
  onClose,
  onSubmit,
  state,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  state: DialogState;
}) {
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-problem-title"
        className="relative w-full sm:max-w-2xl max-h-[92dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
      >
        <div
          className="px-6 py-4 text-white shrink-0"
          style={{
            backgroundImage:
              "linear-gradient(135deg,#0b1a3a 0%,#0f3460 55%,#0891b2 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-400/20 p-2 ring-1 ring-yellow-300/40" aria-hidden>
                <AlertTriangle className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <h2 id="report-problem-title" className="text-lg font-bold">Report a problem</h2>
                <p className="text-xs text-white/70">
                  Help us fix bugs, wrong questions, or anything not working.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 min-h-11 min-w-11 text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Close report dialog"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">
                Problem type <span aria-hidden className="text-destructive">*</span>
              </span>
              <select
                ref={firstFieldRef}
                value={state.problemType}
                onChange={(e) => state.setProblemType(e.target.value)}
                required
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {PROBLEM_TYPES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Related section</span>
              <select
                value={state.section}
                onChange={(e) => state.setSection(e.target.value)}
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {SECTIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm block">
            <span className="mb-1 block font-semibold">
              Subject <span aria-hidden className="text-destructive">*</span>
            </span>
            <input
              value={state.subject}
              onChange={(e) => state.setSubject(e.target.value)}
              maxLength={140}
              required
              placeholder="Short summary of the issue"
              className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>

          <label className="text-sm block">
            <span className="mb-1 block font-semibold">
              Description <span aria-hidden className="text-destructive">*</span>
            </span>
            <textarea
              value={state.description}
              onChange={(e) => state.setDescription(e.target.value)}
              maxLength={3000}
              rows={5}
              required
              placeholder="What went wrong? Steps to reproduce, expected vs actual, etc."
              className="w-full rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background break-words"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
              {state.description.length}/3000
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Screenshot (optional, ≤5 MB)</span>
              <input
                ref={state.fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => state.setScreenshot(e.target.files?.[0] ?? null)}
                aria-describedby="report-file-help"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              {state.screenshot && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                  <span className="truncate" title={state.screenshot.name}>{state.screenshot.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      state.setScreenshot(null);
                      if (state.fileRef.current) state.fileRef.current.value = "";
                    }}
                    className="shrink-0 rounded px-2 py-0.5 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${state.screenshot.name}`}
                  >
                    Remove
                  </button>
                </div>
              )}
            </label>
          </div>

          <div id="report-file-help" className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
            Auto-captured: your name, email, page URL, browser, and current date/time.
          </div>

          {state.errMsg && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.errMsg}
            </p>
          )}
          {state.okMsg && (
            <p role="status" aria-live="polite" className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {state.okMsg}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={state.submitting}
              className="min-h-11 rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ backgroundImage: "linear-gradient(135deg,#f59e0b,#ea580c)" }}
            >
              {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {state.submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Helper for admin/profile pages to turn a stored path into a signed URL. */
export async function getScreenshotSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("report-screenshots")
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

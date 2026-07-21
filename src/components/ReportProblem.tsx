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

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

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
  const [rollNumber, setRollNumber] = useState<string>("");

  // form
  const refs = useMemo(() => extractRefs(pathname), [pathname]);
  const [problemType, setProblemType] = useState<string>("Bug / Technical Issue");
  const [section, setSection] = useState<string>(inferSectionFromPath(pathname));
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("Medium");
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
    setPriority("Medium");
    setProblemType("Bug / Technical Issue");
    setScreenshot(null);
    if (fileRef.current) fileRef.current.value = "";
    setOkMsg(null);
    setErrMsg(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        screenshot_url = path; // store path; signed URL generated on view
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
        onClick={() => setOpen(true)}
        title="Report a problem"
        aria-label="Report a problem"
        className="fixed bottom-5 right-5 z-40 group flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(234,88,12,.6)] transition-transform hover:scale-105 active:scale-95"
        style={{
          backgroundImage: "linear-gradient(135deg,#f59e0b 0%,#ea580c 50%,#dc2626 100%)",
        }}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
          <Bug className="relative h-4 w-4" />
        </span>
        <span className="hidden sm:inline">Report a problem</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div
              className="px-6 py-4 text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg,#0b1a3a 0%,#0f3460 55%,#0891b2 100%)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-400/20 p-2 ring-1 ring-yellow-300/40">
                    <AlertTriangle className="h-5 w-5 text-yellow-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Report a problem</h2>
                    <p className="text-xs text-white/70">
                      Help us fix bugs, wrong questions, or anything not working.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Problem type *</span>
                  <select
                    value={problemType}
                    onChange={(e) => setProblemType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    {PROBLEM_TYPES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Related section</span>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    {SECTIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm block">
                <span className="mb-1 block font-semibold">Subject *</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={140}
                  placeholder="Short summary of the issue"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>

              <label className="text-sm block">
                <span className="mb-1 block font-semibold">Description *</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={3000}
                  rows={5}
                  placeholder="What went wrong? Steps to reproduce, expected vs actual, etc."
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
                <span className="mt-1 block text-right text-[11px] text-muted-foreground">
                  {description.length}/3000
                </span>
              </label>


              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-semibold">Screenshot (optional, ≤5 MB)</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1"
                  />
                </label>
              </div>

              <div className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
                Auto-captured: your name, email, page URL, browser, and current date/time.
              </div>

              {errMsg && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errMsg}</p>
              )}
              {okMsg && (
                <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                  {okMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
                  style={{ backgroundImage: "linear-gradient(135deg,#f59e0b,#ea580c)" }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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

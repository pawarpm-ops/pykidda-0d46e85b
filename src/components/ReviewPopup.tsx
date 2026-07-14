import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/auth-cache";
import { Loader2, Sparkles, Star, X } from "lucide-react";

const STORAGE_KEY = "pykidda.review.prefs.v1";
const DWELL_MS = 3 * 60 * 1000; // 3 minutes on safe pages
const MAYBE_LATER_MS = 24 * 60 * 60 * 1000;
const SUBMITTED_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const BLOCKED_PATTERNS = [
  "/mock-tests/",
  "/mock-test",
  "/practice/",
  "/coding",
  "/secure-test",
  "/exam",
  "/onboarding",
  "/auth",
];

const CATEGORIES = [
  "Website Experience",
  "Python Practice",
  "Mock Test",
  "Coding Editor",
  "UI/Design",
  "Performance",
  "Question Quality",
  "Other",
] as const;

const REACTIONS = [
  { label: "Loved It", emoji: "😍" },
  { label: "Excellent", emoji: "🌟" },
  { label: "Good", emoji: "👍" },
  { label: "Needs Improvement", emoji: "🛠️" },
  { label: "Difficult to Use", emoji: "😵" },
  { label: "Found a Bug", emoji: "🐛" },
] as const;

type Prefs = {
  neverShow?: boolean;
  lastShownAt?: number;
  lastSubmittedAt?: number;
  maybeLaterUntil?: number;
};

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function isBlockedPath(path: string) {
  return BLOCKED_PATTERNS.some((p) => path.includes(p));
}

export function ReviewPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>("Website Experience");
  const [reaction, setReaction] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dwellRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    getCachedUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const blocked = useMemo(() => isBlockedPath(pathname), [pathname]);

  // Dwell timer: accrues only on safe pages, not blocked ones.
  useEffect(() => {
    if (!userId || open || submitted) return;
    const prefs = loadPrefs();
    if (prefs.neverShow) return;
    if (prefs.lastSubmittedAt && Date.now() - prefs.lastSubmittedAt < SUBMITTED_COOLDOWN_MS) return;
    if (prefs.maybeLaterUntil && Date.now() < prefs.maybeLaterUntil) return;
    if (prefs.lastShownAt && Date.now() - prefs.lastShownAt < 24 * 60 * 60 * 1000) return;
    if (blocked) return;
    if (document.fullscreenElement) return;

    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      if (document.fullscreenElement) return;
      dwellRef.current += 1000;
      if (dwellRef.current >= DWELL_MS - (start - start)) {
        setOpen(true);
        if (timerRef.current) window.clearInterval(timerRef.current);
      }
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [userId, blocked, open, submitted]);

  // If user navigates into a blocked page while open, hide it.
  useEffect(() => {
    if (open && blocked) setOpen(false);
  }, [blocked, open]);

  function handleMaybeLater() {
    const p = loadPrefs();
    p.maybeLaterUntil = Date.now() + MAYBE_LATER_MS;
    p.lastShownAt = Date.now();
    savePrefs(p);
    setOpen(false);
  }
  function handleNever() {
    const p = loadPrefs();
    p.neverShow = true;
    savePrefs(p);
    setOpen(false);
  }
  function handleClose() {
    const p = loadPrefs();
    p.lastShownAt = Date.now();
    savePrefs(p);
    setOpen(false);
  }

  async function handleSubmit() {
    if (!userId) return;
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, display_name, contact_number")
        .eq("id", userId)
        .maybeSingle();
      const student_name = profile?.full_name || profile?.display_name || userEmail?.split("@")[0] || "Student";
      const { error: err } = await supabase.from("user_reviews").insert({
        user_id: userId,
        student_name,
        student_email: userEmail,
        roll_number: profile?.contact_number ?? null,
        rating,
        review_text: text.trim() || null,
        category,
        quick_reaction: reaction || null,
        page_url: typeof window !== "undefined" ? window.location.pathname : null,
        device_info: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        status: "unread",
      });
      if (err) throw err;
      const p = loadPrefs();
      p.lastSubmittedAt = Date.now();
      p.lastShownAt = Date.now();
      savePrefs(p);
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setRating(0);
        setText("");
        setReaction("");
      }, 3200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || blocked || !userId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6 animate-fade-in"
      style={{ background: "radial-gradient(circle at center, rgba(3,7,18,0.72), rgba(3,7,18,0.9))" }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-cyan-400/30 bg-slate-950/95 shadow-[0_25px_80px_-20px_rgba(34,211,238,0.35)] overflow-visible animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {submitted && <Confetti />}

        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="rounded-t-3xl bg-gradient-to-br from-cyan-500/20 via-teal-500/10 to-amber-400/20 px-6 pt-8 pb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
            Hey coder! How is your <span className="text-amber-300">Py Kidda Hub</span> experience?
          </h2>
          <p className="mt-1.5 text-sm text-cyan-100/80">
            I'm Pyko, your Python guide. Share your review so we can improve your learning.
          </p>
        </div>

        {submitted ? (
          <ThankYou />
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Stars */}
            <div>
              <label className="text-xs uppercase tracking-widest text-cyan-200/80 font-semibold">
                Your rating <span className="text-amber-300">*</span>
              </label>
              <div className="mt-2 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = n <= (hoverRating || rating);
                  return (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="transition-transform duration-200 hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`h-9 w-9 transition ${
                          active
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                            : "text-white/30"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              {rating > 0 && rating <= 2 && (
                <p className="mt-2 text-xs text-amber-200/90">
                  Sorry to hear that. Can you tell us what went wrong?
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="text-xs uppercase tracking-widest text-cyan-200/80 font-semibold">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Reactions */}
            <div>
              <label className="text-xs uppercase tracking-widest text-cyan-200/80 font-semibold">
                Quick reaction (optional)
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REACTIONS.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setReaction(reaction === r.label ? "" : r.label)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      reaction === r.label
                        ? "bg-amber-400 text-slate-900 border-amber-300 font-semibold"
                        : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <span className="mr-1">{r.emoji}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="text-xs uppercase tracking-widest text-cyan-200/80 font-semibold">
                Your review
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={1200}
                placeholder="Write your experience, suggestion, or feedback here…"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/20 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Submit review
              </button>
              <button
                onClick={handleMaybeLater}
                disabled={submitting}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Maybe later
              </button>
              <button
                onClick={handleNever}
                disabled={submitting}
                className="rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white/80 transition"
              >
                Don't show again
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pyko-orbit {
          0%   { transform: rotate(0deg)   translateX(230px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(230px) rotate(-360deg); }
        }
        @keyframes pyko-bounce {
          0%,100% { transform: translateY(0) rotate(-8deg); }
          50%     { transform: translateY(-10px) rotate(6deg); }
        }
        @keyframes pyko-blink {
          0%,92%,100% { transform: scaleY(1); }
          95%         { transform: scaleY(0.1); }
        }
        @keyframes pyko-celebrate {
          0%,100% { transform: translateY(0) rotate(0); }
          25%     { transform: translateY(-18px) rotate(-15deg); }
          75%     { transform: translateY(-10px) rotate(15deg); }
        }
        @keyframes confetti-fall {
          0%   { transform: translateY(-10px) rotate(0); opacity: 1; }
          100% { transform: translateY(220px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}


function Confetti() {
  const bits = Array.from({ length: 24 });
  const colors = ["#22d3ee", "#fbbf24", "#f97316", "#10b981", "#ffffff", "#a78bfa"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {bits.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-2 rounded-sm"
          style={{
            left: `${(i / bits.length) * 100}%`,
            background: colors[i % colors.length],
            animation: `confetti-fall ${1.5 + (i % 5) * 0.3}s ease-in ${(i % 6) * 0.1}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function ThankYou() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-5xl mb-3 animate-bounce">🎉</div>
      <h3 className="text-xl font-bold text-white">Thank you!</h3>
      <p className="mt-1.5 text-sm text-cyan-100/80">
        Your review helps us improve Py Kidda Hub. Keep coding! 🐍✨
      </p>
    </div>
  );
}

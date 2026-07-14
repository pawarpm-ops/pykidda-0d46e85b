import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
  ssr: false,
});

type FormState = {
  full_name: string;
  contact_number: string;
  birth_date: string;
  age: string;
  about_you: string;
};

const ABOUT_MAX = 400;

const stepSchemas = [
  z.string().trim().min(2, "Please enter your full name").max(80, "Keep it under 80 characters"),
  z
    .string()
    .trim()
    .min(7, "Enter a valid contact number")
    .max(20, "Too long")
    .regex(/^[+\d][\d\s-]*$/, "Digits, spaces, + and - only"),
  z
    .string()
    .min(1, "Pick your birth date")
    .refine((v) => new Date(v) <= new Date(), "Birth date can't be in the future"),
  z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Enter a whole number")
    .min(5, "Age looks too low")
    .max(120, "Age looks too high"),
  z
    .string()
    .trim()
    .min(5, "Tell us a little more (at least 5 characters)")
    .max(ABOUT_MAX, `Keep it under ${ABOUT_MAX} characters`),
];

const questions = [
  { key: "full_name", title: "What is your full name?", mascot: "Hi! I'm Py, your guide. Let's start with your name." },
  { key: "contact_number", title: "What is your contact number?", mascot: "Nice to meet you! How can we reach you?" },
  { key: "birth_date", title: "What is your birthdate?", mascot: "When did the world get lucky to have you?" },
  { key: "age", title: "What is your age?", mascot: "And how many trips around the sun so far?" },
  { key: "about_you", title: "Tell us something about yourself.", mascot: "Last one — I'd love to know a bit about you!" },
] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const [form, setForm] = useState<FormState>({
    full_name: "",
    contact_number: "",
    birth_date: "",
    age: "",
    about_you: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("onboarded, full_name, contact_number, age, birth_date, bio")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p?.onboarded) {
        navigate({ to: "/", replace: true });
        return;
      }
      if (p) {
        setForm({
          full_name: p.full_name ?? "",
          contact_number: p.contact_number ?? "",
          birth_date: p.birth_date ?? "",
          age: p.age?.toString() ?? "",
          about_you: p.bio ?? "",
        });
      }
      setChecking(false);
    })();
  }, [navigate]);

  useEffect(() => {
    setFieldErr(null);
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [step, done]);

  function setKey<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErr(null);
  }

  const currentKey = questions[step]?.key;
  const currentValue = currentKey ? form[currentKey] : "";

  function validateStep(idx: number): string | null {
    const key = questions[idx].key;
    const parsed = stepSchemas[idx].safeParse(form[key]);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid value";
    return null;
  }

  async function next() {
    const err = validateStep(step);
    if (err) {
      setFieldErr(err);
      return;
    }
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      await save();
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function save() {
    if (!userId || saving) return;
    setSaveErr(null);
    setSaving(true);
    const age = Number(form.age);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: form.full_name.trim(),
        display_name: form.full_name.trim(),
        contact_number: form.contact_number.trim(),
        birth_date: form.birth_date,
        age,
        bio: form.about_you.trim(),
        onboarded: true,
      },
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) {
      setSaveErr(error.message);
      return;
    }
    setDone(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pykidda:onboarding-completed"));
    }
    setTimeout(() => navigate({ to: "/", replace: true }), 1800);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const progress = useMemo(() => ((step + (done ? 1 : 0)) / questions.length) * 100, [step, done]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1024] text-white/70 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1024] text-white">
      <BackgroundGlow />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 md:px-10">
        <div className="flex items-center gap-3 min-w-0">
          {step > 0 && !done && (
            <button
              type="button"
              onClick={back}
              aria-label="Go back"
              title="Go back"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-xs uppercase tracking-[0.3em] text-amber-300/90 font-semibold truncate">
            PY Kidda · Onboarding
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-white/60 tabular-nums">
            {done ? questions.length : step + 1} of {questions.length}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="text-xs text-white/50 hover:text-white underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mx-6 md:mx-10 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-10 pb-16 md:pt-16">
        <PyMascot speaking={!done} reacting={done} />

        {/* Speech bubble */}
        <div className="relative mt-4 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/85 shadow-lg backdrop-blur">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-white/[0.06]" />
          {done ? "You're all set! Welcome to PY Kidda Hub." : questions[step].mascot}
        </div>

        {!done && (
          <div key={step} className="mt-10 w-full animate-[fadeSlide_.35s_ease-out]">
            <h1 className="text-center text-2xl md:text-4xl font-bold tracking-tight text-white">
              {questions[step].title}
            </h1>

            <div className="mx-auto mt-8 w-full max-w-xl">
              <StepControl
                step={step}
                value={currentValue}
                onChange={(v) => setKey(questions[step].key, v)}
                onEnter={next}
                hasError={!!fieldErr}
                inputRef={inputRef}
              />
              {fieldErr && (
                <p className="mt-2 text-sm text-rose-300">{fieldErr}</p>
              )}
              {questions[step].key === "about_you" && (
                <p className="mt-2 text-right text-xs text-white/50 tabular-nums">
                  {form.about_you.length}/{ABOUT_MAX}
                </p>
              )}
            </div>

            {saveErr && (
              <div className="mx-auto mt-6 max-w-xl rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                Couldn't save: {saveErr}
              </div>
            )}

            <div className="mt-8 flex items-center justify-center">
              <button
                type="button"
                onClick={next}
                disabled={saving}
                className="rounded-full px-8 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.6)] disabled:opacity-60 transition hover:brightness-110"
                style={{ backgroundImage: "linear-gradient(135deg,#38bdf8,#818cf8)" }}
              >
                {saving
                  ? "Saving…"
                  : step === questions.length - 1
                  ? saveErr
                    ? "Retry"
                    : "Finish"
                  : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="mt-10 text-center animate-[fadeSlide_.4s_ease-out]">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">🎉 All set!</h1>
            <p className="mt-3 text-white/70">Redirecting you to your dashboard…</p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.02); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes tongue {
          0%, 80%, 100% { transform: scaleX(1); opacity: 1; }
          90% { transform: scaleX(1.4); opacity: 0.8; }
        }
        @keyframes celebrate {
          0% { transform: translateY(0) rotate(0); }
          25% { transform: translateY(-10px) rotate(-6deg); }
          50% { transform: translateY(0) rotate(0); }
          75% { transform: translateY(-8px) rotate(6deg); }
          100% { transform: translateY(0) rotate(0); }
        }
        .py-breathe { animation: breathe 3.6s ease-in-out infinite; transform-origin: center; }
        .py-sway { animation: sway 4.2s ease-in-out infinite; transform-origin: 50% 90%; }
        .py-blink { animation: blink 4.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .py-tongue { animation: tongue 3.2s ease-in-out infinite; transform-origin: left center; transform-box: fill-box; }
        .py-celebrate { animation: celebrate 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .py-breathe, .py-sway, .py-blink, .py-tongue, .py-celebrate,
          .animate-\\[fadeSlide_\\.35s_ease-out\\], .animate-\\[fadeSlide_\\.4s_ease-out\\] {
            animation: none !important;
          }
        }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.7); cursor: pointer; }
      `}</style>
    </div>
  );
}

function StepControl({
  step,
  value,
  onChange,
  onEnter,
  hasError,
  inputRef,
}: {
  step: number;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  hasError: boolean;
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  const base =
    "w-full rounded-2xl bg-transparent border px-5 py-4 text-lg text-white placeholder-white/35 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20";
  const border = hasError ? "border-rose-400/70" : "border-white/25 hover:border-white/40";
  const cls = `${base} ${border}`;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step !== 4) {
      e.preventDefault();
      onEnter();
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  switch (step) {
    case 0:
      return (
        <input
          ref={(el) => { inputRef.current = el; }}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          maxLength={80}
          placeholder="e.g. Siddharth Pawar"
          className={cls}
          autoComplete="name"
        />
      );
    case 1:
      return (
        <input
          ref={(el) => { inputRef.current = el; }}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          maxLength={20}
          placeholder="e.g. +91 91725 04205"
          className={cls}
          autoComplete="tel"
        />
      );
    case 2:
      return (
        <input
          ref={(el) => { inputRef.current = el; }}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          max={today}
          className={cls}
        />
      );
    case 3:
      return (
        <input
          ref={(el) => { inputRef.current = el; }}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          min={5}
          max={120}
          placeholder="e.g. 18"
          className={cls}
        />
      );
    case 4:
      return (
        <textarea
          ref={(el) => { inputRef.current = el; }}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, ABOUT_MAX))}
          rows={5}
          placeholder="A few sentences about your interests, goals, or what brought you to Python…"
          className={`${cls} resize-none min-h-[140px] text-base`}
        />
      );
    default:
      return null;
  }
}

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(56,189,248,0.25), transparent 45%), radial-gradient(circle at 85% 30%, rgba(129,140,248,0.22), transparent 50%), radial-gradient(circle at 50% 90%, rgba(236,72,153,0.18), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
    </>
  );
}

function PyMascot({ speaking, reacting }: { speaking: boolean; reacting: boolean }) {
  return (
    <div className={`relative h-40 w-40 md:h-48 md:w-48 ${reacting ? "py-celebrate" : "py-breathe"}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_20px_30px_rgba(56,189,248,0.35)]">
        <defs>
          <radialGradient id="pyBody" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
          <radialGradient id="pyBelly" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
          <radialGradient id="pyShine" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Body coil */}
        <g className="py-sway">
          <path
            d="M40 150 Q30 100 70 90 Q120 82 130 60 Q135 35 105 30 Q75 27 70 50"
            fill="none"
            stroke="url(#pyBody)"
            strokeWidth="26"
            strokeLinecap="round"
          />
          {/* Head */}
          <g>
            <ellipse cx="105" cy="60" rx="38" ry="32" fill="url(#pyBody)" />
            {/* Belly patch */}
            <ellipse cx="105" cy="72" rx="20" ry="14" fill="url(#pyBelly)" opacity="0.85" />
            {/* Shine */}
            <ellipse cx="90" cy="45" rx="14" ry="8" fill="url(#pyShine)" opacity="0.7" />

            {/* Eyes */}
            <g>
              <ellipse cx="92" cy="55" rx="7" ry="8" fill="white" />
              <ellipse cx="118" cy="55" rx="7" ry="8" fill="white" />
              <circle className="py-blink" cx="93" cy="56" r="3.4" fill="#0f172a" />
              <circle className="py-blink" cx="119" cy="56" r="3.4" fill="#0f172a" />
              <circle cx="94" cy="55" r="1.2" fill="white" />
              <circle cx="120" cy="55" r="1.2" fill="white" />
            </g>

            {/* Smile */}
            <path
              d="M96 72 Q105 80 116 72"
              stroke="#0f172a"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            {/* Tongue */}
            {speaking && (
              <path
                className="py-tongue"
                d="M108 78 Q116 84 122 80"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Cheeks */}
            <circle cx="82" cy="66" r="3.5" fill="#fb7185" opacity="0.6" />
            <circle cx="128" cy="66" r="3.5" fill="#fb7185" opacity="0.6" />
          </g>
        </g>

        {/* Ground shadow */}
        <ellipse cx="90" cy="178" rx="46" ry="6" fill="black" opacity="0.35" />
      </svg>
    </div>
  );
}

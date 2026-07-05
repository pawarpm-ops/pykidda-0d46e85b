import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · PY Kidda" },
      { name: "description", content: "Sign in with Google to practice Python on PY Kidda." },
    ],
  }),
  component: AuthPage,
  ssr: false,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function signInGoogle() {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        setError(result.error instanceof Error ? result.error.message : "Google login failed. Please try again.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Session already set by wrapper — AuthGate routes based on onboarding/role.
      navigate({ to: "/", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google login failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0b0720] text-white">
      {/* Animated gradient backdrop */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 700px at 10% 10%, #5b21b6 0%, transparent 60%), radial-gradient(900px 600px at 90% 80%, #7c3aed 0%, transparent 55%), radial-gradient(700px 500px at 50% 50%, #4338ca 0%, transparent 60%), linear-gradient(135deg, #1e0a3c 0%, #0b0720 100%)",
        }}
        aria-hidden
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[12%] left-[42%] h-24 w-24 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-2xl shadow-amber-500/40 animate-[float_7s_ease-in-out_infinite]" />
        <div className="absolute top-[22%] left-[55%] h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-2xl shadow-fuchsia-500/40 animate-[float_9s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-[18%] left-[8%] h-20 w-20 rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 shadow-2xl shadow-cyan-500/40 animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[30%] right-[12%] h-16 w-16 rounded-2xl rotate-12 bg-gradient-to-br from-pink-400 to-rose-600 shadow-2xl shadow-rose-500/40 animate-[float_10s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[60%] right-[28%] h-10 w-10 rounded-full bg-gradient-to-br from-emerald-300 to-teal-600 shadow-2xl shadow-emerald-500/40 animate-[float_6s_ease-in-out_infinite]" />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-22px) translateX(10px); }
        }
        @keyframes shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Left: branding / pitch */}
        <div className="hidden lg:flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <BrandLogo size={44} />
            <span className="text-lg font-bold tracking-wide">PY Kidda Hub</span>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1
              className="text-5xl xl:text-6xl font-black leading-[1.05] bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ffffff 0%, #fcd34d 50%, #c4b5fd 100%)",
                backgroundSize: "200% auto",
                animation: "shine 6s linear infinite",
              }}
            >
              Learn Python the fun, fearless way.
            </h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Practice problems, live mock tests, real-time analytics — all in one
              colorful hub built for curious coders.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Badge>⏱ Timed Mock Tests</Badge>
              <Badge>📊 Smart Analytics</Badge>
            </div>

          </div>

          <p className="text-xs text-white/50">
            Crafted by Siddharth Prashant Pawar
          </p>
        </div>

        {/* Right: auth card */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="relative w-full max-w-md">
            {/* Glow */}
            <div
              className="absolute -inset-1 rounded-3xl blur-2xl opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)",
              }}
              aria-hidden
            />

            <div className="relative rounded-3xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl p-8 sm:p-10 shadow-2xl">
              <div className="lg:hidden flex items-center gap-3 mb-6">
                <BrandLogo size={40} />
                <span className="font-bold">PY Kidda Hub</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Welcome back
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight">
                Sign in to your{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #fcd34d, #fb7185)",
                  }}
                >
                  coding journey
                </span>
              </h2>
              <p className="mt-2 text-sm text-white/70">
                One click with Google — we'll remember your progress, attempts and
                achievements.
              </p>

              <button
                onClick={signInGoogle}
                disabled={busy}
                className="group relative mt-7 w-full overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background:
                    "linear-gradient(90deg, #fde047 0%, #f59e0b 50%, #fb923c 100%)",
                  boxShadow: "0 10px 30px -10px rgba(245, 158, 11, 0.6)",
                }}
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-3">
                  <GoogleIcon />
                  {busy ? "Opening Google…" : "Continue with Google"}
                </span>
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                  }}
                />
              </button>

              {error && (
                <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/15 p-3 text-sm text-rose-100">
                  {error}
                </p>
              )}

              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-white/40">
                <div className="h-px flex-1 bg-white/15" />
                secure sign-in
                <div className="h-px flex-1 bg-white/15" />
              </div>

              <ul className="space-y-2 text-xs text-white/70">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">🔒</span>
                  We never see your Google password.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">🎯</span>
                  Auto-submit kicks in if you exit full-screen during a mock test.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✨</span>
                  Your progress syncs across all your devices.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium backdrop-blur">
      {children}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.61z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.8.54-1.83.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.71A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.17.29-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

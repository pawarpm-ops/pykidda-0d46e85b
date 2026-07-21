import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { logHealthEventClient } from "@/lib/system-health-client";

// Only allow same-origin relative paths as post-login destinations.
function safeNext(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · PY Kidda" },
      {
        name: "description",
        content: "Sign in with Google to practice Python on PY Kidda.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: safeNext(s.next),
  }),
  component: AuthPage,
  ssr: false,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        if (next && next !== "/") window.location.href = next;
        else navigate({ to: "/", replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      mounted = false;
    };
  }, [navigate, next]);

  async function signInGoogle() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const returnTo =
        window.location.origin +
        "/auth" +
        (next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: returnTo,
      });
      if (result.error) {
        const msg =
          result.error instanceof Error
            ? result.error.message
            : "Google login failed. Please try again.";
        setError(msg);
        void logHealthEventClient({
          category: "login",
          errorMessage: `Google OAuth failed: ${msg}`,
          moduleName: "auth",
          pageRoute: "/auth",
          severity: "high",
          errorDetails: { method: "google" },
        });
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      if (next && next !== "/") window.location.href = next;
      else navigate({ to: "/", replace: true });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Google login failed. Please try again.";
      setError(msg);
      void logHealthEventClient({
        category: "login",
        errorMessage: `Google OAuth threw: ${msg}`,
        moduleName: "auth",
        pageRoute: "/auth",
        severity: "high",
        errorDetails: { method: "google" },
      });
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh relative overflow-hidden bg-background text-foreground">
      {/* Ambient background — subtle, theme-aware, reduced-motion friendly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 dark:opacity-60"
        style={{
          background:
            "radial-gradient(900px 520px at 12% 8%, color-mix(in oklab, var(--accent) 28%, transparent) 0%, transparent 60%), radial-gradient(720px 480px at 90% 92%, color-mix(in oklab, var(--chart-5) 22%, transparent) 0%, transparent 60%), radial-gradient(600px 420px at 60% 40%, color-mix(in oklab, var(--chart-4) 18%, transparent) 0%, transparent 65%)",
        }}
      />
      {/* Fine grid — decorative, low contrast */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <header className="absolute top-3 right-3 z-20">
        <ThemeToggle />
      </header>

      <main className="relative z-10 min-h-dvh grid lg:grid-cols-2">
        {/* Left: brand pitch (desktop) */}
        <section className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <BrandLogo size={44} />

          <div className="space-y-5 max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-black leading-[1.08] tracking-tight text-foreground">
              Learn Python the{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                fun, fearless
              </span>{" "}
              way.
            </h1>
            <p className="text-base xl:text-lg text-muted-foreground leading-relaxed">
              Practice problems, live mock tests and real-time analytics — all in
              one colorful hub built for curious coders.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge>⏱ Timed mock tests</Badge>
              <Badge>📊 Smart analytics</Badge>
              <Badge>🐍 Python-first</Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Crafted by Siddharth Prashant Pawar
          </p>
        </section>

        {/* Right: auth card */}
        <section className="flex items-center justify-center p-4 sm:p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div
              className="rounded-2xl border border-border bg-card text-card-foreground shadow-[var(--shadow-elevated)] p-6 sm:p-8"
              role="region"
              aria-labelledby="signin-heading"
            >
              <div className="lg:hidden mb-5 flex justify-center">
                <BrandLogo size={40} />
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]"
                />
                Welcome back
              </div>

              <h2
                id="signin-heading"
                className="mt-3 text-2xl sm:text-3xl font-black tracking-tight"
              >
                Sign in to your{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "var(--gradient-sunrise)" }}
                >
                  coding journey
                </span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One click with Google — we'll remember your progress, attempts and
                achievements.
              </p>

              <button
                type="button"
                onClick={signInGoogle}
                disabled={busy || checkingSession}
                aria-label="Continue with Google"
                aria-busy={busy}
                className="mt-6 inline-flex w-full min-h-12 items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
              >
                {busy ? (
                  <>
                    <Spinner />
                    <span>Opening Google…</span>
                  </>
                ) : checkingSession ? (
                  <>
                    <Spinner />
                    <span>Checking your session…</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div
                aria-live="polite"
                aria-atomic="true"
                className="min-h-0"
              >
                {error && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 p-3 text-sm text-[color:var(--destructive)]"
                  >
                    <svg
                      aria-hidden
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      <span className="font-semibold">Sign-in failed. </span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                secure sign-in
                <div className="h-px flex-1 bg-border" />
              </div>

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5">🔒</span>
                  We never see your Google password.
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5">🎯</span>
                  Auto-submit kicks in if you exit full-screen during a mock test.
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5">✨</span>
                  Your progress syncs across all your devices.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground shadow-[var(--shadow-card)]">
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin motion-reduce:animate-none"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
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

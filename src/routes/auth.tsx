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
      if (data.session) navigate({ to: "/practice" });
    });
  }, [navigate]);

  async function signInGoogle() {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error instanceof Error ? result.error.message : String(result.error));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/practice" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "var(--gradient-sunrise)", filter: "blur(80px)" }}
        aria-hidden
      />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-warm)]">
        <div className="flex items-center gap-3">
          <BrandLogo size={48} />
        </div>

        <h2 className="mt-6 text-lg font-semibold">Sign in to start practicing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your Google account. We use it only to remember your practice progress and mock-test attempts.
        </p>

        <button
          onClick={signInGoogle}
          disabled={busy}
          className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:border-accent transition disabled:opacity-50"
        >
          <GoogleIcon />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          By signing in you agree to follow the test integrity rules. Auto-submit triggers if you exit full-screen
          during a mock test.
        </p>
      </div>
    </div>
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

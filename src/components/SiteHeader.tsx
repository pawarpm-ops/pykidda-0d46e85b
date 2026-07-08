import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useIsAdmin } from "@/lib/role";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-border/60 backdrop-blur sticky top-0 z-20 bg-background/80">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo size={36} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 text-sm">
          <Link to="/practice" data-tour="nav-practice" className="px-2 py-1 rounded hover:bg-secondary transition-colors">
            Practice
          </Link>
          {email && isAdmin && (
            <Link
              to="/admin"
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Admin
            </Link>
          )}
          <Link to="/mock-tests" data-tour="nav-mock" className="px-2 py-1 rounded hover:bg-secondary transition-colors">
            Mock Tests
          </Link>
          <Link to="/leaderboard" data-tour="nav-leaderboard" className="px-2 py-1 rounded hover:bg-secondary transition-colors">
            Leaderboard
          </Link>
          {email && (
            <Link to="/analytics" data-tour="nav-analytics" className="px-2 py-1 rounded hover:bg-secondary transition-colors">
              Analytics
            </Link>
          )}
          {email && (
            <Link to="/profile" data-tour="nav-profile" className="px-2 py-1 rounded hover:bg-secondary transition-colors">
              Profile
            </Link>
          )}
          <ThemeToggle className="ml-1" />
          {email && (
            <span data-tour="nav-notifications">
              <NotificationBell />
            </span>
          )}
          {email ? (
            <div className="flex items-center gap-2 ml-1">
              <span className="hidden sm:inline text-xs text-muted-foreground">{email}</span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.invalidate();
                  navigate({ to: "/" });
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}


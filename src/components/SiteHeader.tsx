import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, User, Home, TrendingUp, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useIsAdmin } from "@/lib/role";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  tour?: string;
  authOnly?: boolean;
  iconOnly?: boolean;
  icon?: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", iconOnly: true, icon: Home },
  { to: "/practice", label: "Practice", tour: "nav-practice" },
  { to: "/mock-tests", label: "Mock Tests", tour: "nav-mock" },
  { to: "/leaderboard", label: "Leaderboard", tour: "nav-leaderboard" },
  { to: "/assignments", label: "Homework", authOnly: true },
  { to: "/teacher-comments", label: "Teacher Comments", authOnly: true },
  { to: "/analytics", label: "Analytics", tour: "nav-analytics", authOnly: true, iconOnly: true, icon: TrendingUp },
  { to: "/profile", label: "Profile", tour: "nav-profile", authOnly: true, iconOnly: true, icon: User },
];


export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const items = NAV_ITEMS.filter((i) => !i.authOnly || email);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const linkCls = (to: string) =>
    cn(
      "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border border-transparent hover-glow",
      isActive(to)
        ? "bg-primary/15 text-primary border-primary/30"
        : "text-foreground/70 hover:text-foreground",
    );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/" });
  }

  return (
    <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/85">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
        {/* Left: logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <BrandLogo size={36} />
        </Link>

        {/* Center: desktop nav */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-tour={item.tour}
              aria-label={item.label}
              title={item.iconOnly ? item.label : undefined}
              className={cn(
                linkCls(item.to),
                item.iconOnly && "inline-flex items-center justify-center h-9 w-9 p-0 rounded-full",
              )}
            >
              {item.iconOnly ? (() => { const Icon = item.icon ?? User; return <Icon size={18} />; })() : item.label}

            </Link>
          ))}
          {email && isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ml-1 border border-transparent hover-glow",
                "bg-primary text-primary-foreground",
              )}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-2 ml-auto lg:ml-0 shrink-0">
          <ThemeToggle />
          {email && (
            <span data-tour="nav-notifications" className="inline-flex">
              <NotificationBell />
            </span>
          )}
          {email ? (
            <>
              <span
                className="hidden xl:inline-flex max-w-[180px] truncate rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground"
                title={email}
              >
                {email}
              </span>
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-sm whitespace-nowrap hover-glow"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] whitespace-nowrap"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Sign in
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover-glow"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur">
          <nav className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-tour={item.tour}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 border border-transparent hover-glow",
                  isActive(item.to)
                    ? "bg-primary/15 text-primary"
                    : "text-foreground/80",
                )}
              >
                {item.icon && (() => { const Icon = item.icon; return <Icon size={16} />; })()}
                {item.label}


              </Link>
            ))}
            {email && isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground"
              >
                Admin
              </Link>
            )}
            {email && (
              <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground" title={email}>
                  {email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent transition-colors whitespace-nowrap"
                >
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

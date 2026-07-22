import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  User,
  Home,
  TrendingUp,
  Trophy,
  MessageCircleMore,
  NotebookPen,
  ClipboardList,
  Bell,
  LogOut,
  UserCog,
  Shield,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedSession } from "@/lib/auth-cache";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsAdmin } from "@/lib/role";
import { cn } from "@/lib/utils";
import {
  listAnnouncements,
  listDismissedIds,
  listReadIds,
} from "@/lib/notifications";

type NavItem = {
  to: string;
  label: string;
  tour?: string;
  authOnly?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  badgeKey?: "notifications";
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/mock-tests", label: "Mock Tests", tour: "nav-mock", icon: ClipboardList },
  { to: "/leaderboard", label: "Leaderboard", tour: "nav-leaderboard", icon: Trophy },
  { to: "/homework", label: "Homework", tour: "nav-practice", authOnly: true, icon: NotebookPen },
  { to: "/teacher-comments", label: "Teacher Comments", authOnly: true, icon: MessageCircleMore },
  { to: "/notifications", label: "Notifications", authOnly: true, icon: Bell, badgeKey: "notifications" },
  { to: "/analytics", label: "Analytics", tour: "nav-analytics", authOnly: true, icon: TrendingUp },
  { to: "/profile", label: "Profile", tour: "nav-profile", authOnly: true, icon: User },
  { to: "/help", label: "Help / FAQ", icon: HelpCircle },
];

function useUnreadCount(userId: string | null) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    async function refresh(uid: string) {
      try {
        const [a, r, d] = await Promise.all([
          listAnnouncements(),
          listReadIds(uid),
          listDismissedIds(uid),
        ]);
        if (cancelled) return;
        const unread = a.filter((i) => !d.has(i.id) && !r.has(i.id)).length;
        setCount(unread);
      } catch {
        /* noop */
      }
    }
    void refresh(userId);
    const ch = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => void refresh(userId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_reads" },
        () => void refresh(userId),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [userId]);
  return count;
}

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount(userId);

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const isAdminRoute = pathname.startsWith("/admin");

  const items = NAV_ITEMS.filter((i) => !i.authOnly || email);

  if (isAdminRoute) return null;

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/" });
  }

  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth" });
  }

  function renderNavLink(item: NavItem) {
    const active = isActive(item.to);
    const Icon = item.icon;
    const badge = item.badgeKey === "notifications" ? unread : 0;
    const commonClass = cn(
      "group relative flex items-center gap-3 rounded-lg pl-4 pr-3 min-h-11 text-sm font-medium",
      "transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      item.disabled
        ? "cursor-not-allowed opacity-60 text-muted-foreground"
        : cn(
            "hover:bg-muted",
            active
              ? "bg-primary/10 text-primary font-semibold"
              : "text-foreground/80 hover:text-foreground",
          ),
    );
    const inner = (
      <>
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full transition-colors",
            active ? "bg-primary" : "bg-transparent",
          )}
        />
        <span className="relative inline-flex items-center justify-center shrink-0">
          <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
          {badge > 0 && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none"
              aria-label={`${badge} unread`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className="truncate">{item.label}</span>
        {item.disabled && (
          <span className="ml-auto rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Soon
          </span>
        )}
      </>
    );
    if (item.disabled) {
      return (
        <div
          key={item.to}
          role="link"
          aria-disabled="true"
          aria-label={`${item.label} (coming soon)`}
          title="Coming soon"
          className={commonClass}
        >
          {inner}
        </div>
      );
    }
    return (
      <Link
        key={item.to}
        to={item.to}
        data-tour={item.tour}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={commonClass}
      >
        {inner}
      </Link>
    );
  }

  return (
    <>
      {/* Top bar with hamburger — visible on all viewports */}
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-drawer"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            {!menuOpen && email && unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="PY Kidda — Home">
            <BrandLogo size={32} />
          </Link>

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            {!email && (
              <Link
                to="/auth"
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground whitespace-nowrap"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          aria-hidden
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-out drawer */}
      <aside
        id="site-drawer"
        aria-label="Primary navigation"
        aria-hidden={!menuOpen}
        className={cn(
          "fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 flex flex-col border-r border-border bg-card shadow-2xl",
          "transition-transform duration-200 ease-out",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-4 pt-5 pb-4 border-b border-border flex items-center justify-between">
          <Link
            to="/"
            aria-label="PY Kidda — Home"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BrandLogo size={36} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5"
          aria-label="Main"
        >
          {items.map((item) => renderNavLink(item))}
          {email && isAdmin && (
            <Link
              to="/admin"
              aria-label="Admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg pl-4 pr-3 min-h-11 mt-2 text-sm font-semibold",
                "border border-primary/40 bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
              )}
            >
              <Shield size={20} strokeWidth={2.2} aria-hidden />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="px-3 py-3 border-t border-border flex flex-col gap-2">
          {email && (
            <span
              className="min-w-0 truncate rounded-full border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground"
              title={email}
            >
              {email}
            </span>
          )}
          {email ? (
            <>
              <button
                type="button"
                onClick={handleSwitchAccount}
                aria-label="Switch account"
                className="flex items-center gap-2 rounded-lg px-3 min-h-10 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
              >
                <UserCog size={18} aria-hidden />
                <span>Switch account</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="flex items-center gap-2 rounded-lg px-3 min-h-10 text-sm font-medium border border-destructive/30 bg-background text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-colors"
              >
                <LogOut size={18} aria-hidden />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="flex items-center justify-center gap-2 rounded-lg px-3 min-h-10 text-sm font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

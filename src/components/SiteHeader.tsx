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
  Shield,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    supabase.auth.getSession().then(({ data }) => {
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

  useEffect(() => {
    document.body.classList.add("has-sidebar");
    return () => document.body.classList.remove("has-sidebar");
  }, []);

  const items = NAV_ITEMS.filter((i) => !i.authOnly || email);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/" });
  }

  function renderNavLink(item: NavItem, opts?: { compact?: boolean }) {
    const active = isActive(item.to);
    const Icon = item.icon;
    const badge = item.badgeKey === "notifications" ? unread : 0;
    const commonClass = cn(
      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium border border-transparent transition-all duration-150",
      item.disabled
        ? "cursor-not-allowed opacity-60 text-foreground/60"
        : cn(
            "hover:border-primary/40 hover:bg-primary/5 hover:translate-x-0.5",
            active
              ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_0_1px_var(--color-primary)]/0"
              : "text-foreground/75 hover:text-foreground",
          ),
      opts?.compact && "px-2 py-2",
    );
    const inner = (
      <>
        <span className="relative inline-flex items-center justify-center">
          <Icon size={20} strokeWidth={active ? 2.4 : 2} />
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
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
        className={commonClass}
      >
        {inner}
      </Link>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-60 z-40 flex-col border-r border-border/60 bg-background/95 backdrop-blur"
        aria-label="Primary navigation"
      >
        <div className="px-4 pt-5 pb-4 border-b border-border/60">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={36} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {items.map((item) => renderNavLink(item))}
          {email && isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold border border-transparent mt-1 transition-all duration-150",
                "hover:border-primary/50 hover:translate-x-0.5",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/90 text-primary-foreground",
              )}
            >
              <Shield size={20} strokeWidth={2.2} />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="px-3 py-3 border-t border-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <ThemeToggle />
            {email && (
              <span
                className="max-w-[130px] truncate rounded-full border border-border bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground"
                title={email}
              >
                {email}
              </span>
            )}
          </div>
          {email ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border border-border bg-background hover:border-destructive/50 hover:text-destructive transition-colors"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
              style={{ backgroundImage: "var(--gradient-sunrise)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
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
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
              {!menuOpen && email && unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-background/95 backdrop-blur">
            <nav className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-col gap-1">
              {items.map((item) => renderNavLink(item, { compact: true }))}
              {email && isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground"
                >
                  <Shield size={18} />
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
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-destructive/50 hover:text-destructive transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

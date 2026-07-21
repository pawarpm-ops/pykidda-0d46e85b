import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  ClipboardList,
  NotebookPen,
  Code2,
  MoreHorizontal,
  X,
  Trophy,
  TrendingUp,
  User,
  MessageCircleMore,
  Bell,
  HelpCircle,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getCachedSession } from "@/lib/auth-cache";
import { useIsAdmin } from "@/lib/role";

// Kept in sync with PykoFloatingPanel's assessment detection.
function isAssessmentRoute(path: string): boolean {
  return (
    /^\/mock-tests\/[^/]+\/run\b/.test(path) ||
    /^\/mock-tests\/ai\/[^/]+\/take\b/.test(path)
  );
}

type Item = { to: string; label: string; icon: LucideIcon; authOnly?: boolean };

const PRIMARY: Item[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/practice", label: "Practice", icon: Code2, authOnly: true },
  { to: "/homework", label: "Homework", icon: NotebookPen, authOnly: true },
  { to: "/mock-tests", label: "Tests", icon: ClipboardList },
];

const MORE: Item[] = [
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/analytics", label: "Analytics", icon: TrendingUp, authOnly: true },
  { to: "/notifications", label: "Notifications", icon: Bell, authOnly: true },
  { to: "/teacher-comments", label: "Teacher Comments", icon: MessageCircleMore, authOnly: true },
  { to: "/profile", label: "Profile", icon: User, authOnly: true },
  { to: "/help", label: "Help / FAQ", icon: HelpCircle },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    getCachedSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Hide on admin, auth, onboarding, and during active assessments.
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname === "/onboarding" ||
    isAssessmentRoute(pathname);

  if (hidden) return null;

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const primary = PRIMARY.filter((i) => !i.authOnly || email);
  const more = MORE.filter((i) => !i.authOnly || email);

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className={cn(
          "lg:hidden fixed inset-x-0 bottom-0 z-40",
          "border-t border-border/60 bg-background/95 backdrop-blur",
          "pb-[max(env(safe-area-inset-bottom),0px)]",
        )}
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  <span className="truncate max-w-[62px]">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={moreOpen ? "Close more menu" : "Open more menu"}
              aria-expanded={moreOpen}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                moreOpen ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal size={20} strokeWidth={moreOpen ? 2.4 : 2} />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-background shadow-xl",
              "pb-[max(env(safe-area-inset-bottom),16px)]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="text-sm font-semibold">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2 px-4 pb-4">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5",
                      )}
                    >
                      <Icon size={20} />
                      <span className="truncate px-1 text-center">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              {email && isAdmin && (
                <li>
                  <Link
                    to="/admin"
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary text-xs font-semibold text-primary-foreground"
                  >
                    <Shield size={20} />
                    <span>Admin</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { ReportProblem } from "@/components/ReportProblem";
import { ReviewPopup } from "@/components/ReviewPopup";
import { StreakUnlockModal } from "@/components/StreakUnlockModal";
import { InactivityLogout } from "@/components/InactivityLogout";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PY Kidda" },
      { name: "description", content: "A web portal for students to practice Python programming through tests and coding exercises." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "PY Kidda" },
      { property: "og:description", content: "A web portal for students to practice Python programming through tests and coding exercises." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "PY Kidda" },
      { name: "twitter:description", content: "A web portal for students to practice Python programming through tests and coding exercises." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bf58faa-0176-41b5-8deb-0cd2b41c7a63/id-preview-4662ab07--2359da18-e5c2-45fe-ae67-7c573fbd7952.lovable.app-1781885462625.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bf58faa-0176-41b5-8deb-0cd2b41c7a63/id-preview-4662ab07--2359da18-e5c2-45fe-ae67-7c573fbd7952.lovable.app-1781885462625.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <OnboardingTutorial />
        <ReportProblem />
        <ReviewPopup />
        <StreakUnlockModal />
        <InactivityLogout />
      </AuthGate>
    </QueryClientProvider>
  );
}

// Site-wide login gate: only the /auth route is reachable without a session.
// Everything else redirects to /auth on the client.
function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [onboardChecked, setOnboardChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadOnboarded(userId: string, email: string | null) {
      if (email === "siddhustudyhard@gmail.com") {
        if (!mounted) return;
        setOnboarded(true);
        setOnboardChecked(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", userId)
        .maybeSingle();
      if (!mounted) return;
      setOnboarded(!!data?.onboarded);
      setOnboardChecked(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      setAuthed(!!session);
      setChecked(true);
      if (session?.user) {
        loadOnboarded(session.user.id, session.user.email ?? null);
      } else {
        setOnboardChecked(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setChecked(true);
      if (session?.user) {
        setOnboardChecked(false);
        loadOnboarded(session.user.id, session.user.email ?? null);
      } else {
        setOnboarded(true);
        setOnboardChecked(true);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  const isOnboardingRoute = pathname === "/onboarding";

  useEffect(() => {
    if (!checked) return;
    if (!authed && !isAuthRoute) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (authed && onboardChecked && !onboarded && !isOnboardingRoute && !isAuthRoute) {
      navigate({ to: "/onboarding", replace: true });
    }
    if (authed && onboardChecked && onboarded && isOnboardingRoute) {
      navigate({ to: "/", replace: true });
    }
  }, [checked, authed, isAuthRoute, isOnboardingRoute, onboardChecked, onboarded, navigate]);

  if (!checked && !isAuthRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!authed && !isAuthRoute) {
    return null;
  }
  if (authed && onboardChecked && !onboarded && !isOnboardingRoute) {
    return null;
  }
  return <>{children}</>;
}

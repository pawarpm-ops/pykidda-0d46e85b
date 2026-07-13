// Client-side wrapper + browser hooks for System Health logging.
// Fire-and-forget: never throws to caller.

import { logSystemHealthEvent } from "@/lib/system-health.functions";

export type ClientHealthEvent = {
  category: "ai" | "pdf" | "login" | "api" | "performance" | "pyodide";
  errorMessage: string;
  moduleName?: string | null;
  pageRoute?: string | null;
  severity?: "low" | "medium" | "high" | "critical";
  statusCode?: number | null;
  errorDetails?: Record<string, unknown> | null;
  durationMs?: number | null;
  userEmail?: string | null;
};

function captureDeviceInfo(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const nav = window.navigator;
    return {
      user_agent: nav.userAgent,
      language: nav.language,
      platform: nav.platform,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  } catch {
    return null;
  }
}

export async function logHealthEventClient(
  ev: ClientHealthEvent,
): Promise<void> {
  try {
    await logSystemHealthEvent({
      data: {
        category: ev.category,
        errorMessage: ev.errorMessage,
        moduleName: ev.moduleName ?? null,
        pageRoute:
          ev.pageRoute ??
          (typeof window !== "undefined" ? window.location.pathname : null),
        severity: ev.severity ?? "medium",
        statusCode: ev.statusCode ?? null,
        errorDetails: ev.errorDetails ?? null,
        deviceInfo: captureDeviceInfo(),
        durationMs: ev.durationMs ?? null,
        userEmail: ev.userEmail ?? null,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[health-log] client failed", ev.category, e);
  }
}

// -------- Slow-page tracking --------
// Fires once per full page load if the load exceeds a threshold.

const SLOW_WARN_MS = 5000;
const SLOW_CRITICAL_MS = 12000;

let slowInstalled = false;
export function installSlowPageTracker(routeName?: string) {
  if (slowInstalled || typeof window === "undefined") return;
  slowInstalled = true;
  // Track visibility across the page's lifetime — if the tab was ever hidden
  // before load fired, navigation timing is not comparable to a foreground
  // load (browsers throttle background tabs, inflating duration by seconds).
  let wasHidden = document.visibilityState === "hidden";
  const onVis = () => {
    if (document.visibilityState === "hidden") wasHidden = true;
  };
  document.addEventListener("visibilitychange", onVis);
  const onLoad = () => {
    document.removeEventListener("visibilitychange", onVis);
    try {
      if (wasHidden) return; // don't false-flag backgrounded loads
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      // Prefer domContentLoadedEventEnd — loadEventEnd waits on late images/
      // analytics and misrepresents real interactivity.
      const duration = Math.round(
        nav.domContentLoadedEventEnd || nav.duration,
      );
      if (duration < SLOW_WARN_MS) return;
      const severity: ClientHealthEvent["severity"] =
        duration >= SLOW_CRITICAL_MS ? "critical" : "medium";
      void logHealthEventClient({
        category: "performance",
        errorMessage: `Slow page load: ${duration}ms`,
        moduleName: routeName ?? window.location.pathname,
        pageRoute: window.location.pathname,
        severity,
        durationMs: duration,
        errorDetails: {
          dom_content_loaded: Math.round(nav.domContentLoadedEventEnd),
          load_event: Math.round(nav.loadEventEnd),
          transfer_size: nav.transferSize,
        },
      });
    } catch {
      /* ignore */
    }
  };
  if (document.readyState === "complete") {
    setTimeout(onLoad, 0);
  } else {
    window.addEventListener("load", onLoad, { once: true });
  }
}

// -------- Global error/unhandledrejection capture (best-effort) --------

let globalInstalled = false;
export function installGlobalErrorLogger() {
  if (globalInstalled || typeof window === "undefined") return;
  globalInstalled = true;

  window.addEventListener("error", (event) => {
    const msg = event.message || String(event.error ?? "Unknown error");
    // Skip trivial resource-load noise
    if (!msg || msg === "Script error.") return;
    void logHealthEventClient({
      category: "api",
      errorMessage: msg.slice(0, 500),
      moduleName: event.filename ?? null,
      severity: "high",
      errorDetails: {
        line: event.lineno,
        col: event.colno,
        stack:
          event.error instanceof Error
            ? String(event.error.stack ?? "").slice(0, 2000)
            : null,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    void logHealthEventClient({
      category: "api",
      errorMessage: msg.slice(0, 500),
      severity: "high",
      errorDetails: {
        stack:
          reason instanceof Error
            ? String(reason.stack ?? "").slice(0, 2000)
            : null,
      },
    });
  });
}

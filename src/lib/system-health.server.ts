// Server-only helper for System Health logging. Best-effort: never throws.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type HealthCategory =
  | "ai"
  | "pdf"
  | "login"
  | "api"
  | "performance"
  | "pyodide";

export type HealthSeverity = "low" | "medium" | "high" | "critical";

export type HealthEntry = {
  category: HealthCategory;
  errorMessage: string;
  moduleName?: string | null;
  pageRoute?: string | null;
  severity?: HealthSeverity;
  statusCode?: number | null;
  errorDetails?: Record<string, unknown> | null;
  deviceInfo?: Record<string, unknown> | null;
  durationMs?: number | null;
  userEmail?: string | null;
};

/**
 * Log a health event from inside a server function. Requires the
 * authenticated `supabase` client from `requireSupabaseAuth` context.
 * Logging failure NEVER breaks the caller.
 */
export async function logHealthEventServer(
  supabase: any,
  entry: HealthEntry,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_system_health_event", {
      _category: entry.category,
      _error_message: entry.errorMessage.slice(0, 4000),
      _module_name: entry.moduleName ?? null,
      _page_route: entry.pageRoute ?? null,
      _severity: entry.severity ?? "medium",
      _status_code: entry.statusCode ?? null,
      _error_details: entry.errorDetails ?? null,
      _device_info: entry.deviceInfo ?? null,
      _duration_ms: entry.durationMs ?? null,
      _user_email: entry.userEmail ?? null,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[health-log]", entry.category, error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[health-log] threw", entry.category, e);
  }
}

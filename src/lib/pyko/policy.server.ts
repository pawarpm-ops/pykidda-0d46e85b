// Pyko policy checks: feature flag, assessment lockout, per-user daily budget.
// Server-only. All checks must pass BEFORE any model call runs.

import type { SupabaseClient } from "@supabase/supabase-js";

export class PykoPolicyError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "PykoPolicyError";
  }
}

// Master flag + optional per-mode flag (mode is optional so callers can just
// check the master switch). Uses the caller's RLS client — flags are readable
// by every authenticated user.
export async function assertPykoEnabled(
  supabase: SupabaseClient,
  mode?: string,
): Promise<void> {
  const keys = ["pyko_ai_enabled", ...(mode ? [`pyko_mode_${mode}`] : [])];
  const { data, error } = await supabase
    .from("pyko_feature_flags")
    .select("key, enabled")
    .in("key", keys);
  if (error) throw new PykoPolicyError("flag_lookup_failed", "Pyko is unavailable right now.", 503);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.enabled as boolean]));
  if (!map.get("pyko_ai_enabled")) {
    throw new PykoPolicyError("pyko_disabled", "Pyko is not enabled for this workspace.", 403);
  }
  if (mode && !map.get(`pyko_mode_${mode}`)) {
    throw new PykoPolicyError("mode_disabled", `Pyko ${mode} mode is not enabled.`, 403);
  }
}

// Assessment lockout — server-tracked via pyko_assessment_sessions. Blocks
// EVERY mode including guide while a mock/AI/scheduled test is active.
export async function assertNotInActiveAssessment(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("pyko_has_active_assessment", { _user_id: userId });
  if (error) {
    throw new PykoPolicyError("assessment_check_failed", "Pyko can't verify your assessment status.", 503);
  }
  if (data === true) {
    throw new PykoPolicyError(
      "assessment_locked",
      "Pyko is paused during an active test. Submit or exit the test to continue.",
      423,
    );
  }
}

// Restrict privileged modes to authorised roles.
export async function assertModeAllowedForUser(
  supabase: SupabaseClient,
  userId: string,
  mode: string,
): Promise<void> {
  if (mode !== "teacher") return;
  const { data, error } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "super_admin"],
  });
  if (error) throw new PykoPolicyError("role_check_failed", "Pyko can't verify your permissions.", 503);
  if (data !== true) {
    throw new PykoPolicyError("mode_forbidden", "Teacher mode is restricted to staff.", 403);
  }
}

// Conservative daily budget: 60 requests/day, 10 requests/minute.
// Enforced atomically via SQL function to prevent races.
export const PYKO_DAILY_REQUEST_LIMIT = 60;
export const PYKO_PER_MINUTE_LIMIT = 10;

export async function enforceAndIncrementBudget(
  admin: SupabaseClient,
  userId: string,
  limit: number = PYKO_DAILY_REQUEST_LIMIT,
  perMinuteLimit: number = PYKO_PER_MINUTE_LIMIT,
): Promise<{ used: number; limit: number; perMinuteUsed: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin.rpc("pyko_touch_budget", {
    _user_id: userId,
    _day: today,
    _limit: limit,
    _per_minute_limit: perMinuteLimit,
  });
  if (error) throw new PykoPolicyError("budget_write_failed", "Pyko is unavailable.", 503);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new PykoPolicyError("budget_write_failed", "Pyko is unavailable.", 503);
  if (row.allowed === false) {
    if (row.reason === "per_minute_limit") {
      throw new PykoPolicyError(
        "rate_limited",
        "You're sending messages too quickly. Please wait a moment.",
        429,
      );
    }
    throw new PykoPolicyError(
      "budget_exceeded",
      "You've reached today's Pyko request limit. Please try again tomorrow.",
      429,
    );
  }
  return { used: row.used ?? 0, limit, perMinuteUsed: row.per_minute_used ?? 0 };
}

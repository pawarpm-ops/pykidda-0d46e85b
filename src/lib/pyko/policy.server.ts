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

// Reject Tutor / Corrector / Coach requests while the student has an
// in-progress mock attempt. Only technical support-style modes (guide) are
// allowed to bypass — but even guide should not answer answer-seeking
// questions during an assessment. The gateway calls this for every request.
export async function assertNotInActiveAssessment(
  supabase: SupabaseClient,
  userId: string,
  mode: string,
): Promise<void> {
  // Always safe: pure "guide" style navigation help.
  if (mode === "guide") return;

  const { data, error } = await supabase
    .from("ai_mock_attempts")
    .select("id")
    .eq("user_id", userId)
    .is("submitted_at", null)
    .limit(1);
  if (error) {
    throw new PykoPolicyError("assessment_check_failed", "Pyko can't verify your assessment status.", 503);
  }
  if ((data ?? []).length > 0) {
    throw new PykoPolicyError(
      "assessment_locked",
      "Pyko is paused during an active mock test. Submit or exit the test to continue.",
      423,
    );
  }
}

// Very conservative daily budget: 60 requests per user per day by default.
// Uses the admin client (service role) — students cannot write these counters.
export const PYKO_DAILY_REQUEST_LIMIT = 60;

export async function enforceAndIncrementBudget(
  admin: SupabaseClient,
  userId: string,
  limit: number = PYKO_DAILY_REQUEST_LIMIT,
): Promise<{ used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing, error: readErr } = await admin
    .from("pyko_budget_counters")
    .select("request_count")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  if (readErr) throw new PykoPolicyError("budget_read_failed", "Pyko is unavailable.", 503);

  const used = existing?.request_count ?? 0;
  if (used >= limit) {
    throw new PykoPolicyError(
      "budget_exceeded",
      "You've reached today's Pyko request limit. Please try again tomorrow.",
      429,
    );
  }

  const { error: upErr } = await admin
    .from("pyko_budget_counters")
    .upsert(
      { user_id: userId, day: today, request_count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,day" },
    );
  if (upErr) throw new PykoPolicyError("budget_write_failed", "Pyko is unavailable.", 503);

  return { used: used + 1, limit };
}

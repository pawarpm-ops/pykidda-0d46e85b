# Pyko AI production hardening

Scope is exactly the 11 items in the request. No unrelated visual/functional changes. Existing conversations, badges, streaks, homework and mock flows stay intact.

## 1. Database migration (single additive migration)

- New table `pyko_assessment_sessions(user_id, assessment_id, assessment_type ENUM standard|ai|scheduled, status ENUM active|completed|expired|abandoned, started_at, expires_at, last_activity_at, completed_at)`. Unique partial index on `(user_id) WHERE status='active'`. GRANTs + RLS: user reads own, service_role all.
- New enum `pyko_mode_type` mirroring the Zod enum (kept in sync via `schemas.ts`).
- Ownership hardening on `pyko_messages`:
  - Add composite FK `(conversation_id, user_id) REFERENCES pyko_conversations(id, user_id)` after adding a matching unique index on `pyko_conversations(id, user_id)`.
  - RLS `EXISTS` check requiring `conversation_id` to belong to `auth.uid()` for SELECT/INSERT.
  - Revoke UPDATE/DELETE from `authenticated` for `pyko_messages`; keep service_role.
  - Restrict INSERT of `role='assistant'` to `service_role` only (policy predicate `role='user' OR auth.role()='service_role'`).
- New SQL function `pyko_touch_budget(_user_id uuid, _day date, _limit int, _per_minute_limit int)` — atomic `INSERT … ON CONFLICT … DO UPDATE` that returns `{used, per_minute_used, allowed, reason}` in one round trip. Adds `minute_bucket` + `minute_count` columns to `pyko_budget_counters` (nullable, default 0) plus `tokens_in`, `tokens_out`.
- New SQL function `pyko_start_assessment(_assessment_id text, _type text, _duration_minutes int)` and `pyko_end_assessment(_assessment_id text, _reason text)` running as SECURITY DEFINER, scoped to `auth.uid()`. Auto-expire lazily inside `pyko_has_active_assessment(_user_id uuid)`.
- Feature flags: ensure only `pyko_ai_enabled` and `pyko_mode_guide` remain `enabled=true`; explicitly set `pyko_mode_tutor|corrector|coach|teacher` to `enabled=false`. No row deletes.

## 2. Server code changes

Files:

- `src/lib/pyko/policy.server.ts`
  - Replace `assertNotInActiveAssessment` with a call to `pyko_has_active_assessment` covering all three assessment types (uses new table, not `ai_mock_attempts.submitted_at`). Block ALL modes including `guide`. Runs before budget.
  - Replace `enforceAndIncrementBudget` with a single RPC to `pyko_touch_budget`. Per-minute cap 10. Skip on assessment block (never called because thrown earlier).
  - Add `assertModeAllowedForUser(supabase, userId, mode, conversationMode)` — checks role for `teacher`, matches conversation mode.
- `src/lib/pyko/router.functions.ts`
  - Reorder: flag → assessment → conversation ownership check → mode/role check → budget → user msg insert → history load (descending, limit 20, reverse, ensure current user message present) → page-context refresh on conversation → provider call with `AbortSignal.timeout(25_000)` → assistant insert via `supabaseAdmin` (RLS blocks assistant inserts from authenticated) → telemetry.
  - Handle every Supabase result: on error → throw `PykoPolicyError` with trace id, no provider call.
  - Empty provider response → return deterministic Guide fallback from knowledge registry.
  - Redact prompts/content from telemetry (log only lengths, mode, latency, status).
- `src/lib/pyko/provider.server.ts`
  - Add `X-Lovable-AIG-SDK` header (already set). Ensure `AbortSignal` accepted at call time.
- `src/lib/pyko/prompts.ts` + new `src/lib/pyko/knowledge.server.ts`
  - Knowledge registry: hard-coded map of routes → `{title, path, whatItDoes, whenToUse, relatedRoutes}` for every user-facing route confirmed in `src/routes/`. Includes dashboard, homework, practice, mock (standard/AI/scheduled), streaks, badges, leaderboard, profile, notifications, teacher-comments, help, badges, admin index (no data). Exported `guideFallback(query)` deterministic matcher.
  - Guide system prompt: append verified knowledge summary + current route (validated server-side). Instruct to say "I'm not sure — try the Help page" when uncertain.
- New `src/lib/pyko/assessment.functions.ts`
  - `startPykoAssessment({assessmentId, type, durationMinutes})` and `endPykoAssessment({assessmentId, reason})` server fns via `requireSupabaseAuth`.
- `src/lib/pyko/schemas.ts`
  - Add `retry: boolean` optional to `PykoChatInput` (skip user-message insert). Add `PykoAssessmentStart/End` inputs.

## 3. Assessment integration

- `src/routes/mock-tests.$testId.run.tsx`, `mock-tests.ai.$testId.take.tsx`, and scheduled test route: call `startPykoAssessment` on mount (once ready to serve questions), call `endPykoAssessment` on submit/violation/unmount/expiry. Non-blocking failures.
- `mock-tests.$testId.warning.tsx` and `mock-tests.ai.$testId.warning.tsx`: no start (only run/take routes start).
- No changes to question fetching / submission flow logic; assessment session is additive.

## 4. Floating panel UX (`src/components/PykoFloatingPanel.tsx`)

- Ref-based measurement; on open recompute clamp with actual panel size. Recompute on `resize`/`orientationchange`.
- Cap height with `min(520px, calc(100vh - 16px))` and width similar.
- Malformed localStorage → discard.
- Hide panel entirely on `/mock-tests/*/run`, `/mock-tests/ai/*/take`, `/mock-tests/scheduled/*/…` via pathname test (belt-and-suspenders; server already blocks).
- Focus input on open; `aria-live=polite` on message list; labelled buttons.
- Retry button on last error (calls `pykoChat` with `retry:true`).
- "New conversation" button clears local state; "Delete conversation" calls new server fn that deletes only own conversation.
- Preserve dragging + persisted position; also clamp saved values.

## 5. Tests + tooling

- Add `vitest` config + `tests/pyko/*.test.ts`:
  - Unauthed → 401 (mock middleware).
  - Disabled mode rejected.
  - Student → teacher mode 403.
  - Active assessment → 423 for every mode; provider NOT called; budget unchanged.
  - History: 15 exchanges → latest 20 in chronological order, current message last.
  - Cross-user conversation id rejected.
  - Concurrent budget: 70 parallel requests → exactly `limit` succeed.
  - Prompt payload never contains reference solutions / hidden tests (assert on knowledge registry only).
  - Panel: JSDOM snapshot ensuring bounding box within viewport for 320×568 and 1440×900.
- Add npm scripts if missing: `typecheck`, `lint`, `test`, `build`.

## 6. Privacy notes

- Add a one-line privacy notice in panel footer: "Chats may be stored to improve Pyko. Don't share sensitive info."
- Telemetry stores only metadata (no content, no page context contents other than route).
- Retention: SQL function `pyko_retain(days int)` (not scheduled — documented for manual/cron use).

## Files changed

Modified: `src/lib/pyko/{router.functions,policy.server,provider.server,prompts,schemas}.ts`, `src/components/PykoFloatingPanel.tsx`, `src/routes/mock-tests.$testId.run.tsx`, `src/routes/mock-tests.ai.$testId.take.tsx`, `src/routes/__root.tsx`.

Added: `src/lib/pyko/{knowledge.server,assessment.functions,history.ts}.ts`, `tests/pyko/*.test.ts`, `vitest.config.ts` (if absent), one Supabase migration.

## Out of scope (explicit)

- No changes to homework/practice/mock scoring, badges, streaks.
- No scheduled cron for retention.
- Tutor/Corrector/Coach/Teacher UI stays disabled.
- No prompt/model swap.

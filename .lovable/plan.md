# Motivational Badges System

Extend the existing `badges` / `student_badges` infrastructure — no second system, all previously earned badges preserved.

## 1. Database (single migration)

Extend existing `badges` table:
- Add `tier` (`bronze|silver|gold|platinum|legendary`), `rarity` (`common|uncommon|rare|epic|legendary`), `category` (`getting_started|consistency|practice|debugging|homework|mock|exploration`), `is_secret bool`, `target_value int`, `progress_metric text`.
- Keep existing `rule_type`/`threshold` for back-compat; extend `evaluate_and_award_badges` to handle new rule types.

Extend `student_badges`:
- Already unique on `(student_id, badge_id)` — keeps idempotency. Add `trigger_activity text` (already have `source_type`).

Seed ~50 new badges covering all 7 categories from the spec (upsert by `badge_key` so existing keys keep their `id` and earned rows).

New/extended RPCs (all SECURITY DEFINER, `auth.uid()` based):
- `evaluate_and_award_badges(_event_type text)` — extend to compute new metrics:
  - practice pass counts (tiered), unit-complete, distinct-units, clean-sweep (all tests first attempt), total test cases passed
  - homework: on-time count tiers, perfect marks, resubmission improvement, complete-answers, early-finisher
  - mock: attempts count tiers, score tiers, perfect, 3-in-a-row improvement, personal-best, +15pp improvement
  - debugging: first ai-corrector use, 10 corrections, syntax+runtime+logic mix (from `practice_attempts` failure reasons if stored, else from ai-feedback logs)
  - never-give-up (pass after ≥3 fails on same question), comeback-coder (return after gap)
  - exploration: coding+mcq+written mix, 5 topics, all-rounder, hard-difficulty, difficulty-climber
  - getting-started: first activity, first code run, first pass, first homework submit, first mock complete
  - Returns newly-earned rows only.
- `get_badge_progress(_user_id uuid)` — returns all badges with `earned`, `earned_at`, `current_value`, `target_value`, `progress_pct`.
- `get_next_badge_targets(_user_id uuid, _limit int)` — top-3 closest unearned non-secret badges by percentage.
- `admin_badge_overview()` — admin-only aggregates: most-earned, rarest, recent awards, students near milestones.

Backfill: run `evaluate_and_award_badges` for all existing users via one-off `INSERT ... SELECT` pattern in migration (loop over user_ids via PL/pgSQL DO block).

## 2. Server functions (`src/lib/badges.functions.ts`)

- `getMyBadgeProgress` (auth) — calls `get_badge_progress`.
- `getMyNextTargets` (auth) — calls `get_next_badge_targets`.
- `evaluateMyBadges` (auth) — calls `evaluate_and_award_badges`, returns newly earned.
- `getAdminBadgeOverview` (auth + admin check) — calls `admin_badge_overview`.

Client hook `useBadgeEvaluator` triggers `evaluateMyBadges` after key events (practice solved, homework submitted, mock finished) — non-blocking, errors swallowed to console.

## 3. UI

**Badge Gallery** (`/badges` route, already exists — extend):
- Header: total earned / total, completion %.
- Filters: category, tier, rarity, earned/locked/in-progress.
- Grid of `BadgeCard` with tier ring, icon, name, progress bar; locked = greyscale + lock icon; secret = "?" until earned.
- Click → `BadgeDetailDialog` with description, unlock condition, progress, earned date.

**Dashboard section** `YourNextBadges` — 3 cards from `getMyNextTargets`.

**Celebration** — `BadgeUnlockToast` using sonner + framer-motion scale-in + limited confetti; respects `prefers-reduced-motion`; dedupe via localStorage set of celebrated badge ids.

**Admin** — new tab in existing admin area: `AdminBadgesOverview` — most-earned, rarest, recent, near-milestone lists.

**Artwork** — CSS/SVG medallions with tier gradients (bronze/silver/gold/platinum/legendary), category-specific lucide icons (Rocket, Flame, Trophy, Bug, ClipboardCheck, Target, Compass). No image files — keeps bundle small and theme-aware.

## 4. Files

- `supabase/migrations/<ts>_motivational_badges.sql`
- `src/lib/badges.functions.ts` (new)
- `src/components/badges/BadgeMedallion.tsx`
- `src/components/badges/BadgeCard.tsx`
- `src/components/badges/BadgeDetailDialog.tsx`
- `src/components/badges/BadgeUnlockToast.tsx`
- `src/components/badges/YourNextBadges.tsx`
- `src/components/badges/AdminBadgesOverview.tsx`
- `src/hooks/useBadgeEvaluator.ts`
- Edit existing badges route/page to use new gallery.
- Wire `useBadgeEvaluator` into practice solve, homework submit, mock finish points.
- Add admin badges tab route.

## 5. Verification

- Backfill produces correct counts against existing `practice_attempts`, `homework_submissions`, `mock_results`.
- Trigger practice-solve → toast fires once, not on refresh.
- Locked badges visible; secret badges hidden condition.
- Reduced-motion disables confetti + scale.
- Admin overview only accessible to admins (RLS on RPC via `has_role`).
- Build + typecheck clean.

## Notes

- No changes to streak-count rules, scoring, grading, or auth.
- Existing `student_badges` rows preserved (upsert by `badge_key`).
- All awarding server-side; client never inserts into `student_badges`.

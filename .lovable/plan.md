## Goal

Give admins a choice when publishing an AI-generated mock test — publish as a **Normal Mock Test** (works exactly like today) or as a **Scheduled Mock Test** that is only attemptable during the teacher-selected date/time window. Split the student mock-tests page into Normal / Scheduled tabs, and send a notification with a **View** button that opens the specific scheduled test.

Everything reuses the existing AI mock test infrastructure (`ai_mock_tests`, `ai_mock_questions`, `ai_mock_attempts`, the existing take/warning/result routes, secure fullscreen mode, grading, timer). No parallel test engine.

---

## Part 1 — Database

Migration on `ai_mock_tests`:

- `test_kind` text default `'normal'` (`'normal' | 'scheduled'`)
- `scheduled_start_at` timestamptz null
- `scheduled_end_at` timestamptz null
- `schedule_instructions` text default `''`
- `results_visibility` text default `'immediate'` (`'immediate' | 'after_end'`)

CHECK: when `test_kind='scheduled'` and `status='published'`, both `scheduled_start_at` and `scheduled_end_at` are non-null and `end > start`. Existing rows default to `normal` — no behaviour change.

## Part 2 — Admin AI Mock creator (`src/routes/_authenticated/admin_.ai-mock.tsx`)

Replace the single "🚀 Publish to students" button with two:

- **Publish as Normal Mock Test** — current behaviour (status=`published`, `test_kind='normal'`).
- **Publish as Scheduled Mock Test** — opens a modal:
  - Date picker (calendar) + start time + end time
  - Duration is auto-derived from `duration_sec` but shown for confirmation
  - Instructions textarea
  - Results visibility toggle (Immediate / After test ends)
  - Confirm → publishes with `test_kind='scheduled'` and schedule fields set

Also in the admin list rows: show a `SCHEDULED · <date/time>` badge, and add an **Edit schedule** button (only before start time) that reopens the modal.

Server functions in `src/lib/ai-mock.functions.ts`:

- Extend `publishAiMockTest` input to accept `{ id, publish, test_kind?, scheduled_start_at?, scheduled_end_at?, schedule_instructions?, results_visibility? }`. Validate schedule fields when `test_kind='scheduled'`.
- New `updateAiMockSchedule({ id, ... })` for reschedule.
- Extend `listAiMockTests` to project the new fields.
- On successful scheduled publish, insert a row into `announcements` with:
  - `title = "New Scheduled Mock Test"`
  - `body = "A new scheduled mock test <title> is scheduled for <date/time>."`
  - `priority = "high"`
  - New column `action_url = "/mock-tests/scheduled/<id>"` (add to `announcements` in the same migration; nullable text). This is how the View button gets the deep link.

## Part 3 — Notification View button

Update `src/components/NotificationBell.tsx` (and any inline announcement rendering) so that when `action_url` is set, the row shows a **View** button that `navigate({ to: action_url })`. Non-scheduled announcements are unchanged.

## Part 4 — Student mock-tests page (`src/routes/mock-tests.index.tsx`)

Replace the single grid with two tabs:

- **Normal Mock Tests** — static `MOCK_TESTS` + AI tests where `test_kind='normal'` (existing behaviour).
- **Scheduled Mock Tests** — AI tests where `test_kind='scheduled'`, each rendered as a card with:
  - Title, description
  - 📅 Date, ⏰ Start–End, Duration, marks, Q count
  - Status badge derived from current time:
    - `Upcoming` (before start) — button disabled, "This test will start on <date/time>"
    - `Available Now` (within window) — enabled **Attend Test** button → existing warning route `/mock-tests/ai/$testId/warning`
    - `Closed` (after end) — button disabled, "This scheduled test is closed."

Ticking clock via `useEffect` interval so status flips live.

New route `src/routes/_authenticated/mock-tests.scheduled.$testId.tsx` — a details view the notification's View button lands on. Shows the same card + a large Attend button (same time-gating).

## Part 5 — Security gate for scheduled tests

In `getStudentAiTest` and `submitAiMockAttempt` handlers, when `test_kind='scheduled'`:

- Reject with `Test not started yet` if `now < scheduled_start_at`
- Reject with `Scheduled test window has ended` if `now > scheduled_end_at`

This is the real enforcement — the UI gate is a UX layer, the server-fn gate is the security boundary. Existing secure fullscreen / anti-cheat / grading / timer / attempt tracking already runs through the same take route, so nothing else changes.

Also in the result page, if `results_visibility='after_end'` and `now < scheduled_end_at`, hide the graded breakdown and show "Results will be available after <end time>."

## Part 6 — Admin Scheduled management

Small additions in the existing AI mock admin list:

- Filter chip: All / Normal / Scheduled
- On scheduled rows: countdown ("Starts in 2h 15m" / "Ends in 30m" / "Ended"), attempt count (reuse existing count), Edit-schedule button, Cancel button (sets status back to draft, removes schedule).

## Technical details

Files touched:

- `supabase/migrations/<new>.sql` — schema + `announcements.action_url`
- `src/lib/ai-mock.functions.ts` — publish/update/list changes + scheduled-time gate in student read/submit
- `src/routes/_authenticated/admin_.ai-mock.tsx` — two publish buttons + schedule modal + filter/edit/cancel
- `src/routes/mock-tests.index.tsx` — Normal / Scheduled tabs
- `src/routes/_authenticated/mock-tests.scheduled.$testId.tsx` — new deep-link details page
- `src/components/NotificationBell.tsx` — View button when `action_url` present
- `src/integrations/supabase/types.ts` — regenerated after migration approval

Constraints:

- The take/warning/result routes for AI mock tests stay unchanged — scheduled tests reuse them, gated by time on the server.
- Static `MOCK_TESTS` remain "normal" and untouched.
- All timestamps stored/compared in UTC; UI formats to local time.

Ready to implement on approval.
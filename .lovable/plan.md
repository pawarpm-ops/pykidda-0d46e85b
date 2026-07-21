
## Manual grading for scheduled mock tests

Scheduled mocks will stop auto-scoring on submit. Every question — MCQ, TF, fill, short answer, code — waits for the teacher. Students see "Awaiting review" until the teacher publishes.

### Data model changes

Add to `public.ai_mock_attempts`:
- `grading_status` — `pending_review` | `in_review` | `published` (default `pending_review` for scheduled tests, `published` for normal AI mocks so nothing else breaks)
- `reviewed_by` (uuid → auth.users), `reviewed_at`, `teacher_feedback` (text overall comment)
- `auto_marks_obtained`, `auto_percentage` — keep the machine's guess as a starting point for the teacher, never shown to the student

The existing `answers` jsonb keeps per-question rows; each row gets:
- `auto_marks_awarded` (what the grader computed)
- `marks_awarded` (final, teacher-editable — starts equal to auto value)
- `teacher_comment` (per-question note)

`leaderboard_scores` continues to sum best percentage per scheduled test, but **only counts attempts where `grading_status = 'published'`**.

### Backend

**Change `submitAiMockAttempt`** (`src/lib/ai-mock.functions.ts`):
- For `test_kind = 'scheduled'`: still compute auto grades (server-side, same as today), but store them in the `auto_*` fields, set `marks_obtained = 0`, `percentage = 0`, `grading_status = 'pending_review'`.
- For normal AI mocks: unchanged — publish immediately.

**New admin server fns** (`src/lib/ai-mock-grading.functions.ts`, `requireSupabaseAuth` + admin role check via `has_role`):
- `listAttemptsForReview({ testId })` — attempts + student name/roll for a scheduled test with counts (pending / published).
- `getAttemptForGrading({ attemptId })` — full attempt with questions (including correct_answer, expected outputs, per-test code run results) so the teacher can judge.
- `saveGrading({ attemptId, perQuestion: [{ questionId, marks_awarded, teacher_comment }], teacher_feedback, publish: boolean })` — validates marks ≤ question total, recomputes totals + %, sets `reviewed_by/reviewed_at`, moves to `in_review` (save) or `published` (publish), then calls `syncMyScore` for that student when published so the leaderboard updates.

**Student result route** (`src/routes/mock-tests.ai.$testId.result.tsx`):
- When `grading_status !== 'published'` for a scheduled test, show "Awaiting teacher review" state instead of the score/answer key. No auto marks leaked.
- When published, show the final marks and the teacher's per-question comments + overall feedback alongside the existing answer key.

### Teacher UI

New route `src/routes/_authenticated/admin_.ai-mock.$testId.grading.tsx`:
- List of submissions with status chips, filter by pending/published, click to open grading view.
- Grading view: one card per question showing the prompt, correct answer / expected output, the student's response (and code runs with pass/fail per test case for code questions), an editable marks input (0 → question total), and a comment box. Overall feedback box + Save draft / Publish buttons.

Add a "Grade submissions" link from the existing admin AI mock list next to scheduled tests.

### Technical notes

- Migration adds columns with sensible defaults so existing published normal-mock attempts stay untouched.
- Leaderboard fetcher filters `grading_status = 'published'` when summing scheduled scores.
- The client no longer needs `runs` back to display test-case-level info to students; that stays server-side, only surfaced in the teacher grading view.
- All grading endpoints check `has_role(auth.uid(), 'admin')` and reject otherwise; the client never writes to `ai_mock_attempts` directly (existing RLS already denies client writes).
- Onboarding of previously-submitted scheduled attempts: backfill sets them to `published` with current scores so leaderboard doesn't lose data.

### Files touched

```text
supabase migration           — new columns, backfill, leaderboard view/policy
src/lib/ai-mock.functions.ts — split scheduled vs normal on submit
src/lib/ai-mock-grading.functions.ts  — NEW admin grading fns
src/lib/leaderboard.functions.ts      — filter by grading_status=published
src/routes/mock-tests.ai.$testId.result.tsx  — awaiting-review state
src/routes/_authenticated/admin_.ai-mock.tsx — add "Grade" link
src/routes/_authenticated/admin_.ai-mock.$testId.grading.tsx — NEW
```

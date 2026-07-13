# Restructure Homework: Multi-Question Homework

Current system stores one question per `assignments` row. We'll add a new normalized structure (homework → questions → submissions → answers) with a safe migration path for existing records.

## Schema (new tables)

```text
homework
  id, title, description, instructions, due_at, allow_late_submission,
  total_marks (computed cache), status ('draft'|'published'|'closed'),
  created_by, created_at, updated_at

homework_questions
  id, homework_id, question_order, question_type
  ('coding'|'short_answer'|'mcq'|'descriptive'|'practice'),
  title, description, marks, difficulty,
  input_format, output_format, sample_input, sample_output,
  test_cases jsonb, hints, mcq_options jsonb, mcq_correct,
  starter_code, created_at, updated_at

homework_submissions
  id, homework_id, student_id, submitted_at, status
  ('not_submitted'|'submitted'|'late'|'checked'|'returned'),
  is_late, total_marks_obtained, teacher_feedback,
  checked_by, checked_at, created_at, updated_at
  UNIQUE(homework_id, student_id)

homework_question_answers
  id, submission_id, homework_question_id,
  student_answer, student_code, execution_output,
  marks_awarded, teacher_comment, auto_check_result jsonb,
  checked_status, created_at, updated_at
  UNIQUE(submission_id, homework_question_id)
```

RLS:
- `homework`: students SELECT where `status='published'`; teachers/admins full CRUD on own rows (admins any).
- `homework_questions`: SELECT if parent homework is visible to student; teacher/admin CRUD on their homework's questions. Sensitive fields (`test_cases`, `mcq_correct`) filtered server-side for students via sanitized server fn (never returned raw to client).
- `homework_submissions`: student CRUD own; teacher/admin SELECT+UPDATE (for grading).
- `homework_question_answers`: same as submissions via join.
- Trigger to recompute `total_marks_obtained` when answers change.
- Grading fields protected by trigger like current `protect_submission_grade_fields`.

## Data migration

Backfill existing `assignments` → `homework` (1:1) and create one `homework_questions` row per assignment carrying its type/marks/test_cases. Existing `assignment_submissions` → `homework_submissions` + one `homework_question_answers` row. Old tables kept read-only for one release (nothing deleted).

## Server functions (`src/lib/homework.functions.ts`)

- `listHomeworkForStudent`, `getHomeworkForStudent` (sanitized questions — strips `test_cases`, `mcq_correct`, `expected`)
- `listHomeworkForTeacher`, `getHomeworkForTeacher` (full)
- `createHomework`, `updateHomework`, `publishHomework`, `closeHomework`, `deleteHomeworkDraft`
- `addHomeworkQuestion`, `updateHomeworkQuestion`, `deleteHomeworkQuestion`, `reorderHomeworkQuestions`
- `startHomeworkSubmission` (creates draft submission if missing)
- `saveHomeworkAnswer` (autosave one question)
- `submitHomework` (finalize; server sets `is_late`, `status`, timestamps)
- `listSubmissionsForHomework` (teacher)
- `getSubmissionDetail` (teacher — includes student answers + question keys)
- `gradeHomeworkAnswer` (teacher — marks + comment per question)
- `finalizeHomeworkCheck` (teacher — overall feedback, mark `checked`)

## UI

Student (`_authenticated/homework.*`):
- `homework.index.tsx` — tabs: Pending / Submitted / Checked; cards with title, due badge, marks, question count, status pill.
- `homework.$id.tsx` — sequential question view with side navigator, autosave, "Submit Homework" button; late warning banner.

Teacher (`_authenticated/admin.homework.*`):
- `admin.homework.tsx` — list with Draft / Published / Closed tabs; "New Homework" button.
- `admin.homework.$id.tsx` — homework editor: title/desc/instructions/due, questions list with add/edit/delete/reorder, per-question marks/difficulty, coding fields incl. hidden test cases; Publish button.
- `admin.homework.$id.submissions.tsx` — student list with status; click → grading view with per-question answer, marks input, comment, overall feedback, "Mark checked".

Design: matches existing dark theme, uses existing shadcn components. Cards with subtle border-highlight hover. Badges for marks/difficulty/due/late.

Nav: rename existing "Homework" (`/assignments`) → new `/homework` route. Keep `/assignments` as redirect for one release so old links work.

## File plan

New:
- migration (schema + backfill)
- `src/lib/homework.functions.ts`
- `src/routes/_authenticated/homework.index.tsx`
- `src/routes/_authenticated/homework.$id.tsx`
- `src/routes/_authenticated/admin.homework.tsx`
- `src/routes/_authenticated/admin.homework.$id.tsx`
- `src/routes/_authenticated/admin.homework.$id.submissions.tsx`
- `src/components/homework/*` (QuestionEditor, QuestionRunner, SubmissionGrader)

Edited:
- `src/components/SiteHeader.tsx` (NAV item → `/homework`)
- `src/routes/_authenticated/assignments.index.tsx` → redirect to `/homework`
- `src/routes/_authenticated/admin.tsx` → link to `/admin/homework`

Untouched: `assignments*` server fns kept but no longer referenced by UI; removed in a future cleanup pass once old data confirmed migrated.

## Rollout order

1. Migration (schema + RLS + grants + backfill).
2. Server functions.
3. Teacher UI (create/edit/publish + submissions grading).
4. Student UI (list + solve + submit).
5. Nav + redirects.
6. Smoke test end-to-end.

Reply "go" to start with the migration (nothing else changes until you approve it), or ask for tweaks.

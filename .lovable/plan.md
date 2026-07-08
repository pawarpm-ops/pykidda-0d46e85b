## Assignment / Homework Module

A calm, non-proctored homework system separate from the existing mock-test flow. Teachers create assignments with a due date, students write Python code or a written answer in a friendly editor, teachers mark and give feedback.

### Scope of this build (v1)

- Coding, written, and mixed assignment types
- Publish / unpublish / draft / closed states + due-date auto-close
- Late submissions (optional per assignment)
- Student "My Assignments" page with cards + detail editor
- Admin "Assignments" tab: create, list, edit, review submissions, mark & feedback
- In-browser Pyodide "Run" button for coding assignments (reuses existing runner)
- Notifications reuse the existing announcement bell (new assignment / graded)

### Not in v1 (call out)

- File attachments on assignments (needs storage bucket + UI; can add later on request)
- Class/division/batch targeting (all-students only for v1; individual override later)
- Confetti + snake mascot artwork (I'll add a warm celebratory toast + due-date glow badge; commissioned illustration is a separate design task)
- Email reminders before due date (in-app reminder badge only)
- Automated grading of code assignments (teacher grades manually; students can run code to self-check)

### Data model

Two new tables in `public`:

```text
assignments
  id, title, description, unit, topic, difficulty,
  assignment_type ('coding'|'written'|'mixed'),
  total_marks, due_at, allow_late_submission,
  status ('draft'|'published'|'closed'),
  sample_input, sample_output, expected_output, starter_code,
  created_by, created_at, updated_at

assignment_submissions
  id, assignment_id, student_id,
  answer_text, code_answer, code_output,
  status ('pending'|'submitted'|'late'|'reviewed'),
  submitted_at, is_late,
  marks_obtained, teacher_feedback,
  reviewed_by, reviewed_at,
  created_at, updated_at
  UNIQUE(assignment_id, student_id)
```

RLS:
- `assignments`: `SELECT` for authenticated when `status='published'`; full CRUD for admins via `has_role`.
- `assignment_submissions`: student can `SELECT`/`INSERT`/`UPDATE` only their own row and only while the assignment is open; admins can read/update every row.
- Every table gets the required GRANTs.

### Server functions (`src/lib/assignments.functions.ts`)

- `listPublishedAssignments` — student view with submission join
- `getAssignmentForStudent(id)` — sanitized fetch (no expected_output leaked when hidden)
- `saveDraftSubmission({assignment_id, answer_text, code_answer, code_output})` — upsert while status stays `pending`
- `submitAssignment({assignment_id, ...})` — validates due date + allow_late, sets status to `submitted` or `late`
- `adminListAssignments`, `adminCreateAssignment`, `adminUpdateAssignment`, `adminDeleteAssignment`, `adminPublishAssignment` (admin-gated)
- `adminListSubmissions(assignment_id)`, `adminReviewSubmission({submission_id, marks_obtained, teacher_feedback})`

All admin fns run `assertAdmin` (has_role check). Student fns run under `requireSupabaseAuth` and use RLS-scoped client so users cannot touch other rows.

### Routes

- `src/routes/_authenticated/assignments.index.tsx` — student "My Assignments" list with status badges, due-date countdown, "Due soon" glow when < 24 h
- `src/routes/_authenticated/assignments.$id.tsx` — detail: description, code editor (Monaco already used elsewhere for practice), Run button (Pyodide), Submit dialog with confirmation
- New admin subtab inside `src/routes/_authenticated/admin.tsx` — Assignments tab with two panes: assignment list/editor on the left, submission review on the right
- Add "My Assignments" link to `SiteHeader.tsx`

### UI

- Reuses existing sunrise gradient, `card-glow` utility, warm shadow tokens — no new palette
- Status badges: draft (muted), published (accent), closed (secondary), late (destructive), reviewed (green)
- Due-date badge with pulse animation when < 24 h remaining
- Toast confirmation on submit ("Assignment submitted 🎉") instead of full confetti library
- Code editor uses the existing Monaco setup from `practice.$qid.tsx`

### Notifications

Reuses existing `announcements` table — on publish, `adminPublishAssignment` inserts an announcement ("New assignment: {title}") targeted to all. Post-review inserts a per-student announcement. No new realtime infra needed.

### Files touched / added

- New migration: `assignments` + `assignment_submissions` tables, RLS, GRANTs
- New `src/lib/assignments.functions.ts`
- New routes: `assignments.index.tsx`, `assignments.$id.tsx`
- New component `src/components/AssignmentEditor.tsx` (reused Monaco + Pyodide run)
- New admin tab section inside `admin.tsx`
- `SiteHeader.tsx` gets a "Homework" link

### Testing checklist (post-build)

- Admin creates → publishes → sees announcement fire
- Student sees assignment in list, opens it, drafts, submits
- Submitting after due date + allow_late=false is blocked
- Submitting after due date + allow_late=true records `is_late=true`
- Admin reviews, sets marks + feedback, student sees them
- Draft assignments do not appear to students

### Approve to proceed?

This is a substantial build (2 tables, ~8 server fns, 3 routes, admin tab, ~500-800 LOC). Reply "go" and I'll ship it end to end. If you want me to trim scope (e.g. skip written-type, skip run-button, skip late-submission toggle), tell me before I start.
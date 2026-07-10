# Homework Module Plan

Based on your answers:
- Remove Practice tab entirely
- Build brand-new Homework module (separate from Assignments)
- Per-homework mode: **Self-solve** or **Submit for grading**
- Leave the static `src/lib/questions.ts` Practice content alone (no DB migration for legacy)

## 1. Database (single migration)

New tables in `public`:

- `homework`
  - `id`, `created_by` (uuid → auth.users), `title`, `description`, `mode` ('self_solve' | 'submit'), `status` ('draft' | 'published'), `due_at` (nullable), `instructions`, `created_at`, `updated_at`
- `homework_questions`
  - `id`, `homework_id`, `position` (int), `question_source` ('manual' | 'ai_generated'), `refined_by_ai` (bool)
  - `title`, `problem_statement`, `input_format`, `output_format`, `sample_input`, `sample_output`, `constraints`, `marks` (int), `difficulty` ('easy' | 'medium' | 'hard'), `hints` (nullable)
  - `test_cases` (jsonb) — optional array of `{input, expected_output, is_hidden}`
- `homework_submissions` (only used when `mode = 'submit'`)
  - `id`, `homework_id`, `student_id`, `answers` (jsonb), `submitted_at`, `is_late`, `marks_obtained`, `teacher_feedback`, `reviewed_by`, `reviewed_at`, `status`

RLS + GRANTs:
- Admins full CRUD on `homework` + `homework_questions`
- Students SELECT published homework + questions (hidden test cases stripped via a view/RPC)
- Students insert/update own submissions; admins read/grade all

## 2. Server functions (`src/lib/homework.functions.ts`)

- `listHomeworkAdmin`, `getHomework`, `createHomework`, `updateHomework`, `deleteHomework`, `publishHomework`
- `addQuestion`, `updateQuestion`, `deleteQuestion`, `reorderQuestions`
- `generateHomeworkWithAI({ topic, difficulty, count, marksPer, questionType, instructions, dueAt })` — calls Lovable AI Gateway (`google/gemini-3-flash-preview`), returns generated questions
- `refineQuestionWithAI({ questionId })` — returns `{ before, after }` diff-friendly payload; teacher accepts/rejects on the client
- `applyRefinement({ questionId, accepted })`
- Student side: `listPublishedHomework`, `getHomeworkForStudent` (strips hidden test cases), `submitHomework`

## 3. Admin UI — `/_authenticated/admin_.homework`

Landing page with two big cards:
```
┌─────────────────────┐  ┌─────────────────────┐
│ ✍ Create Manually   │  │ ✨ Generate with AI │
│ Design each Q your… │  │ Let AI draft Qs from│
└─────────────────────┘  └─────────────────────┘
```
Below: tabs for **Drafts** and **Published** listing existing homework.

Sub-routes:
- `/admin/homework/new/manual` — form: homework meta + repeatable question editor (add/edit/delete/reorder). Save as draft / Publish.
- `/admin/homework/new/ai` — AI form (topic, difficulty, count, marks, question type, instructions, due). Generate → preview list → edit any question inline → Save/Publish.
- `/admin/homework/$id` — edit existing (both manual + AI questions live together). Every question card shows a **Refine with AI** button.

Refine flow (modal):
- Side-by-side **Before / After** diff
- Buttons: `Accept`, `Reject`, `Edit Manually`, `Regenerate`

## 4. Student UI

- Rename Practice nav item → **Homework** (route `/homework`), remove old Practice routes/links.
- List published homework (title, mode badge, due date, marks, difficulty).
- Detail page: shows questions. If `mode='submit'`, provides submission form + due-date enforcement. If `mode='self_solve'`, provides a solve UI similar to today's Practice.

## 5. Remove Practice tab

- Remove Practice nav entry from student + admin sidebars.
- Delete/redirect `/practice*` routes to `/homework`.
- **Leave `src/lib/questions.ts` untouched** — it stays in the codebase but no route surfaces it.

## 6. AI safety

- All AI calls happen inside `createServerFn` handlers using `LOVABLE_API_KEY` server-side.
- Loading + error states on every AI action ("AI could not generate questions right now. Please try again.").

## 7. Styling

- Reuses existing Py Kidda Hub tokens (`bg-card`, `border-border`, primary accents).
- Cards get `transition-transform hover:scale-[1.02] hover:border-primary` and existing shadow tokens — no custom glow.

## Technical notes

- New route files: `src/routes/_authenticated/admin_.homework.tsx`, `admin_.homework.new.manual.tsx`, `admin_.homework.new.ai.tsx`, `admin_.homework.$id.tsx`, `_authenticated/homework.tsx`, `_authenticated/homework.$id.tsx`.
- One migration file creating all 3 tables with GRANTs + RLS + `updated_at` trigger.
- AI generation uses `google/gemini-3-flash-preview` with structured JSON output.
- Refinement stores the "after" candidate in component state only — nothing is written until teacher clicks Accept.
- Since this is a large build, I'll ship it in this order and report progress: (1) migration, (2) server fns, (3) admin manual flow, (4) admin AI flow + refine, (5) student side + Practice removal.

Reply "go" to proceed, or tell me anything to adjust (e.g. simpler UI, skip submissions, keep Practice nav pointing to Homework as a redirect only, etc.).

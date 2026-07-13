# Mock test security overhaul

You picked full overhaul, DB-backed built-in questions, Pyodide + server-graded outputs. That's roughly ~4,000 lines of existing runner/result/fetch code plus new tables and server functions. To keep you unblocked for testing and avoid one giant broken change, I'll ship it in four landings. Each one leaves the app working. After each landing you tell me "go" and I do the next.

## Landing 1 — Kill the answer leak (highest-priority security win)

Goal: no correct answers, hidden inputs, expected outputs, or grading formulas reach the browser. Grading still happens in this landing but exclusively on the server.

Database (one migration):
- `mock_tests`, `mock_questions`, `mock_hidden_cases` tables. RLS: only server (service role) reads full rows; students read nothing directly.
- Seed migration copies everything currently in `src/lib/questions.ts` (questions, options, code tests, expected outputs, solutions) into those tables.
- AI question tables (`ai_mock_questions`): add sanitized-view server fn — do not drop columns, existing admin flows still need them.

Server functions (new, `src/lib/mock-secure.functions.ts`):
- `getStudentMockTest({ testId })` — returns only `{ id, type, prompt, options (no correctness flag), starter_code, sample_input, sample_output, marks, difficulty }` per question.
- `gradeMockAnswer({ attemptId, questionId, studentCode, clientOutputs? })` — server holds the hidden tests and expected outputs; compares client-run Pyodide stdout against them; returns only `{ passed, total, marksAwarded }` — never `expected`.
- `finalizeMockAttempt({ attemptId })` — computes total from server-stored per-question marks; writes `mock_results` server-side.
- Same three fns for AI mock tests, sharing helpers.

Client changes:
- `src/lib/questions.ts` → deleted from client bundle (moved to `questions.server.ts`, imported only by server fns and the seed migration).
- Both runners (`mock-tests.$testId.run.tsx`, `mock-tests.ai.$testId.take.tsx`): fetch via sanitized fn, submit code + client-run outputs, receive only safe result. Score/grade fields removed from client submission payloads.
- Both result pages: read final result from `mock_results` (already server-owned after this landing) — no client-side percentage math.

## Landing 2 — Attempt lifecycle (one active attempt + scheduled-window enforcement)

- New table `mock_test_attempts` with fields you listed (status, started_at, submitted_at, last_heartbeat_at, locked_until, auto_submit_reason, final_score, grade). RLS: student reads own; only server writes.
- `startMockAttempt({ testId })` — returns existing `active` attempt if one exists; otherwise creates one. For scheduled tests, enforces `now BETWEEN scheduled_start_at AND scheduled_end_at` on the server. Rejects if a `submitted` attempt exists and reattempts aren't allowed.
- `finalizeMockAttempt` gains: verify ownership, verify not already submitted, mark `submitted`, freeze score.
- Runners: call `startMockAttempt` at entry, thread `attemptId` through every grade/finalize call.

## Landing 3 — Heartbeat + auto-submit + violation logging

- New tables `mock_test_responses` (per-question grading trail) and `mock_violation_logs`.
- `mockTestHeartbeat({ attemptId })` — updates `last_heartbeat_at`, returns safe status. Called every 15s from runner.
- `pg_cron` job every minute: any `active` attempt with `last_heartbeat_at < now() - 60s` → mark `auto_submitted`, finalize server-side from stored responses, log violation `heartbeat_stopped`.
- Runners: heartbeat interval + connection-warning banner + "Secure Mode Active" badge. Stop on finalize.

## Landing 4 — Result-page gating + polish

- Add `show_correct_answers_after_submit` (default `false`) to `mock_tests` / `ai_mock_tests`.
- Result pages: when `false`, show score/grade/passed counts and generic feedback only. When `true`, reveal correct answer + explanation for MCQ; for code, only pass/fail counts per hidden test (never hidden inputs/outputs).
- Admin toggle in existing admin AI-mock UI.
- Final sweep: grep for `correct_answer`, `expected`, `code_tests`, `solution`, `final_score`, `marks_obtained` in client bundle to confirm nothing leaks. Bundle inspection with `bun run build && rg` in `dist/`.

## Technical notes

- Pyodide stays client-side. Server grading trusts *outputs*, not scores. Because the student never sees hidden inputs or expected outputs, they can't craft matching stdout for hidden cases — this is the security boundary you approved.
- Migrations follow the required 4-step order (CREATE → GRANT → RLS → POLICY). No `service_role` grants on student read paths.
- All new server fns use `requireSupabaseAuth` + explicit ownership checks; `supabaseAdmin` is imported inside handlers only.
- No changes to admin AI-mock generation flow; sanitization is a separate student-facing fetcher.
- Existing `submitMockResult`/`submitAiMock*` endpoints will be deprecated (kept for one landing then removed) so in-flight attempts don't break.

## What ships this turn

Landing 1 only. That immediately removes the answer-key leak from the browser bundle, which is the actual "student can inspect and cheat" risk you opened with. Landings 2–4 build the exam-integrity layer on top.

Reply "go" to start Landing 1, or tell me to reorder / drop anything.

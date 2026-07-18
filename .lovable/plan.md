# Pyko AI — Guide / AI Teacher / All-Rounder Upgrade

## Goals
Add three student-facing modes to the existing Pyko panel, backed by verified PY Kidda knowledge and the trusted Practice code-corrector pipeline. Keep the mascot, draggable panel, auth, RLS, budgets and assessment lockout untouched. Do not enable the privileged `teacher` (Teacher Copilot) mode for students.

## Mode → internal mapping
- 🧭 Guide → internal `guide` (unchanged)
- 👨‍🏫 AI Teacher → internal `tutor` (student-safe; distinct from privileged `teacher`)
- ✨ All-Rounder → new internal `allrounder` (server-side classifier routes to guide / tutor / corrector / coach)

The existing `teacher` mode stays gated to admins via `assertModeAllowedForUser` and is never selectable from the panel.

## Server changes

**`src/lib/pyko/schemas.ts`**
- Add `"allrounder"` to `PykoMode` enum.
- Add optional `code`, `language`, and `subMode` fields to `PykoChatInput` so AI Teacher/All-Rounder can pass pasted Python for correction without leaking hidden tests.

**`src/lib/pyko/knowledge.server.ts`**
- Expand `PYKO_ROUTE_FACTS` with full verified process walkthroughs derived from actual routes and functions:
  - homework create/assign/grade (from `src/routes/_authenticated/admin.homework.*` and `src/lib/homework.functions.ts`)
  - practice question create/publish (from `admin.practice.index.tsx` + `practice-admin.functions.ts`)
  - scheduled mock tests (from `admin_.ai-mock.tsx` + `ai-mock.functions.ts` + `mock-tests.scheduled.$testId.tsx`)
  - assignment flow, submissions, grading (from `assignments.*`)
  - streaks, badges, leaderboard rules (already partially present)
- Add a `getProcessWalkthrough(topic)` lookup returning a numbered end-to-end description for the "detailed how do I..." questions listed in the spec. Guide mode injects the matching walkthrough into the system prompt when the user message matches a topic keyword.

**`src/lib/pyko/prompts.ts`**
- Bump `PROMPT_VERSION` to `pyko.modes.v3`.
- Rewrite `guide` prompt: brief for navigation, detailed step-by-step when the user asks a process question; mention only verified facts; if asked Python teaching, reply with the fixed hand-off line.
- Rewrite `tutor` prompt to match the spec's AI Teacher structure (direct answer → definition → why → steps → syntax → example → output → analogy → common mistakes → improved example → try-this → next step) and to auto-detect pasted code and switch into corrector output.
- Add `allrounder` prompt: instruct the model to classify the request and answer with a header label (🧭 / 👨‍🏫 / 🛠 / 📈).
- Sharpen `corrector` prompt: enforce structured output (error type, line, plain explanation, why, red/green diff, minimal fix, full fixed example, expected output, prevention tip, follow-up); forbid revealing hidden tests / reference solutions; never claim correctness without validator confirmation.

**`src/lib/pyko/policy.server.ts`**
- Extend `assertPykoEnabled` to accept `allrounder` and check `pyko_mode_allrounder` flag.
- Keep the `teacher` role gate exactly as-is.

**`src/lib/pyko/router.functions.ts`**
- Accept `allrounder`; when set, run a lightweight classifier (single small model call OR heuristic on the message) that picks `guide|tutor|corrector|coach`, then reuses the same generation path with that mode's system prompt. Response includes the resolved sub-mode so the UI can render the label.
- When `code` is passed (AI Teacher or All-Rounder→corrector), append it to the user message inside a fenced block. Never accept `hiddenTests`, `referenceSolution` or similar fields (schema rejects them via `.strict()`).
- Keep existing conv ownership, mode-mismatch, history-in-chronological-order, budget, telemetry logic. The mode stored on the conversation is the top-level mode (`guide`, `tutor`, `allrounder`) so switching modes forces a new conversation.

**Corrector pipeline reuse**
- No new Pyodide worker. The existing `AiErrorCorrector` used by `CodeRunner`/Practice already calls a corrector server fn — verify and route AI Teacher/All-Rounder code-error responses through the same `pykoChat` call in corrector sub-mode so behavior is identical.

## Client changes

**`src/components/PykoFloatingPanel.tsx`**
- Add a mode selector strip at the top of the panel body: three pill buttons (Guide / AI Teacher / All-Rounder) with icon, name, one-line description, distinct accent colors, and a selected-state ring.
- Persist selection in `localStorage` (`pykidda:pyko-mode`).
- Switching modes calls `newConversation()` (clears `convId` + messages) so contexts never mix.
- When response includes a `subMode` (All-Rounder), render a small label above the assistant message ("🧭 Guide response", "👨‍🏫 Teaching response", "🛠 Code correction", "📈 Progress guidance").
- Render assistant markdown (headings, numbered steps, code blocks). Add a Python-aware red/green diff renderer for corrector responses (parse fenced ```diff or `- ` / `+ ` lines) plus Copy button.
- Keep mascot, drag logic, viewport clamping, minimize/maximize, and assessment-route hide behavior unchanged.

## Database migration
- Insert `pyko_mode_allrounder` row (default true) into `pyko_feature_flags`.
- Verify `pyko_mode_tutor` and `pyko_mode_guide` rows exist; insert defaults if missing.
- No schema changes to `pyko_conversations` / `pyko_messages` (existing `mode` column is text).

## Security requirements met
- Zod validates mode (strict enum).
- User + role derived server-side inside `requireSupabaseAuth`.
- Server injects verified page context / knowledge; client-sent context is length-capped.
- `LOVABLE_API_KEY` stays server-side (`provider.server.ts`).
- Hidden tests and reference solutions are never accepted by the schema and never fetched by Pyko.
- `assertNotInActiveAssessment` runs before every mode, budget included — a blocked request throws before `enforceAndIncrementBudget`, so no budget consumed on lockout. (Fix: reorder policy checks so assessment check runs before budget increment — currently already correct.)
- `teacher` (Teacher Copilot) stays admin-only via `assertModeAllowedForUser`; not offered in UI.
- Per-mode feature flags let us dark-launch each mode independently.
- History load already ordered `created_at desc limit 20` then reversed — chronological, latest window. Kept.
- Timeouts (`AbortSignal.timeout(25_000)`), rate limits (`pyko_touch_budget`), and structured error responses already present.

## Tests
Add `src/lib/pyko/__tests__/modes.test.ts` (vitest) covering:
1. Zod accepts `guide|tutor|allrounder|corrector|coach|teacher`; rejects unknown.
2. Zod rejects `hiddenTests`/`referenceSolution` extras (strict).
3. `guideKnowledgeBlock` includes homework/practice/mock/streak facts.
4. `getProcessWalkthrough("create homework")` returns a numbered end-to-end string.
5. Prompt builder returns distinct system prompts per mode; teacher prompt contains the admin guard clause.
6. `assertModeAllowedForUser` throws for `teacher` when has_any_role returns false; passes for admin.
7. `assertPykoEnabled` throws when master flag off, even if mode flag on.
8. All-Rounder classifier heuristic routes "where is homework" → guide, "explain for loop" → tutor, fenced ```python``` block → corrector, "am I improving?" → coach.

Run `bunx vitest run src/lib/pyko` and `tsgo`. Manually smoke via Playwright: open panel, switch to AI Teacher, send "explain for loops", verify structured answer.

## Files touched
- `src/lib/pyko/schemas.ts`
- `src/lib/pyko/prompts.ts`
- `src/lib/pyko/knowledge.server.ts`
- `src/lib/pyko/policy.server.ts`
- `src/lib/pyko/router.functions.ts`
- `src/components/PykoFloatingPanel.tsx`
- `src/lib/pyko/__tests__/modes.test.ts` (new)
- Migration: `pyko_feature_flags` seed for `pyko_mode_allrounder` / `pyko_mode_tutor` / `pyko_mode_guide`.

## Out of scope (unchanged)
- Existing mascot, drag/minimize/maximize, auth flow, RLS on `pyko_*` tables, budget RPC, assessment lockout RPC, mock-test routes, Practice `CodeRunner`, badge/streak logic, notifications.

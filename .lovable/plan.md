# Admin/Teacher Activity Audit Log

## What we're building

A `admin_activity_logs` table plus a reusable `logAdminActivity()` helper that admin/teacher server functions call after successful actions. A new **Activity Logs** tab in the Admin dashboard shows the logs with summary cards, filters, search, a detailed modal, and CSV/PDF export.

## 1. Database (single migration)

Table `public.admin_activity_logs`:

- `id` (uuid PK)
- `actor_id` (uuid, FK-style to auth.users, indexed)
- `actor_name`, `actor_email`, `actor_role` (text — snapshot at time of action)
- `action_type` (text, indexed) — canonical slug, e.g. `homework.created`, `mock_test.published`, `student.roll_updated`, `notification.deleted`, `ai.homework_generated`
- `action_description` (text) — human sentence like *"Dr. Pawar created homework: Python Loops Assignment"*
- `module_name` (text, indexed) — one of: `homework`, `mock_test`, `announcement`, `notification`, `student`, `marks`, `report`, `settings`, `ai`
- `target_id` (text), `target_title` (text)
- `related_student_id` (uuid, indexed)
- `old_value` (jsonb), `new_value` (jsonb) — nullable
- `metadata` (jsonb) — free-form (ip, user_agent, extra ctx)
- `status` (text, default `success`) — `success` | `failed`
- `created_at` (timestamptz, default now(), indexed DESC)

Indexes: `created_at DESC`, `(actor_id, created_at DESC)`, `(module_name, created_at DESC)`, `(action_type, created_at DESC)`, `(related_student_id, created_at DESC)`.

RLS + grants:
- `GRANT SELECT ON ... TO authenticated; GRANT ALL ... TO service_role;` (no anon).
- Enable RLS.
- Policy: **admin sees all** (`has_role(auth.uid(),'admin')`).
- Policy: teachers/authenticated users see **only their own** rows (`actor_id = auth.uid()`).
- No INSERT/UPDATE/DELETE policies for `authenticated` — writes go through a `SECURITY DEFINER` RPC only. Service role (used by the logger server fn) bypasses RLS.

RPC `public.log_admin_activity(...)` (SECURITY DEFINER):
- Validates `auth.uid()` is set.
- Snapshots actor name/email/role from `profiles` + `user_roles`.
- Inserts a row and returns its id.

## 2. Server helper

New file `src/lib/audit-log.server.ts` exporting `logAdminActivity({ actionType, description, moduleName, targetId?, targetTitle?, relatedStudentId?, oldValue?, newValue?, metadata?, status? }, ctx)` — takes the caller's authenticated `supabase` client (from `requireSupabaseAuth`) and calls the RPC. Wrapped in try/catch so a logging failure never breaks the primary action; logs to console on failure.

New server function `src/lib/audit-log.functions.ts`:
- `listAuditLogs({ from?, to?, actorId?, module?, actionType?, studentId?, search?, limit?, offset? })` — admin only; returns `{ rows, total }`. Non-admins get their own rows only.
- `getAuditLogSummary()` — admin-only counts for today: total, homework, mock_test, student, ai.

## 3. Wire logging into existing admin actions

Add `logAdminActivity(...)` calls after these succeed. All these server fns already use `requireSupabaseAuth`:

- Homework: `createHomework`, `updateHomework`, `publishHomework` / `unpublish`, `deleteHomework` (in `src/lib/homework.functions.ts`)
- Mock tests: create/publish/update-schedule/delete, plus AI-generated (`src/lib/mock-tests.functions.ts`, `src/lib/ai-mock.functions.ts`)
- Announcements: create + schedule (`src/lib/announcements.functions.ts` or equivalent)
- Notifications: delete one / delete all
- Students: assign roll number, update student info
- Marks + teacher comments: grading server fns (homework/assignment/mock)
- Report downloads: student-report-pdf, overview-pdf
- Settings: result visibility, attempt limit
- AI: generate homework, generate mock test, refine question

For each, capture old/new values where feasible (e.g. schedule change, marks change). No log on validation-failed paths.

## 4. Admin UI

New file `src/components/AuditLogsTab.tsx`, added as a tab in `src/routes/_authenticated/admin.tsx` (sidebar entry **📜 Activity Logs**).

Layout:
- 5 summary cards (Total today, Homework, Mock test, Student, AI).
- Filter bar: date range (from/to), actor select (loaded from distinct actors), module select, action-type select, student search input, free-text search.
- Table columns: Date & Time, Teacher/Admin (name + role badge), Module (icon + label), Action (badge), Target, Student (if any), Details (view button).
- Row click → dialog modal with full details, JSON diff of old/new values, metadata block.
- Export buttons: **CSV** (client-side from current filtered rows) and **PDF** (via existing `pdf-lib`/report util pattern; if not present, a simple `window.print()` fallback on a printable view).
- Pagination (50/page).

Uses existing dark-theme card + table components. Badges color-mapped per module.

## 5. Security

- All reads go through `listAuditLogs` server fn which enforces admin-vs-self.
- All writes go through the SECURITY DEFINER RPC — no direct client writes possible.
- No UPDATE/DELETE policies exposed to authenticated users → logs are immutable from the app.

## Technical Notes

- The logger is best-effort; wrap each call in `try { await logAdminActivity(...) } catch (e) { console.error("[audit]", e) }` so failures never break the real mutation.
- For AI actions, log after the AI response is stored, not on error.
- `metadata.ip` from `getRequestIP()` and `metadata.user_agent` from `getRequestHeader("user-agent")` inside each server fn (small helper `captureRequestContext()` in `audit-log.server.ts`).
- PDF export uses the same library pattern as existing report PDFs (will confirm on implementation and fall back to CSV-only if the library isn't Worker-safe on the client).
- No new npm packages expected beyond what's already installed.

## Rollout order

1. Migration (table + RLS + RPC) — one call.
2. `audit-log.server.ts` + `audit-log.functions.ts`.
3. Instrument existing admin/teacher server fns with logging calls.
4. `AuditLogsTab.tsx` + wire into admin sidebar.
5. Verify: create homework → check log; change mock schedule → check old/new values; try as student → 403 empty; run typecheck.

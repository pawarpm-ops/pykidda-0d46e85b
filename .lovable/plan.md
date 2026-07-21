# PY Kidda — UI Consistency & Responsive Overhaul

This is a large, cross-cutting UI-only change. To keep it safe and reviewable, I'll ship it in phases and check in after each phase before continuing. No routes, permissions, DB logic, popups, assessment rules, sidebar options, or Pyko behavior will change.

## Hard exclusions (locked)
- **Do not** add Practice to the desktop sidebar.
- **Do not** touch popups, modals, onboarding, What's New, review popup, streak popup, Badge Toaster, Pyko, or Report Problem behavior/timing.
- No route renames, no DB migrations, no auth changes, no grading/anti-cheat changes.

## Phase 1 — Design foundation (this turn if approved)
1. Audit `src/styles.css`, shared UI in `src/components/ui/*`, `SiteHeader`, sidebar, and duplicated card/button implementations. Record findings in `.lovable/ui-audit.md`.
2. Extend semantic tokens in `src/styles.css` (surfaces, status, focus ring, shadows, radii, motion durations, z-index) — additive only, no rename of existing tokens.
3. Add/normalize shadcn variants: Button (primary/secondary/outline/ghost/destructive/success/icon/link), Card (standard/interactive/elevated/glass/status/destructive), Badge (status set), Input/Select/Textarea sizing, focus-visible ring.
4. Add typography scale utilities (display/h1/h2/h3/card/body/meta/code) using `clamp()`.
5. Add global `prefers-reduced-motion` guards.

## Phase 2 — Shared shell
- Standardize page header component (title + optional breadcrumb + primary action).
- Restyle existing desktop sidebar visuals only (no option changes).
- Add mobile bottom nav (Home, Practice, Homework, Tests, More) with role-aware visibility, safe-area insets, hidden during active assessments; "More" sheet exposes existing destinations only.
- Standard loading/empty/error state components.
- Verify theme persistence + no FOUC (already patched in `__root.tsx`).

## Phase 3 — Core student pages
Apply shared shell + variants to: Login, Dashboard, Practice, Code Runner, Mock Tests, Homework, Leaderboard, Analytics, Profile, Notifications, Teacher Comments, Help. Visual-only edits; keep data queries, routes, and dialogs intact.

## Phase 4 — Special interfaces
Pyko responsive shell (desktop panel / tablet overlay / mobile sheet) — presentation only, no logic changes. Onboarding visual alignment. Admin workspace: standardize header, tables, filters, empty/loading/error states; visually group existing 12 sections without changing routes.

## Phase 5 — Quality gate
Accessibility audit (contrast, focus, aria), responsive audit at 320/360/390/430/768/1024/1280/1440, reduced-motion audit, low-end perf pass (reduce mobile blur, lazy assets), theme audit both modes, typecheck + build.

## Technical notes
- Tailwind v4: tokens live in `src/styles.css` under `@theme` / `@theme inline`; custom utilities via `@utility`; no `tailwind.config.js`.
- All colors via semantic tokens — no `text-white`, `bg-[#...]`, no hardcoded hex in components.
- shadcn primitives kept; variants extended via `cva`.
- Mobile bottom nav gated by `useAssessmentActive`-style check already used to suppress popups, so it hides during mock tests.
- I will not introduce new libraries.

## What I'll do this turn if you approve
Only **Phase 1** (foundation + audit doc). No page-level rewrites yet. I'll show you the token/variant changes and a summary, then ask before moving to Phase 2.

## Deliverable per phase
Short changelog + files touched + any screenshots relevant to that phase. Full completion report after Phase 5.

Approve to start Phase 1, or tell me to reorder / narrow scope (e.g. "skip mobile bottom nav" or "start with Admin tables only").

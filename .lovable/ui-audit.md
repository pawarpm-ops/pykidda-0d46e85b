# PY Kidda UI Audit — Phase 1

## Shared UI (kept, extended)
- `src/components/ui/button.tsx` — added `success`, `warning`, `info` variants + `touch` size.
- `src/components/ui/badge.tsx` — added `success`, `warning`, `info` variants.
- `src/components/ui/card.tsx` — unchanged (variants applied via className helpers `pk-surface-elevated`, `pk-status-*`).
- `src/components/ui/input.tsx` — unchanged; already token-driven.

## Design tokens added (additive, both themes)
- Status: `--success`, `--warning`, `--info` (+ foregrounds), wired via `@theme inline`.
- Surface: `--surface`, `--surface-elevated`, `--surface-muted`.
- Motion: `--duration-fast/base/slow`, `--ease-standard`.
- Elevation: `--shadow-card`, `--shadow-elevated`.
- Z-index: `--z-sticky/header/sidebar/mobile-nav/overlay/dialog/toast/pyko`.

## Utilities added
- Typography: `pk-display`, `pk-h1`, `pk-h2`, `pk-h3`, `pk-body`, `pk-meta`, `pk-code` (all `clamp()`-scaled).
- Surfaces: `pk-surface`, `pk-surface-elevated`, `pk-surface-muted`.
- Status: `pk-status-success/warning/info/danger` (left-border accent).
- Perf/mobile: `pk-blur-lite` (mobile disables backdrop-filter), `pk-touch` (44px), `pk-safe-bottom`.
- Global `prefers-reduced-motion` guard added (disables long transitions/animations app-wide).

## Preservation confirmed
- No route, permission, DB, popup, sidebar option, Pyko, or assessment logic touched.
- Existing tokens (`--primary`, `--card`, `--sidebar-*`, etc.) untouched.
- Existing utilities (`card-glow`, `btn-glow`, `hover-glow`) untouched.

## Known duplications to consolidate in later phases
- Dashboard hero orbs (multiple decorative animations) — reduce in Phase 3.
- Admin tables hand-styled per section — consolidate in Phase 4.
- Multiple hero gradients on Login + Dashboard — align on `--gradient-sunrise`.

## Phase 2 targets
- Page shell component (title + optional breadcrumb + action).
- Mobile bottom nav: Home, Practice, Homework, Tests, More (role-aware, hidden during assessments).
- Standard Loading/Empty/Error state components.

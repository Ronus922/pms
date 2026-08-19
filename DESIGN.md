# PMS Design — Source of Truth

**Mandatory visual reference:** [`design-ref/rooms-calendar.md`](design-ref/rooms-calendar.md)
(extracted from the rendered Claude Design file `יומן חדרים נקי`).

All future UI work on the **Rooms-Calendar (תפוסה)** and the **main Sidebar**
MUST follow `design-ref/rooms-calendar.md`. It reflects the app's existing
"GuestHub" system — use the existing tokens, do **not** fork the palette.

## Core tokens (from `app/styles/base.css`)
- **Primary:** `--primary` `#1e40af` · active/hover tint `#eff6ff`.
- **Page bg** `#f6f8fb` · **card** `#ffffff` · **border** `#e2e8f0`.
- **Font:** Noto Sans Hebrew (`--font-headline` / `--font-body`).
- **Card radius** 20–22px (`rounded-2xl` / `.kpi-card`) · soft shadow `0 1px 3px rgba(0,0,0,.04)`.
- **Weekend tint** amber-50 · **muted text** `#64748b`.

## Iron rules (unchanged)
RTL-first · mobile-first · TypeScript strict · ≥44px touch targets ·
content never touches its border (padding) · reuse shared components ·
`globals.css` is a table of contents (CSS lives in `app/styles/*`).

## Hard constraints when restyling the calendar
Never break: reservations, availability checks, drag/drop create/move/resize,
room closing, room statuses, pricing / min-night indicators, existing routes
and data flow. Design/visual layer only.

> Reviewed 2026-07-02 against the rendered `יומן חדרים נקי` screenshot.
> The global TopBar already matches the design and is intentionally unchanged.

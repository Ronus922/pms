# Changelog — GuestHub PMS

> All project changes logged here. Newest entries at top.
> Format: `## YYYY-MM-DD — Summary`

---

## 2026-05-08 — Azure Ethos Site-Wide Migration + Housekeeping UX overhaul

**What:** Site-wide migration from Sapphire (`#003aa0` / `#3F51B5` gradient) to **Azure Ethos** (flat `#1e40af`). Sidebar redesign matching Stitch mockup, KPI/Stat cards rebuild, Variation 3 (Subtle Card) tabs adopted across panels and filters, Sapphire gradient cleanup across non-locked modules, Housekeeping board UX overhaul (clickable filter chips, primary "new task" CTA, room/area target picker, visible card borders).

**Why:** User requested unification of design system per new Stitch design specs. Old Sapphire gradient looked dated and inconsistent. Tabs were per-page custom inline — replaced with Variation 3 component pattern. Housekeeping chips were `<span>` displays only — converted to working filters.

**Key decisions (all confirmed by user):**
- **Single primary color:** `#1e40af` (was `#003aa0` + `#3F51B5` gradient + temporary `#304aae` for SidePanel)
- **Pill-tab/pill-filter CSS classes:** lavender Sapphire → Azure Ethos (white-card on `#f4f2fc` track, active text `#1e40af`). Old "keep lavender per memory" preference explicitly overridden by user.
- **Reservations module remains LOCKED** — files in `components/reservations/` and `app/(dashboard)/reservations/page.tsx` were NOT touched. Inline Sapphire gradient strings remain in those files. They get the new color indirectly via `--primary` CSS var only.
- **TopBar cleanup:** "הזמנה חדשה" button removed; moved to Sidebar.

**Files changed (CSS / tokens):**
- `app/styles/base.css` — `--primary` `#003aa0` → `#1e40af`; `--primary-container` `#3F51B5` → `#1e40af`; `--ring` `#003aa0` → `#1e40af`; `.pill-tab` / `.pill-filter` re-styled to Azure Ethos (transparent track, white-card active, `#1e40af` text)
- `app/styles/reports.css` — `.report-quick-pill.active` and `.report-export-btn` Sapphire gradient → flat `#1e40af`

**Files changed (Layout chrome):**
- `components/layout/Sidebar.tsx` — full rewrite to match Stitch mockup. White bg, light blue active state with 4px right indicator, primary "הזמנה חדשה" CTA at top, 14 nav items (incl. Finance/Suppliers/Reports), bottom system links, red logout, **floating circular toggle on left edge** (`absolute left-[-14px]`)
- `components/layout/TopBar.tsx` — removed "הזמנה חדשה" button + divider; avatar `bg-primary-container` → `bg-[#1e40af]`; reservation-form-store import deleted
- `components/shared/SidePanel.tsx` — header `bg-[#304aae]` → `bg-[#1e40af]`
- `components/staff/EmployeeSidePanel.tsx` — custom header `bg-[#304aae]` → `bg-[#1e40af]`; tabs (פרופיל/הרשאות/פעילות/משימות/דיווח שעות) wrapped in Variation 3 track

**Files changed (KPI/Stat cards — Azure Ethos card spec):**
- `app/(dashboard)/dashboard/page.tsx` — 4 KPI cards rebuilt with circular SVG progress for "תפוסה". Spec: `bg-white border border-[#dad9e3] rounded-xl p-6 min-h-[140px]`, value `text-[2.25rem] font-bold text-[#1c1b1f]`, success `#15803d` / error `#b91c1c`
- `components/maintenance/MaintenanceStats.tsx` — 6 stat cards full rewrite (open/unassigned/urgent/inProgress/waiting/completedToday). Replaced unrendering icons (`radio_button_unchecked`, `engineering`) with `inbox`, `build`, `task_alt`, `warning`, `schedule`, `person_off`. onClick filter behavior preserved.
- `components/reports/ReportsKpiRow.tsx` — moved from CSS class `report-kpi-card` to Tailwind inline. Trend icon container with success/error tones.

**Files changed (Tabs migration):**
- `components/shared/Tabs.tsx` — **NEW** generic component, accepts `items={value,label,icon}[]`, `value`, `onChange`, `variant: "subtle" | "segmented"`. Variation 3 = `bg-[#f4f2fc]` track + white-card active. Variation 4 = `bg-[#f1f5f9]` track + larger shadow.
- `components/channels/ChannelsShell.tsx` — 6 channel tabs migrated to inline Variation 3 (was `bg-gradient-to-l from-[#003aa0] to-[#3F51B5]` active state)
- `components/staff/StaffFilters.tsx` — role + status filter pills wrapped in two separate Variation 3 tracks (was loose `rounded-full bg-primary text-white` actives)

**Files changed (Sapphire gradient cleanup, NON-locked):**
- `components/yield/rate-grid/RoomBlock.tsx` — header gradient → flat `#1e40af`
- `components/calendar/board/DateChangeConfirmDialog.tsx` — dialog header → flat
- `components/maintenance/MaintenanceBoard.tsx` — column header `from-[#003aa0]/10 to-[#3F51B5]/10` → `bg-[#1e40af]/5`; body border `border-border/15` → `border-[#dad9e3]`; empty drop-zone border same fix
- `components/maintenance/MaintenanceTaskCard.tsx` — `border-2 border-border/15` → `border border-[#dad9e3]` + hover `border-[#1e40af]/40`
- `components/maintenance/MaintenanceWorkerView.tsx` — sticky header gradient → flat
- `components/rooms/AddTargetDialog.tsx` — dialog header gradient → flat
- `components/rooms/RoomFormDialog.tsx` — wizard header `from-[#003aa0]/10 to-[#3F51B5]/10` → `bg-[#1e40af]/10`
- `app/(dashboard)/settings/page.tsx` — 4 section headers (mass replace) gradient → flat
- `app/(dashboard)/housekeeping/page.tsx` (header section only) — board header gradient → flat; cleaner column headerClass `from-[#003aa0]/10 to-[#3F51B5]/10` → `bg-[#1e40af]/5`; column body border `border-border/15` → `border-[#dad9e3]`; task card `border-2 border-border/15` → `border border-[#dad9e3]` + hover `#1e40af/40`
- `app/(dashboard)/housekeeping/my-tasks/page.tsx` — sticky header gradient → flat; checkout-time card gradient → `bg-[#1e40af]/10`

**Files changed (Housekeeping UX overhaul):**
- `app/(dashboard)/housekeeping/page.tsx`:
  - Added `quickFilter` state (`"today" | "dirty" | "unassigned" | null`)
  - Added `passesQuickFilter()`, `filteredUnassigned`, `filteredByCleaner`, `toggleFilter()`
  - 4 stat chips (תפוסים/לא משויכים/יציאות היום/דחופים) → Variation 3 track with first chip "הכל" acting as **clear-filter** reset (uses `kpis.total` = total open tasks across all cleaners + unassigned)
  - Removed: `cleaningAreas`, `selectedAreaId`, `areaTaskSaving`, `showAreaDialog` state + `handleCreateAreaTask` + inline violet area-cleaning mini-dialog → replaced with `<CreateCleaningTaskPanel />`
  - "ניקיון אזור" violet outline button → `<button className="btn btn-primary">משימת ניקיון חדשה</button>`
  - Imports trimmed: `getAreasForPicker` + `AreaPickerItem` + `createAreaCleaningTask` removed (moved into panel)
- `components/housekeeping/CreateCleaningTaskPanel.tsx` — **NEW**. SidePanel-based create form for cleaning tasks. Dual target picker: "חדר" (uses `getRoomsForPicker` + `createManualCleaningTask`) or "אזור" (uses `getAreasForPicker` + `createAreaCleaningTask`). Pattern mirrors `CreateMaintenancePanel` (target_type/yad row, primary button "צור משימה"). Hebrew error states. SidePanel header gets the unified `#1e40af`.

**Files changed (Icon mapping additions):**
- `components/shared/Icon.tsx` — added 14 missing Lucide mappings that were rendering as empty spans: `sync_alt` → ArrowLeftRight, `swap_horiz` / `compare_arrows` → ArrowLeftRight, `add_circle` → PlusCircle, `verified_user` → ShieldCheck, `warning` → AlertTriangle, `inbox` → Inbox, `task_alt` → CheckCircle2, `checklist` → ListChecks, `hotel` → Hotel, `event_busy` → CalendarX, `radio_button_unchecked` → Circle, `engineering` / `handyman` → Wrench. Cause: Icon component is custom Lucide-based mapper, not Material Icons. Several names used in specs were unmapped → invisible icons.

**Files added:**
- `components/shared/Tabs.tsx` — reusable Tabs (Variation 3 + 4)
- `components/housekeeping/CreateCleaningTaskPanel.tsx` — new SidePanel for cleaning task creation

**Build / deploy:**
- Multiple `pnpm build` cycles + `pm2 restart pms` after each phase. Verified HTTP 200 each cycle.
- Final BUILD_ID timestamps observed: 17:52, 19:03, 19:12, 19:26, 19:39, 19:43, 19:46, 19:50, 19:55, 19:58, 20:01, 20:14, 20:19, 20:21 (UTC, 2026-05-08).
- Production server runs as PM2 process `pms` (port 3004), confirmed via `pm2 list`.

**Out of scope (not touched by design):**
- `components/reservations/**` — module LOCKED. Inline Sapphire gradient strings (`from-[#003aa0]/10`, etc.) remain. Color shifts indirectly via CSS var only.
- `app/(dashboard)/reservations/page.tsx` — same.
- All wizard step files (Step1-4, EditStep1-4) — locked.
- `components/calendar/CalendarGrid.tsx` and core calendar interaction — locked.
- `components/shared/DateInput.tsx` — locked.
- `lib/actions/create-reservation.ts`, `reservation-update.ts`, `send-reservation-email.ts` — locked.

**Known follow-ups (not done):**
- Inputs / Forms migration (border-0 vs border-40 inconsistency) — pending.
- StatusPill Azure Ethos pass — pending.
- Tables (header bg `#e1e7fa`) — pending.
- Activity Timeline / Calendar reservation bars / NumberStepper / DateInput / Toggle — pending.
- Dark mode review — pending.

---

## 2026-04-19 — Calendar resize = delta-only preview (permanent rule)

**What:** Formalised the calendar-board resize behaviour as a binding architectural rule. The committed reservation bar never stretches, dims, or reflows during a resize drag; the drag feedback is a separate delta-only overlay showing just the area being added or removed.

**Why:** Before this rule, the resize preview was a full-replacement pill at the target width. Combined with a 40 % opacity fade on the committed bar, users perceived the bar as stretching mid-drag, and the pill's guest-name text appeared to shift. Invalid resizes blanketed the whole target span, hiding where the conflict started.

**Files changed:**
- `components/calendar/board/BoardBody.tsx` — `isDragged` flag scoped to `drag.type === "move"` only.
- `components/calendar/board/PreviewLayer.tsx` — resize branch rewritten as delta-only overlay (`|newEnd − originalEnd|`), returns `null` when the delta is zero, red-tinted for shortening/invalid and green-tinted for extending.
- `components/calendar/board/use-board-interaction.ts` — move drag state now also captures `srcStartFraction` + `srcWidthCols` so the move preview matches the committed bar's fractional geometry (complementary fix for the same "visual stretch" family).

**Docs created/updated:**
- `/docs/rules/CALENDAR_RESIZE_PREVIEW.md` — full binding rule with delta formula, state table, and verification checklist.
- `/claude/PROJECT_MEMORY.md` — added row to Permanent Architecture Decisions.
- `/claude/INDEX.md` — registered the new rule doc.

**Other calendar-surface fixes landed in the same window:**
- `ReservationBlock` tooltip portaled to `document.body` (`z-[120]`) with smooth SVG speech-tail arrow.
- `BoardHeader` reordered deterministically with `dir="rtl"`; date range forced `dir="ltr"`; chevron icons follow RTL convention (`←` forward on left, `→` back on right).
- `DayCell` min-stay indicator shrunk to `text-[9.5px]` + `h-2.5 w-2.5` moon and pinned to the inline-start corner; max-stay badge hidden from cells.
- `getEffectiveRoomDailyPricingBatch` → `BoardDailyPricing` camelCase → snake_case mismatch fixed in `use-board-data.ts` normaliser; min-stay indicator now actually renders from `room_daily_pricing`.

---

## 2026-04-10 — Template Foundation Built

**What:** Built the Master Project Template Foundation on top of the PMS codebase. Created complete documentation layer, reusable database core, shared code structure, and governance system.

**Why:** This PMS serves dual purpose — production system AND master template for all future projects. The template layer ensures every future project starts with consistent rules, design, architecture, and code.

**Files created (117 template files):**
- `/docs/rules/` — 7 binding rule documents (project, design system, interactions, architecture, mobile, permissions, restrictions)
- `/docs/design/` — 8 visual design specs (colors, typography, dialogs, tables, forms, states, mobile UI, layouts)
- `/docs/components/` — 9 component standards (dialog, table, select, date-picker, form, page-layout, cards, filters, states)
- `/docs/spec-templates/` — 5 fill-in templates (module, flow, permissions, dialog, table)
- `/docs/flows/` — 5 reference CRUD flows (create, update, delete, upload, permissions)
- `/docs/database/` — 8 database docs (rules, entities, relations, enums, audit, notifications, files, permissions)
- `/database/` — enums.sql (10 enums), schema.sql (16 tables), seed.sql (roles, permissions, defaults)
- `/src/types/` — 5 TypeScript type files
- `/src/constants/` — 4 constant files (status maps, permissions, config)
- `/src/schemas/` — 4 Zod schemas (common, user, task)
- `/src/validators/` — 3 validation helpers (patterns, file)
- `/src/hooks/` — 9 shared hooks (debounce, permission, media-query, pagination, sort, filters, confirm, keyboard)
- `/src/services/` — 6 service files (supabase, auth, audit, notifications, files)
- `/src/components/shared/` — 15 production components (SidePanel, DataTable, FormField, Select, DatePicker, PageHeader, KpiCard, EmptyState, LoadingState, ErrorState, FilterBar, ActionBar, FileUpload, StatusBadge, NotificationBell)
- `/src/layouts/` — 2 layouts (AppShell, PageLayout)
- `/src/lib/helpers/` — 8 helper modules (permissions, mobile, table, filters, date, upload, notification, audit)
- `/claude/` — 11 instruction files (CLAUDE.md, START_HERE, PROJECT_MEMORY, CHANGELOG, INDEX, 6 prompt templates)
- `/README.md` — template usage documentation

**Files updated:**
- `/claude/CLAUDE.md` — added governance rules A-J
- `/claude/START_HERE.md` — added governance files to reading order

---

## 2026-04-10 — Reservations Module LOCKED

**What:** Locked the entire reservation flow — create wizard, edit panel, availability, pricing, extra charges, email, date picker, card fields, settings.

**Why:** 16+ files went through multiple iteration rounds and are production-verified. Interconnected logic across create/edit/calendar/email/settings means casual changes risk cascading breakage.

**Locked files:** 16 files across `lib/actions/`, `lib/stores/`, `components/reservations/`, `components/calendar/`, `components/shared/DateInput.tsx`, `app/(dashboard)/settings/`

**Rules established:** 10-point regression check mandatory before any change to locked files.

---

## 2026-04-10 — Availability & Email Migration

**What:** Database migration adding room availability checking and email notification support.

**Files created:**
- `scripts/migrations/2026-04-10_availability_and_email.sql`
- `lib/actions/send-reservation-email.ts`
- `components/shared/DateInput.tsx`
- `components/calendar/CellActionMenu.tsx`
- `components/reservations/ExtraChargesEditor.tsx`

**What changed:**
- `check_room_availability()` PL/pgSQL function — single source of truth for overlap detection
- `tenants.notification_email` column — stores business booking email
- Reservation create/edit flows now send email on success (fire-and-forget via `MAIL_SYSTEM_URL`)
- Success sound plays on reservation creation (`/sounds/success.wav`)

---

## 2026-04-10 — Staff Module Started

**What:** Started employee management module.

**Files created:**
- `app/(dashboard)/staff/staff-page-client.tsx`
- `components/staff/` — staff components
- `lib/actions/staff.ts`
- `lib/stores/staff-store.ts`
- `lib/types/staff.ts`
- `scripts/migrations/2026-04-10_employee_fields.sql`

---

## 2026-04-10 — Room Blocks Migration

**What:** Added room blocking functionality.

**Files created:**
- `scripts/migrations/2026-04-10_room_blocks.sql`

---

## 2026-04-09 — Housekeeping Module Built

**What:** Complete housekeeping/cleaning system — manager drag-drop board, cleaner mobile view, auto-task creation on checkout, daily cron job.

**Why:** Rooms need cleaning after checkout. Tasks must auto-create. Cleaners need a minimal mobile-only interface.

**Architecture decisions:**
- Room status is DERIVED from occupancy + cleaning_state (never manually set)
- Polling at 3-5s intervals (not Supabase Realtime — DB is plain Postgres)
- Cleaner role skips sidebar/topbar, sees only `/housekeeping/my-tasks`
- Daily cron at 08:00 creates tasks for scheduled checkouts

**Files created:**
- `scripts/migrations/2026-04-09_cleaning_tasks.sql`
- `lib/actions/cleaning.ts`
- `lib/types/cleaning.ts`
- `app/(dashboard)/housekeeping/page.tsx`

**Files updated:**
- `lib/permissions/constants.ts` — added cleaner role
- `app/(dashboard)/dashboard-shell.tsx` — cleaner role detection + redirect

---

## 2026-04-09 — Reservation Panel Architecture

**What:** Established that create wizard and edit panel share identical visual structure — same steps, same cards, same footer. Only the data source differs.

**Why:** Prevents UI drift between create and edit modes. User sees the same interface regardless of mode.

---

## 2026-04-09 — Field Locking for External Reservations

**What:** External reservations (from channel managers like Booking.com) have locked/warning fields. 3 field states: editable, locked (lock icon + tooltip), warning (amber, editable with confirmation).

**Why:** External data should not be accidentally overwritten. But admins need override capability with awareness.

---

## 2026-04-08 — Guests Page Rebuilt

**What:** Rebuilt guests page as reservation-centric operational screen. 7 columns, specific filters, 19 old files deleted.

**Why:** Previous guests page was a standalone contact list. PMS needs guests tied to reservations — "who is staying, when, where."

---

## 2026-04-08 — Central Settings Hub

**What:** Created `lookup_categories` + `lookup_items` tables, settings UI, `useLookup` hook.

**Why:** Eliminated 31+ duplicate hardcoded dropdown arrays across 17+ files. Single source of truth for all dropdown values.

**12 categories seeded:** reservation_source, reservation_status, payment_status, payment_method, board_type, language, country, currency, guest_tag, room_tag, cancellation_policy, attachment_category

**Status:** DB and settings UI complete. Form migration to `useLookup()` still pending.

---

## 2026-04-08 — Single Source of Truth Architecture

**What:** Established the iron rule: ONE entity = ONE panel = ONE config = ONE validation schema. No duplicate windows/forms/modals for the same entity.

**Why:** Multiple windows for the same entity causes field drift, validation inconsistency, and maintenance nightmare.

---

## 2026-04-08 — GuestHub PMS Initial Commit

**What:** Full application with all modules — calendar, reservations, guests, rooms, housekeeping, permissions, settings.

**Files:** Commit `af2b760` — "feat: GuestHub PMS — full application with all modules"

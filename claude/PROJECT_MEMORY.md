# Project Memory — GuestHub PMS

> Permanent decisions, conventions, and non-negotiable rules for the GuestHub PMS project.
> This file persists across all Claude sessions. Update it when a permanent decision is made.
> Never delete entries — mark obsolete ones with `[SUPERSEDED]` and link to the replacement.

---

## Project Identity

- **Name:** GuestHub PMS
- **Type:** Property Management System (hotel, B&B, vacation rental)
- **URL:** pms.bios.co.il
- **Stack:** Next.js 15, TypeScript strict, Supabase Auth + plain PostgreSQL, Tailwind CSS v4, Zod, Zustand, nuqs
- **Design System:** Azure Ethos (primary `#1e40af`, font Noto Sans Hebrew). Replaced Sapphire (`#003aa0` / `#3F51B5` gradient) on 2026-05-08. CSS var `--primary` is the single source of truth.
- **Direction:** RTL-first, mobile-first
- **Language:** Hebrew UI, English code
- **Hosting:** VPS with PM2, Nginx reverse proxy
- **Database:** PostgreSQL (not Supabase hosted — plain Postgres with Supabase Auth only)

---

## Active Modules

| Module | Page Route | Status | Notes |
|--------|-----------|--------|-------|
| Calendar | `/calendar` | Production | Occupancy board with drag-resize reservation bars |
| Reservations | `/reservations` | **LOCKED** | Full create/edit wizard, availability, pricing, email. See locked rules below |
| Guests | `/guests` | Production | Reservation-centric table, 7 columns, rebuilt 2026-04-08 |
| Rooms | `/rooms` | Production | Room grid with status cards, CRUD via SidePanel |
| Housekeeping | `/housekeeping` | Production | Manager drag-drop board + cleaner mobile view with 3s polling |
| Staff | `/staff` | In progress | Employee management with role assignment |
| Permissions | `/permissions` | Production | Role-permission matrix editor |
| Settings | `/settings` | Production | Central settings hub — lookup_items, notification_email, all dropdowns |
| Reports | `/reports` | Planned | Occupancy, revenue, guest statistics |
| Finance/Billing | `/finance`, `/billing` | Planned | Payment tracking, invoicing |
| Suppliers | `/suppliers` | Planned | Supplier management |
| Documents | `/documents` | Planned | Document storage per entity |
| Maintenance | `/maintenance` | Planned | Property maintenance tasks |
| Rate Plans | `/rate-plans` | Planned | Seasonal pricing rules |
| Channels | `/channels` | Planned | Channel manager integration |
| Automations | `/automations` | Planned | Workflow automations |

---

## Locked Modules

### Reservations — LOCKED as of 2026-04-10

**What is locked:** Create wizard, edit flow, availability checking, pricing calculation, extra charges, email sending, date picker, card fields, settings notification_email.

**Why locked:** These flows went through multiple iteration rounds across 16+ files and are production-verified. Casual refactoring risks breaking interconnected logic.

**10-point regression check (mandatory before ANY change):**
1. No regression in room availability (`check_room_availability` PL/pgSQL)
2. No regression in edit flow (EditStep2Stay room replacement)
3. No regression in pricing totals (multi-room + extra charges)
4. No regression in date validation (past dates blocked UI + server)
5. No regression in email sending (customer + business, fire-and-forget)
6. No regression in notification_email settings
7. No regression in card field persistence (last 4 digits in DB)
8. No regression in TypeScript build
9. No regression in mobile behavior
10. No regression in existing RTL layout

**Key locked files:**
- `lib/actions/create-reservation.ts`
- `lib/actions/reservation-update.ts`
- `lib/actions/send-reservation-email.ts`
- `lib/stores/reservation-form-store.ts`
- `lib/stores/reservation-edit-store.ts`
- `components/reservations/steps/Step2Stay.tsx`
- `components/reservations/steps/Step3Pricing.tsx`
- `components/reservations/edit-steps/EditStep2Stay.tsx`
- `components/reservations/ExtraChargesEditor.tsx`
- `components/reservations/ReservationModal.tsx`
- `components/calendar/CalendarGrid.tsx`
- `components/shared/DateInput.tsx`

---

## Permanent Design Decisions

| Decision | Details | Date |
|----------|---------|------|
| No centered modals | All forms/wizards/details use SidePanel (55% desktop, 100% mobile, slide from left) | 2026-04-08 |
| Status = border-r-4 | Entity status shown as colored right border on cards, never dots or badges | 2026-04-08 |
| Rounded corners everywhere | Inputs/buttons `rounded-xl` (12px), cards `rounded-[20px]`, pills `rounded-full` | 2026-04-08 |
| Gap over margin | Parent controls spacing via `gap`. Children never use margin for sibling spacing | 2026-04-08 |
| Padding always | Content never touches container border. See minimum padding table in CLAUDE.md | 2026-04-08 |
| Lucide icons only | strokeWidth 1.8. No other icon library | 2026-04-08 |
| Noto Sans Hebrew | Single font. Headline variant for H1-H5 | 2026-04-08 |
| Primary gradient | `bg-gradient-to-l from-[#003aa0] to-[#3F51B5]` | 2026-04-08 [SUPERSEDED 2026-05-08 → "Azure Ethos colors"] |
| Azure Ethos colors | Primary `#1e40af` (hover `#1e3a8a`). Active light `bg-[#eff6ff] text-[#1e40af]` + 4px right indicator on sidebar. Track / hover surface `#f4f2fc`. Surface dim border `#dad9e3` (full opacity, NOT `/15`). Pill-tab CSS already migrated. NEVER reintroduce Sapphire gradient on non-locked components. Reservations module retains gradient until regression-tested migration | 2026-05-08 |
| Tabs / filter pills | Variation 3 (Subtle Card, default): track `bg-[#f4f2fc] p-1 rounded-xl` + active button `bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold rounded-lg`. Inactive `text-[#474747] font-medium`. Variation 4 (Segmented): track `bg-[#f1f5f9]`, larger shadow on active. Reusable component `components/shared/Tabs.tsx`. Used inline today in: ChannelsShell, EmployeeSidePanel, StaffFilters role+status, Housekeeping quick-filter chips, MaintenanceDetailPanel tabs, SupplierDetailPanel tabs, TemplateDetailPanel toggle, automations-page-client tabs | 2026-05-08 |
| KPI card spec | `bg-white border border-[#dad9e3] rounded-xl p-6 min-h-[140px] flex items-start justify-between`. Value `text-[2.25rem] font-bold text-[#1c1b1f]`. Label `text-sm text-[#474747]`. Subtext success `#15803d`, error `#b91c1c`. Icon container 48px square `rounded-xl`, accent backgrounds (`#eff6ff` / `#fee2e2` / `#dcfce7` / `#fef3c7` / `#1e40af` solid). Optional Circular Progress SVG (see dashboard) | 2026-05-08 |
| Layout chrome (Sidebar + TopBar) | Sidebar fixed right, white bg, border-l `#dad9e3`. Header (logo + tenant name) → primary CTA "הזמנה חדשה" → main nav (14 items, Finance/Suppliers/Reports included) → bottom system links (Automation/Channels/Settings/Permissions) → red logout `#dc2626`. Floating circular collapse toggle on **left edge** (`absolute left-[-14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border shadow-md`) — NOT inside menu list. TopBar simplified: no "הזמנה חדשה" button (moved to Sidebar), user avatar `bg-[#1e40af]`, theme/notifications/language retained | 2026-05-08 |
| Credit card masking | Always `**** 1234`, eye icon to reveal. Never expose full card | 2026-04-09 |
| Notes split | External notes (channel) and internal notes are always separate fields, separate labels | 2026-04-09 |

## Permanent Architecture Decisions

| Decision | Details | Date |
|----------|---------|------|
| Single source of truth | ONE entity = ONE panel = ONE config = ONE validation. No duplicate windows/forms | 2026-04-08 |
| Server Actions for mutations | All writes in `lib/actions/`. No direct DB calls from components | 2026-04-08 |
| Zod shared validation | Same schema for client form AND server action | 2026-04-08 |
| Polling, not Realtime | DB is plain Postgres — no Supabase Realtime publication. Use polling (3-5s) | 2026-04-09 |
| Room status is DERIVED | Never manually set. Derived from occupancy + cleaning_state. Only `blocked`/`maintenance` are manual overrides | 2026-04-09 |
| lookup_items for dropdowns | All dropdown values in `lookup_items` DB table, managed via /settings, consumed via `useLookup` hook. No hardcoded dropdown arrays | 2026-04-08 |
| Create vs Edit share structure | Reservation create wizard and edit panel share identical visual structure, steps, cards, footer | 2026-04-09 |
| Field locking for external | External reservations (channel bookings) have locked/warning fields. 3 states: editable, locked (lock icon), warning (amber, editable with confirmation) | 2026-04-09 |
| Cleaner role = minimal UI | `role === 'cleaner'` skips sidebar/topbar, redirects to `/housekeeping/my-tasks` only | 2026-04-09 |
| Success sound | Successful reservation creates play `/sounds/success.wav` via sonner toast | 2026-04-10 |
| Email fire-and-forget | Reservation emails sent to customer + business (notification_email). Non-blocking. `MAIL_SYSTEM_URL` env var | 2026-04-10 |
| Calendar resize = delta-only preview | Committed bar NEVER stretches/dims during resize. Only the delta region (between committed end and target end) renders as an overlay layer. Invalid resize stays red in the delta region only. DB commit only on release. Full rule: `/docs/rules/CALENDAR_RESIZE_PREVIEW.md` | 2026-04-19 |
| Tabs are Variation 3 by default | Use `<Tabs items={...} value={...} onChange={...} variant="subtle" />` from `components/shared/Tabs.tsx`, OR inline the same shell (`<div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl">`). Never go back to "active = solid blue pill" UI for tabs/filters | 2026-05-08 |
| Quick-filter chips for boards | Boards (housekeeping, maintenance, etc.) that show counted statuses should expose them as Variation 3 toggle filter chips with a leading "הכל" reset chip. Filter applied client-side over board data. The "הכל" count = total open items, NOT a different metric (e.g. occupied rooms) — must match what the board actually shows when no filter active | 2026-05-08 |
| Cleaning task creation = SidePanel | Cleaning tasks are created via `<CreateCleaningTaskPanel />` SidePanel. Dual target picker (חדר → `createManualCleaningTask`, אזור → `createAreaCleaningTask`) mirrors `CreateMaintenancePanel` shape. NO inline mini-dialog. Trigger button is `btn btn-primary` labeled "משימת ניקיון חדשה" | 2026-05-08 |
| Single primary CTA per page chrome | "הזמנה חדשה" appears ONCE — in the Sidebar, opening `useReservationFormStore.open()`. Removed from TopBar to avoid duplication | 2026-05-08 |

## Permanent Database Decisions

| Decision | Details | Date |
|----------|---------|------|
| UUID primary keys | All tables `gen_random_uuid()` | 2026-04-08 |
| Soft delete | `deleted_at` timestamp, never hard delete from UI | 2026-04-08 |
| `check_room_availability()` PL/pgSQL | Single source of truth for overlap checking. Used by both create and edit paths | 2026-04-10 |
| Cleaning tasks auto-create | On checkout (manual or scheduled), `createCleaningTasksForCheckout()` fires. Duplicate prevention via partial unique index | 2026-04-09 |
| Cleaning cron | Daily 08:00 cron via `curl` to `/api/cron/cleaning-morning`. `CRON_SECRET` in `.env.local` | 2026-04-09 |
| 12 lookup categories seeded | reservation_source, reservation_status, payment_status, payment_method, board_type, language, country, currency, guest_tag, room_tag, cancellation_policy, attachment_category | 2026-04-08 |

## Permanent Permission Decisions

| Decision | Details | Date |
|----------|---------|------|
| 6 roles | super_admin, admin, manager, receptionist, staff, cleaner | 2026-04-09 |
| Cleaner = housekeeping only | Cleaner role only gets `housekeeping: {canView, canEdit}` | 2026-04-09 |
| Fail closed | If permission check fails, deny access | 2026-04-08 |
| Hide, don't disable | Unauthorized actions hidden from UI | 2026-04-08 |
| Server is authority | UI checks are cosmetic. `lib/permissions/check.ts` is the enforcer | 2026-04-08 |

---

## Naming Conventions (PMS-Specific)

| Item | Convention | Example |
|------|-----------|---------|
| Page routes | kebab-case | `/housekeeping`, `/rate-plans` |
| Server action files | kebab-case | `create-reservation.ts`, `rooms-status.ts` |
| Store files | kebab-case-store.ts | `reservation-form-store.ts` |
| Component folders | kebab-case module name | `components/reservations/`, `components/calendar/` |
| Migration files | `YYYY-MM-DD_description.sql` | `2026-04-09_cleaning_tasks.sql` |
| Client page wrapper | `module-page-client.tsx` | `staff-page-client.tsx` |

---

## Known Technical Debt

| Item | Description | Priority |
|------|-------------|----------|
| Hardcoded dropdowns | Forms still use hardcoded constants instead of `useLookup()` hook. Settings page + DB ready, form migration pending | High |
| No test suite | No Playwright or unit tests. Manual verification only | Medium |
| Dashboard empty | `/dashboard` page exists but has no KPI cards or charts yet | Low |
| Reports module | Planned but not started. Needs occupancy, revenue, guest statistics | Low |

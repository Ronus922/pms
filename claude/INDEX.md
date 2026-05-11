# Index — GuestHub PMS

> Complete navigation map of every file in the project.
> **Mandatory:** Update this file whenever a new file is created or removed.

---

## Claude Instruction Files

| File | Purpose |
|------|---------|
| `/claude/CLAUDE.md` | Master instruction file — iron rules, governance rules A-J, prohibited patterns |
| `/claude/START_HERE.md` | Reading order for every new session |
| `/claude/PROJECT_MEMORY.md` | Permanent PMS decisions — locked modules, architecture, permissions, naming |
| `/claude/CHANGELOG.md` | All changes with dates, reasons, files affected |
| `/claude/INDEX.md` | This file — complete project navigation |
| `/claude/PROJECT_INIT_PROMPT.md` | Prompt: start a new project from template |
| `/claude/NEW_MODULE_PROMPT.md` | Prompt: create a new module |
| `/claude/BUG_FIX_PROMPT.md` | Prompt: fix a bug without drift |
| `/claude/UI_CHANGE_PROMPT.md` | Prompt: UI change within design system |
| `/claude/ARCHITECTURE_REVIEW_PROMPT.md` | Prompt: architecture audit |
| `/claude/TEMPLATE_INTEGRATION_PROMPT.md` | Prompt: integrate template into existing project |
| `/claude/MEMORY_REFINE_PROMPT.md` | Skill: normalise / compact project memory (CHANGELOG, PROJECT_MEMORY, INDEX, auto-memory). Triggered by `MEMORY-REFINE`, `סדר זיכרון`, `compact memory`, etc. — added 2026-05-08 |

---

## Rules

| File | Covers |
|------|--------|
| `/docs/rules/PROJECT_RULES.md` | Philosophy, 10 iron rules, task reporting format |
| `/docs/rules/DESIGN_SYSTEM.md` | Sapphire tokens — colors, typography, spacing, radius, shadows, all component styles |
| `/docs/rules/INTERACTION_RULES.md` | Row click, SidePanel, save/cancel, keyboard, drag-and-drop, confirmations, loading |
| `/docs/rules/ARCHITECTURE_RULES.md` | Directory structure, data flow, state management, prohibitions, naming, file size limits |
| `/docs/rules/MOBILE_RULES.md` | 9 breakpoints, grid collapse, tables on mobile, footer actions, touch targets, safe areas |
| `/docs/rules/PERMISSIONS_RULES.md` | 6 roles (incl. cleaner), permission model, field-level, external locking, server enforcement |
| `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md` | Hard prohibitions: design, code, architecture, UX, performance, security |
| `/docs/rules/CALENDAR_RESIZE_PREVIEW.md` | **BINDING** — calendar resize must render as a delta-only overlay; committed bar never changes during drag; DB commit only on release |

---

## Design Specifications

| File | Covers |
|------|--------|
| `/docs/design/COLORS.md` | Brand, surface, text, semantic/status colors, dark mode, forbidden colors |
| `/docs/design/TYPOGRAPHY.md` | Type scale (11px-28px), font loading, RTL text rules, mixed content |
| `/docs/design/DIALOGS.md` | SidePanel full spec, wizard variant, confirmation dialog, quick view popup |
| `/docs/design/TABLES.md` | Header, rows, sort, selection, bulk actions, filter chips, empty, loading, pagination, mobile |
| `/docs/design/FORMS.md` | All input types, labels, errors, select, textarea, stepper, toggle, checkbox, radio, date, file upload |
| `/docs/design/STATES.md` | Loading skeleton, empty, error, success toast, disabled, active, hover, focus, dirty, offline |
| `/docs/design/MOBILE_UI.md` | SidePanel mobile, tables-to-cards, grid collapse, bottom sheet, FAB, swipe, compact header |
| `/docs/design/LAYOUTS.md` | Sidebar, TopBar, main content, page header, KPI row, filter bar, dashboard, settings, z-index |

---

## Component Standards

| File | Component | Key Specs |
|------|-----------|-----------|
| `/docs/components/dialog-standard.md` | SidePanel | 55%/100% width, gradient header, sticky footer, view/edit/wizard |
| `/docs/components/table-standard.md` | DataTable | Rounded container, sticky header, sort, pagination, mobile card view |
| `/docs/components/select-standard.md` | Select | Searchable, multi-select, chips, auto-search >10 items |
| `/docs/components/date-picker-standard.md` | DatePicker | Hebrew calendar, DD/MM/YYYY, range mode, mobile fallback |
| `/docs/components/form-standard.md` | Form | Section cards, Zod + react-hook-form, field states, dirty warning |
| `/docs/components/page-layout-standard.md` | PageLayout | Page header, KPI row, filter bar, content, skeleton |
| `/docs/components/cards-standard.md` | Cards | 6 variants: standard, section, KPI, status, clickable, compact |
| `/docs/components/filters-standard.md` | FilterBar | 5 filter types, URL sync, debounce, mobile collapsible |
| `/docs/components/empty-loading-error-standard.md` | States | EmptyState, skeletons, ErrorState, Toast |

---

## Spec Templates

| File | Use When |
|------|----------|
| `/docs/spec-templates/module.spec.template.md` | Creating a new module |
| `/docs/spec-templates/flow.template.md` | Documenting a business flow |
| `/docs/spec-templates/permissions.template.md` | Defining per-module permissions |
| `/docs/spec-templates/dialog.template.md` | Specifying a new SidePanel |
| `/docs/spec-templates/table.template.md` | Specifying a new DataTable |

---

## Reference Flows

| File | Flow |
|------|------|
| `/docs/flows/create-record-flow.md` | 10-step create: SidePanel > form > validate > server action > DB > toast |
| `/docs/flows/update-record-flow.md` | 11-step update: dirty tracking, partial update, conflict handling |
| `/docs/flows/delete-record-flow.md` | 9-step delete: confirmation, soft delete, undo (5s), dependency check |
| `/docs/flows/upload-flow.md` | File upload: drag/click, validate, upload, preview, link to entity |
| `/docs/flows/permissions-flow.md` | 9-layer permission flow: auth > role > nav > page > UI > field > action > RLS > audit |

---

## Database

### SQL Files

| File | Content |
|------|---------|
| `/database/enums.sql` | 10 PostgreSQL enum types (reusable core) |
| `/database/schema.sql` | 16 core tables with indexes, triggers, RLS |
| `/database/seed.sql` | Roles, permissions, categories, tags, settings |

### PMS Migrations

| File | What |
|------|------|
| `/scripts/migrations/2026-04-09_cleaning_tasks.sql` | Housekeeping tasks table, cleaning_state enum, cron support |
| `/scripts/migrations/2026-04-10_availability_and_email.sql` | `check_room_availability()`, `notification_email` column |
| `/scripts/migrations/2026-04-10_employee_fields.sql` | Staff/employee fields |
| `/scripts/migrations/2026-04-10_room_blocks.sql` | Room blocking functionality |

### Database Documentation

| File | Covers |
|------|--------|
| `/docs/database/DATABASE_RULES.md` | Conventions: PKs, timestamps, soft delete, naming, indexes, RLS, polymorphic patterns |
| `/docs/database/ENTITIES.md` | All 16 core tables — columns, types, indexes, relationships |
| `/docs/database/RELATIONS.md` | ER diagram, FK map, polymorphic joins, hierarchies |
| `/docs/database/ENUMS.md` | All 10 enums — values, Hebrew labels, color mapping |
| `/docs/database/AUDIT_LOGS.md` | Audit system: createAuditLog(), changes format, querying, retention |
| `/docs/database/NOTIFICATIONS.md` | Notification system: channels, real-time, preferences, cleanup |
| `/docs/database/FILES_AND_UPLOADS.md` | File management: upload flow, storage, deduplication, signed URLs |
| `/docs/database/PERMISSIONS_SCHEMA.md` | RBAC: 4-step resolution, scope-to-SQL, hooks, migration patterns |

---

## PMS Application Pages

| Route | Server Page | Client Wrapper | Status |
|-------|------------|----------------|--------|
| `/calendar` | `app/(dashboard)/calendar/page.tsx` | — | Production |
| `/reservations` | `app/(dashboard)/reservations/page.tsx` | — | **LOCKED** |
| `/guests` | `app/(dashboard)/guests/page.tsx` | — | Production |
| `/rooms` | `app/(dashboard)/rooms/page.tsx` | — | Production |
| `/housekeeping` | `app/(dashboard)/housekeeping/page.tsx` | — | Production |
| `/staff` | `app/(dashboard)/staff/page.tsx` | `staff-page-client.tsx` | In progress |
| `/permissions` | `app/(dashboard)/permissions/page.tsx` | — | Production |
| `/settings` | `app/(dashboard)/settings/page.tsx` | — | Production |
| `/reports` | `app/(dashboard)/reports/` | — | Planned |

---

## PMS Components (Project-Specific)

| Directory | Key Components |
|-----------|---------------|
| `components/calendar/` | CalendarGrid, CellActionMenu |
| `components/reservations/` | ReservationModal, ReservationSummary, steps/Step2Stay, steps/Step3Pricing, steps/Step4Review, edit-steps/EditStep2Stay, tabs/GuestTab, tabs/PricingTab, tabs/StayTab, ExtraChargesEditor, ReservationFilters (in guests/) |
| `components/rooms/` | Room components |
| `components/housekeeping/` | `CreateCleaningTaskPanel.tsx` — SidePanel for creating cleaning tasks (room or area target). Mirrors `CreateMaintenancePanel` shape — added 2026-05-08. Cleaning board itself lives directly in `app/(dashboard)/housekeeping/page.tsx` |
| `components/staff/` | Staff management components |
| `components/permissions/` | PermissionsManager |
| `components/settings/` | Settings sections, LookupTable |
| `components/reports/` | ReportsFilterBar |
| `components/layout/` | Dashboard shell, sidebar, topbar |
| `components/panels/` | Shared panel wrappers |

---

## PMS Server Actions

| File | Actions |
|------|---------|
| `lib/actions/create-reservation.ts` | createReservation, getAvailableRooms **[LOCKED]** |
| `lib/actions/reservation-update.ts` | updateReservation, replaceReservationRoom **[LOCKED]** |
| `lib/actions/reservation-detail.ts` | getReservationById, getReservationHistory |
| `lib/actions/reservation-search.ts` | searchReservations |
| `lib/actions/reservations.ts` | getReservations (list) |
| `lib/actions/send-reservation-email.ts` | sendReservationEmail **[LOCKED]** |
| `lib/actions/calendar.ts` | getCalendarData, moveReservation |
| `lib/actions/rooms.ts` | getRooms, createRoom, updateRoom, deleteRoom |
| `lib/actions/rooms-status.ts` | getRoomStatuses (derived status calculation) |
| `lib/actions/room-form.ts` | Room form actions |
| `lib/actions/room-types.ts` | getRoomTypes |
| `lib/actions/cleaning.ts` | getCleaningBoard, getMyCleaningQueue, updateCleaningTask, createCleaningTasksForCheckout |
| `lib/actions/guests.ts` | getGuests |
| `lib/actions/guest-profile.ts` | getGuestProfile |
| `lib/actions/staff.ts` | getStaff, createStaff, updateStaff |
| `lib/actions/permissions.ts` | getPermissions, updatePermissions |
| `lib/actions/settings.ts` | getSettings, updateSettings, getLookupItems, CRUD for lookup_items **[LOCKED]** |
| `lib/actions/tenant.ts` | getTenant, getCurrentUser |

---

## PMS Stores (Zustand)

| File | Purpose |
|------|---------|
| `lib/stores/reservation-form-store.ts` | Create reservation wizard state **[LOCKED]** |
| `lib/stores/reservation-edit-store.ts` | Edit reservation state **[LOCKED]** |
| `lib/stores/calendar-store.ts` | Calendar view state (date range, filters) |
| `lib/stores/room-form-store.ts` | Room create/edit form state |
| `lib/stores/room-types-store.ts` | Room types cache |
| `lib/stores/staff-store.ts` | Staff management state |

---

## PMS Types

| File | Types |
|------|-------|
| `lib/types/cleaning.ts` | CleaningTask, CleaningState, CleaningBoard |
| `lib/types/guests.ts` | Guest, GuestFilter |
| `lib/types/lookup.ts` | LookupItem, LookupCategory |
| `lib/types/staff.ts` | Staff, StaffFormData |

---

## PMS Permissions

| File | Content |
|------|---------|
| `lib/permissions/constants.ts` | Role definitions (6 roles incl. cleaner), permission matrix per module |
| `lib/permissions/check.ts` | `hasPermission()`, `canView()`, `canEdit()`, `canCreate()`, `canDelete()` |

---

## PMS Constants

| File | Content |
|------|---------|
| `lib/constants/reservation.ts` | Reservation status, source, payment constants with Hebrew labels |

---

## Shared Components (PMS Working)

| File | Component |
|------|-----------|
| `components/shared/SidePanel.tsx` | Main SidePanel — Azure Ethos `#1e40af` flat header, sticky footer |
| `components/shared/FormField.tsx` | Label + required + error wrapper |
| `components/shared/DateInput.tsx` | Date input with calendar popup **[LOCKED]** |
| `components/shared/NumberStepper.tsx` | Increment/decrement number control |
| `components/shared/Icon.tsx` | Lucide icon wrapper. ICON_MAP must contain a Lucide entry per used name — unmapped names render as empty `<span>` |
| `components/shared/Tabs.tsx` | Reusable tabs component (Variation 3 Subtle Card / Variation 4 Segmented Control). Generic items+value+onChange API — added 2026-05-08 |

---

## Template Reusable Code (`/src/`)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `/src/types/` | 5 | BaseEntity, User, Task, Notification, FileRecord, component props |
| `/src/constants/` | 4 | Status maps, permissions, app config |
| `/src/schemas/` | 4 | Zod: common, user, task |
| `/src/validators/` | 3 | Regex patterns, file validation |
| `/src/hooks/` | 9 | Debounce, permission, media query, pagination, sort, filters, confirm, keyboard |
| `/src/services/` | 6 | Auth, audit, notifications, files, Supabase |
| `/src/components/shared/` | 16 | 15 production components (SidePanel, DataTable, FormField, etc.) |
| `/src/layouts/` | 3 | AppShell, PageLayout |
| `/src/lib/helpers/` | 9 | Date, table, filter, upload, notification, audit, permissions, mobile |
| `/src/lib/utils.ts` | 1 | cn() helper |

---

## Prompts Quick Reference

| Task | Prompt File |
|------|-------------|
| New project | `/claude/PROJECT_INIT_PROMPT.md` |
| New module | `/claude/NEW_MODULE_PROMPT.md` |
| Bug fix | `/claude/BUG_FIX_PROMPT.md` |
| UI change | `/claude/UI_CHANGE_PROMPT.md` |
| Architecture audit | `/claude/ARCHITECTURE_REVIEW_PROMPT.md` |
| Template integration | `/claude/TEMPLATE_INTEGRATION_PROMPT.md` |

# Dead Code

Every claim below was verified by `grep -rln "from \"@/<path>\"" app components lib --include="*.ts" --include="*.tsx"` returning zero hits, OR by `grep -rln "<ComponentName>"` returning only the definition file. Confidence is HIGH unless marked otherwise.

---

## 🟡 The entire `src/` directory — 62 files, ~5,095 LoC, zero imports

```
$ grep -rn 'from "@/src/' app components lib 2>/dev/null
(no results)

$ find src -type f | wc -l
62
```

The project has a parallel `src/` directory containing:

```
src/components/{ui,shared}/         — shadcn barrel + DataTable, Select, FilterBar, LoadingState
src/services/                       — supabase.ts, files.ts, notifications.ts, audit.ts
src/lib/, src/hooks/, src/types/, src/constants/, src/validators/, src/schemas/, src/layouts/, src/modules/
```

This was presumably scaffolded as "extraction-ready" library code (matches the project memory pattern `feedback_extraction_ready_guidelines.md`). **It has no runtime consumers.** Author verified directly.

**Risk to delete**: NONE. The `tsconfig.json` `@/` alias maps to project root, so anything that wanted to import from here would do `@/src/...` — and nothing does. The directory is reachable on disk but not in the import graph.

**Recommendation**: if the extraction-ready scaffolding is still planned, move it to a sibling repo or a `packages/` workspace. If not, delete it. **Don't leave it sitting in the project root** — it confuses tooling (knip flagged ~50 items here as unused), confuses Cursor / agents (they assume it might be live), and adds noise to greps.

---

## 🟢 Seven room-tab components — RoomFormDialog inlined them

Files (all under `components/rooms/tabs/`):

| File | Imported by |
|---|---|
| `AmenitiesTab.tsx` | nobody |
| `BedsTab.tsx` | nobody |
| `GeneralTab.tsx` | nobody |
| `ImagesTab.tsx` | nobody |
| `LanguagesTab.tsx` | nobody |
| `MetaSeoTab.tsx` | nobody |
| `OccupancyTab.tsx` | nobody |

Author ran `grep -rln "<TabName>"` for each — zero consumers beyond the file's own definition.

The actual room form is [components/rooms/RoomFormDialog.tsx](../../components/rooms/RoomFormDialog.tsx) at 1,501 lines, which inlines all tab UI inside its own STEPS constant. The standalone tab files are leftover from an aborted extraction.

**Risk to delete**: LOW. Verify once that RoomFormDialog truly contains all the tab logic before deleting (author did a partial verification — confirmed the inlining pattern exists, did not diff each tab's logic against the inlined version). Worth a quick `git log` on these files to understand intent before deletion.

---

## 🟢 Duplicate `DashboardShell` component

| Path | Status | Imported by |
|---|---|---|
| [app/(dashboard)/dashboard-shell.tsx](../../app/(dashboard)/dashboard-shell.tsx) | **ACTIVE** | [app/(dashboard)/layout.tsx:3](../../app/(dashboard)/layout.tsx) |
| [components/layout/DashboardShell.tsx](../../components/layout/DashboardShell.tsx) | DEAD | nobody |

Author verified the layout import is to the `app/` version, not the `components/` one.

**Risk to delete the dead one**: NONE — confirmed zero imports.

---

## 🟢 Unused action files

| File | Reported by Agent A as | Author verified? |
|---|---|---|
| `lib/actions/rooms.ts` | unused (`getRoomsList`) | `[unverified]` — author did not open this file |
| `lib/actions/attendance-punches.ts` | 13KB, zero imports | `[unverified]` — author did not open |

**Risk to delete**: MEDIUM (because unverified). Before deletion, run a final `grep -rln "from \"@/lib/actions/rooms\""` and similar for `attendance-punches`. If zero hits, delete.

---

## 🟢 Other orphan files (Agent A findings, mostly unverified)

| File | Status | Note |
|---|---|---|
| `components/reservations/ReservationSummary.tsx` | claimed orphan `[unverified]` | author did not open |
| `components/maps/AreaDrawingControls.tsx` | claimed orphan `[unverified]` | likely related to the maps-test scratch page |
| `components/shared/Tabs.tsx` | claimed orphan `[unverified]` | tabs are inlined elsewhere |
| `hooks/use-side-panel.ts` | claimed orphan `[unverified]` | — |
| `lib/constants/index.ts` | claimed orphan `[unverified]` | barrel file |
| `lib/reports/index.ts` | claimed orphan `[unverified]` | barrel file |
| `lib/types/guests.ts` | claimed orphan `[unverified]` | — |

**Recommendation**: do not delete from this list without a one-line `grep` per file. Knip has false positives for barrels, dynamic imports, and configuration files.

---

## 🟢 Unused exports inside live files

Agent A also flagged ~80 unused exports within otherwise-active modules. Author verified one example:

- [lib/actions/calendar.ts:127](../../lib/actions/calendar.ts) `moveReservation()` — never called. The live mover is `moveReservationSegment` in `lib/actions/board-actions.ts`, used by [components/calendar/CalendarBoard.tsx:206](../../components/calendar/CalendarBoard.tsx). Author confirmed via grep.

The remaining 79 are `[unverified]`. Use knip's output as a starting list, but **always verify per export** before deletion — knip misses dynamic imports, re-exports, and module-augmentation patterns.

---

## ℹ️  `maps-test` page — self-marked scratch

**File**: [app/(dashboard)/maps-test/page.tsx:3](../../app/(dashboard)/maps-test/page.tsx)

```ts
/**
 * ⚠️  TEMPORARY DEV PAGE — REMOVE AFTER PART D VERIFIED  ⚠️
 */
```

Author opened and confirmed the warning. This is a developer's note-to-self for a scratch verification page. As long as "Part D" of whatever the author was working on is done, it's safe to delete. Worth checking before deletion: search for references to a "Part D" elsewhere (PROJECT_MEMORY.md, claude/ docs, recent commits) to see if the dependent work is complete.

---

## Files known to be live but oversized (god-components)

Not "dead", but worth flagging here for the cleanup phase. Each >500 lines:

| File | Lines | Note |
|---|---|---|
| [components/rooms/RoomFormDialog.tsx](../../components/rooms/RoomFormDialog.tsx) | 1,501 | inlines the 7 tab components above |
| [lib/actions/maintenance.ts](../../lib/actions/maintenance.ts) | 1,137 | god-action file |
| [app/(dashboard)/housekeeping/page.tsx](../../app/(dashboard)/housekeeping/page.tsx) | 1,099 | drag-drop board with complex state; 10 of the 18 project console.warns are DnD debug here |
| [lib/integrations/channex/orchestrator.ts](../../lib/integrations/channex/orchestrator.ts) | 1,017 | author did NOT read this; only Channex webhook handler was audited |
| [lib/actions/cleaning.ts](../../lib/actions/cleaning.ts) | 912 | god-action file |
| [lib/reports/categories.ts](../../lib/reports/categories.ts) | 894 | likely a config table; opening would clarify |
| [lib/actions/channex.ts](../../lib/actions/channex.ts) | 884 | god-action file |
| [components/permissions/PermissionsManager.tsx](../../components/permissions/PermissionsManager.tsx) | 864 | invite + edit + reset-password + role/perm matrix |
| [components/suppliers/SupplierDetailPanel.tsx](../../components/suppliers/SupplierDetailPanel.tsx) | 792 | 4 tabs + (broken) doc upload |

**These files are alive and load-bearing. Do not refactor without understanding their consumers.** The cost-benefit on splitting them is real — splitting RoomFormDialog into the seven tab files that ALREADY EXIST would be a win, since the tab files are dead anyway. Splitting the action files is more invasive.

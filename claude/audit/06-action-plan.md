# Action Plan — Risk-Tiered Cleanup Map

This is the deliverable. The other docs are reference material; this is the **map you can act from without breaking the project**.

The user asked for 9 specific buckets. They are below in order.

---

## Progress log (updated 2026-05-11)

### Done

| Date | Action | Commits | Branch |
|---|---|---|---|
| 2026-05-10 | Audit committed | `e120d95` | `audit/2026-05-11` (split out) |
| 2026-05-11 | Branch split — feature work moved off audit history | reset + force-push | `feature/username-auth` reset to `a20bba8` |
| 2026-05-11 | CRITICAL-4 fix: 3 mutations in reservations.ts use `requirePermission` | `273b282` | `feature/username-auth` |
| 2026-05-11 | CRITICAL-1 fix: getReservationFull gated by tenant | `21d7a95` | `feature/username-auth` |
| 2026-05-11 | CRITICAL-2 fix: getGuestProfile + reservations sub-query gated by tenant | `3aabf29` | `feature/username-auth` |
| 2026-05-11 | CRITICAL-3 fix: getReservationDetails gated by tenant | `0ff3aea` | `feature/username-auth` |
| 2026-05-11 | Channex orchestrator entry-point audit (see below) | none — no CRITICAL #5 found | — |

### Channex orchestrator audit result (2026-05-11)

The user flagged `lib/integrations/channex/orchestrator.ts` (1,017 lines) as a high-risk unaudited surface. Author opened entry points and traced the trust path:

- **Only one webhook-route entry point**: `enqueueJob(input)` at orchestrator.ts:91. The webhook handler in `app/api/channex/webhooks/route.ts:121` passes `connectionRow.tenant_id` which is **derived from DB lookup** (channel_connections row matched by `webhook_secret` OR `channel_property_links.channex_property_id`) — not from the request body.
- **Other orchestrator consumers**: `lib/actions/channex.ts` imports `enqueueJob`, `loadCallContext`, `processJob`. Author grepped the file: every one of the ~16 exported server actions in that file calls `requirePermission("rooms", ...)` and derives `tenantId` from `actor.tenantId`. No client-trust pattern.
- **Conclusion**: orchestrator is **CLEAN** of the CRITICAL #4 trust-client-tenantId pattern. The previously-flagged HIGH-3 (webhook property_id fallback bypass) is a separate concern — it's an authentication bypass on the webhook entry, not a tenant trust issue. Each property is FK-tied to one connection in `channel_property_links`, so the tenant correctness is preserved even when the secret check is skipped.

**No new CRITICAL #5 added.** HIGH-3 remains open as it was.

### Still to do (in order)

- HIGH-2: validate `next` param in `app/auth/callback/route.ts:32` (one-line guard).
- HIGH-4: switch cron `!==` to `crypto.timingSafeEqual` (4 routes — `automation-queue` confirmed, the other 3 still unverified).
- HIGH-3: remove webhook property_id fallback OR document it as intentional (decision needed).
- HIGH-1: upload pipeline rebuild — separate milestone.
- Phase 1-4 cleanup (dead code, src/, deps) — not yet started.

### Outstanding non-audit work on `feature/username-auth`

The branch still has ~14 modified + 4 new files from the username-auth feature work (login/register/forgot/reset pages, lib/actions/auth.ts, lib/services/email.ts, lib/actions/permissions.ts, lib/actions/staff.ts, types, etc.). These need their own commit(s) before the branch is PR-ready. They are NOT part of the audit fix commits.

---

## 1. ✅ Safe to delete IMMEDIATELY — zero risk

Items where the evidence is "the import graph contains zero references to this path". Verified by grep, not inference.

| What | Path | Evidence |
|---|---|---|
| Entire dead `src/` directory | `/var/www/pms/src/` (62 files) | `grep -rn 'from "@/src/' app components lib` returns **0** |
| Duplicate DashboardShell | [components/layout/DashboardShell.tsx](../../components/layout/DashboardShell.tsx) | The live one is [app/(dashboard)/dashboard-shell.tsx](../../app/(dashboard)/dashboard-shell.tsx), imported by [app/(dashboard)/layout.tsx:3](../../app/(dashboard)/layout.tsx) |
| Stale gitignored noise on disk | `/var/www/pms/output/`, `/var/www/pms/.claude-md-backups/` | Both gitignored; can remove from working tree to clean up |
| Unused npm deps | `@hookform/resolvers`, `@tanstack/react-table`, `react-hook-form`, `@types/google.maps` | `grep -rln "from \"<pkg>\"" app components lib` returns **0** for each |
| DnD `console.warn` calls | [app/(dashboard)/housekeeping/page.tsx:685-807](../../app/(dashboard)/housekeeping/page.tsx) (10 calls) | Author-readable `[DND]` debug prefix; clearly production noise |
| False-positive `any` comment | [components/calendar/board/DayCell.tsx:39](../../components/calendar/board/DayCell.tsx) | Word "any" appears in a code comment, not a type — ignore the lint warning |

**Order of deletion**: run `pnpm tsc --noEmit && pnpm build` after each one to catch surprises.

---

## 2. ⚠️ Dangerous to delete without verification — requires one-line confirmation

Knip / Agent A flagged these as unused, but the author did NOT personally open them. Each needs a fresh grep before deletion.

| What | Path | Pre-deletion check |
|---|---|---|
| Standalone room tabs (7 files) | `components/rooms/tabs/*Tab.tsx` | `grep -rln "<TabName>" app components` — should return only the file itself |
| Unused action files | `lib/actions/rooms.ts`, `lib/actions/attendance-punches.ts` | `grep -rln "from \"@/lib/actions/rooms\""` etc. |
| Other claimed orphans | `components/reservations/ReservationSummary.tsx`, `components/maps/AreaDrawingControls.tsx`, `components/shared/Tabs.tsx`, `hooks/use-side-panel.ts`, `lib/constants/index.ts`, `lib/reports/index.ts`, `lib/types/guests.ts` | Per-file grep |
| Unused exports (~80) | various — see knip output | Per-export grep |
| `maps-test` scratch page | [app/(dashboard)/maps-test/](../../app/(dashboard)/maps-test/) | Self-marked "remove after Part D verified"; confirm Part D is done first |

**Why automation will miss**: knip has false positives for dynamic imports (`import()`), re-exports from barrel files, framework conventions (Next.js entry points), and module augmentation. Always grep before deleting.

---

## 3. 🛑 Auth / uploads / permissions — DO NOT touch without regression coverage

These paths are load-bearing. Changing them without a known-good test plan will silently break the app for end users.

| Surface | Files | Why fragile |
|---|---|---|
| Recovery email flow | [lib/actions/auth.ts](../../lib/actions/auth.ts), [app/auth/callback/route.ts](../../app/auth/callback/route.ts), [app/(auth)/forgot-password/page.tsx](../../app/(auth)/forgot-password/page.tsx), [app/(auth)/reset-password/page.tsx](../../app/(auth)/reset-password/page.tsx), gotrue env in `/opt/supabase/docker/.env` | Just stabilized this session; 6+ rounds of debugging to land. Touching origin handling, SMTP, or allowlist will re-break it. |
| Invite + role management | [lib/actions/permissions.ts](../../lib/actions/permissions.ts), [components/permissions/PermissionsManager.tsx](../../components/permissions/PermissionsManager.tsx), [components/staff/EmployeeSidePanel.tsx](../../components/staff/EmployeeSidePanel.tsx) | Hybrid security pattern (`requireActor` + accept client password). Easy to regress to either the unhardened or the un-usable form. |
| Tenant isolation | All `lib/actions/**/*.ts` | The 3 critical leaks listed in [01-critical-security.md](01-critical-security.md) (`getReservationFull`, `getGuestProfile`, `getReservationDetails`) and the 3 trust-client-tenantId mutations (`updateReservationStatus`, `toggleVip`, `cancelReservation`) **must be fixed** but fixing them is its own regression-risk operation. |
| Channex webhook | [app/api/channex/webhooks/route.ts](../../app/api/channex/webhooks/route.ts) | Bookings flow through here. Removing the property_id fallback (per [01-critical-security.md HIGH-3](01-critical-security.md)) needs verification that Channex itself is sending the secret on all real webhook calls. |
| Upload pipeline | See [02-broken-uploads.md](02-broken-uploads.md) | Currently broken-but-quiet. A real fix is a multi-day buildout; don't half-fix. |
| Multi-tenant queries | Any new `db\`SELECT...\`` | Must include `tenant_id = ${actor.tenantId}` — if you skip it, you've added another leak. |

---

## 4. 🟢 Dependencies safe to remove — with proof

```bash
pnpm remove @hookform/resolvers @tanstack/react-table react-hook-form
pnpm remove -D @types/google.maps
pnpm add server-only   # currently imported but unlisted — make explicit
```

Proof for each: `grep -rln "from \"<pkg>\"" app components lib --include="*.ts" --include="*.tsx"` returns 0. See [04-dependencies.md](04-dependencies.md).

Run `pnpm tsc --noEmit && pnpm build` after each command. Stop and investigate if anything fails.

Estimated bundle savings: 60-80KB client-side from `react-hook-form` + `@tanstack/react-table` alone.

---

## 5. 👀 Files that need MANUAL review — automation will miss

These can't be safely automated because the judgment is semantic, not syntactic.

| File / area | Why automation misses it |
|---|---|
| `lib/integrations/channex/orchestrator.ts` (1,017 lines) | Author did NOT read this file. It contains the Channex sync logic — a tool can't tell whether a query is correctly tenant-scoped without reading what it's doing. |
| The 3 god-action files (`maintenance.ts`, `cleaning.ts`, `channex.ts`, 900-1100 lines each) | Need a human to decide which sub-actions belong together vs split. Mechanical splitters will produce garbage boundaries. |
| `RoomFormDialog.tsx` 1,501 lines | Already inlines 7 tab components that exist on disk separately. A human needs to compare the inlined logic to the standalone files and decide which is the source of truth. |
| `housekeeping/page.tsx` DnD state machine | Complex async state with refs (`dragInFlight`, `dragSourceRef`, `dragDestRef`) — DO NOT refactor without understanding why each ref exists. The console.warns make this readable; deleting them before understanding is a bad trade. |
| Existing supplier-document rows with `blob:` URLs | These are unrecoverable data. A human needs to decide: null them out, flag them, or accept the loss. Migration script depends on that call. |
| Duplicate invite forms | Architectural call: extract a shared component, delete one, or live with the duplication? UX-driven, not mechanical. |
| `maps-test` page | "Remove after Part D verified" — only a human knows whether Part D is done. |

---

## 6. 📋 Cleanup order — dependency-aware

What blocks what.

```
Phase 0: Snapshot
   └─ commit + tag current state (so any cleanup is reversible)

Phase 1: Mechanical zero-risk (parallel-safe)
   ├─ Remove on-disk noise: output/, .claude-md-backups/
   ├─ Delete components/layout/DashboardShell.tsx (duplicate)
   ├─ Strip DnD console.warns in housekeeping/page.tsx
   └─ Fix 6 real `any` types (5 minutes each, no functional change)

Phase 2: Dependency cleanup
   ├─ pnpm remove the 4 unused deps + add server-only
   └─ pnpm tsc --noEmit && pnpm build → confirm clean

Phase 3: src/ removal — DEPENDS ON Phase 2 being green
   └─ Delete src/ entirely; rebuild; confirm

Phase 4: Verified orphan removal — per-file grep first
   ├─ components/rooms/tabs/*.tsx (after confirming RoomFormDialog truly inlines them)
   ├─ lib/actions/rooms.ts, lib/actions/attendance-punches.ts
   ├─ Other Agent-A-flagged orphans (per-file grep)
   └─ maps-test/ (after confirming Part D is done)

Phase 5: CRITICAL security fixes — REGRESSION-GATED (see bucket 9)
   ├─ Fix tenant leaks in reservation-detail, guest-profile, reservations reads
   ├─ Fix trust-client-tenantId in updateReservationStatus/toggleVip/cancelReservation
   ├─ Fix /auth/callback open-redirect (next param validation)
   └─ Remove Channex webhook property_id fallback

Phase 6: HIGH security fixes
   ├─ Cron routes → crypto.timingSafeEqual
   └─ register endpoint → uniqueness check (after deciding the naming model)

Phase 7: Upload rebuild — own milestone
   └─ Supabase Storage buckets + replace all blob: URL sites + migrate broken rows

Phase 8: Architectural refactors — own milestone
   ├─ Decide canonical invite form, delete the other
   ├─ Move "use server" off lib/services/email.ts
   └─ Split god-action files (optional polish)
```

---

## 7. 🤖 Delegatable to an automated agent — low risk, deterministic

These are mechanical, verifiable by a build pass:

- **Bundle removal** (bucket 4) — single command per package, build verifies.
- **`console.*` cleanup** (the 10 DnD ones in housekeeping) — find-and-delete with a clear regex.
- **`any` type fixes** (6 files) — narrowly scoped, type is obvious from context.
- **Deleting `src/`** — single `rm -rf`, build verifies.
- **Deleting `components/layout/DashboardShell.tsx`** — single file, build verifies.
- **Deleting `output/` and `.claude-md-backups/` from disk** — single `rm -rf`, gitignored already.

**Acceptance criteria for the agent**: after every step, `pnpm tsc --noEmit && pnpm build` must pass. If it doesn't, stop and report.

---

## 8. 🧠 Requires human judgment — UX, business logic, architecture

- **Which invite form is canonical?** UX call.
- **Should upload rebuild use Supabase Storage or external (S3, R2)?** Infra cost/policy call.
- **What to do with existing broken supplier docs?** Data call (null, flag, accept loss).
- **Split RoomFormDialog into its existing tab files?** Likely yes, but verify each tab's inlined logic matches the standalone file.
- **Drop `output/` patches dir entirely or keep as reference?** User-only decision.
- **Should `lookupEmailByUsername` get rate-limiting?** Policy call (how public is your tenant access model).
- **Add RLS at the Postgres layer as defense-in-depth?** Significant decision, not in this audit's scope.

---

## 9. 🧪 Regression testing required BEFORE touching

A test pass on these flows is mandatory before refactoring them. The flows themselves involve real DB writes, real auth state, real emails — they need manual or scripted end-to-end coverage:

| Flow | Touch this and you risk | Pre-flight test |
|---|---|---|
| Login (email/password) | New users locked out | Test login as a known user, verify `last_login` updates in DB |
| Login (username) | Username-based access broken | Same, with username instead of email |
| Forgot password | Recovery email never arrives or link broken | Trigger via `/forgot-password`, click email link, set new password, log in |
| Admin invite user | New employees never get credentials | Invite from both the staff and permissions pages, verify mail received |
| Role change | Privilege escalation or accidental demotion | Promote a receptionist; verify they can do new things; demote; verify they can't |
| Reservation create | Bookings silently fail | Create a reservation end-to-end, verify all linked rows (rooms, charges, payments) |
| Reservation cancel | Cleaning tasks not cancelled | Cancel; verify `housekeeping_tasks` for that reservation flip to cancelled |
| Channex webhook | Channel bookings missed or duplicated | Send a known-good webhook payload, verify reservation upsert |
| Cron jobs | Automations silently stop | Trigger each cron route with the secret, verify expected work happens |
| Tenant isolation | Cross-tenant data leak (the bug we're fixing) | After fix: log in as tenant A, attempt to fetch a tenant B reservation ID — must 404 |

For the leak fixes specifically: write a regression test that calls the fixed function with a `reservationId` belonging to another tenant and asserts the result is `null`. Without that test, the fix can silently regress.

---

## Reversibility

Every step in Phases 1-4 is one `git revert` away. Phases 5+ touch persistence and external services (Channex, SMTP) — keep the working-tree clean per phase and tag releases so rollback is one command.

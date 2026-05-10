# Coverage Statement

What was actually checked, what was sampled, what was skipped. Read this **before** trusting any finding in the other docs as universal — many are based on partial coverage.

## What the author personally opened and read

| File | Reason | How much |
|---|---|---|
| [lib/actions/reservation-detail.ts](../../lib/actions/reservation-detail.ts) | Verify tenant leak claim | function header + WHERE clauses |
| [lib/actions/guest-profile.ts](../../lib/actions/guest-profile.ts) | Verify tenant leak claim | function header + WHERE clauses |
| [lib/actions/reservations.ts](../../lib/actions/reservations.ts) lines 1-80 | Verify tenant leak + mutation pattern | first 80 lines (all 3 mutations) |
| [lib/actions/suppliers.ts](../../lib/actions/suppliers.ts) | Verify upload bug end-to-end | `uploadSupplierDocument` body |
| [components/suppliers/SupplierDetailPanel.tsx](../../components/suppliers/SupplierDetailPanel.tsx) | Verify upload client side | lines 565-610 (the `handleFileSelect`) |
| [components/reservations/FileUploadArea.tsx](../../components/reservations/FileUploadArea.tsx) | Verify attachment pattern | full file (107 lines) |
| [app/auth/callback/route.ts](../../app/auth/callback/route.ts) | Verify open-redirect claim | full file |
| [app/api/channex/webhooks/route.ts](../../app/api/channex/webhooks/route.ts) lines 60-90 | Verify webhook fallback claim | the auth section |
| [lib/auth/actor.ts](../../lib/auth/actor.ts) | Verify the hardened pattern reference | function shape |
| [lib/auth/errors.ts](../../lib/auth/errors.ts) | Verify "use server" claim | first 25 lines (confirmed it's NOT a use-server file) |
| [components/staff/tabs/ProfileTab.tsx](../../components/staff/tabs/ProfileTab.tsx), [components/permissions/PermissionsManager.tsx](../../components/permissions/PermissionsManager.tsx), [components/staff/EmployeeSidePanel.tsx](../../components/staff/EmployeeSidePanel.tsx) | Read fully earlier this session | as part of feature work |

## What Agent A (dead code) reported and how much it was verified

| Claim | Agent's evidence | Author verified? |
|---|---|---|
| `src/` directory dead (62 files) | knip + grep | ✅ Author confirmed: `grep -rn 'from "@/src/'` → 0 hits |
| 7 room tabs unused | grep per file | ✅ Author confirmed: per-tab grep → 0 hits |
| DashboardShell duplicate | grep | ✅ Author confirmed |
| 4 unused deps | grep | ✅ Author confirmed per package |
| `lib/actions/rooms.ts`, `lib/actions/attendance-punches.ts` unused | grep | ❌ Author did NOT open or re-grep |
| `components/reservations/ReservationSummary.tsx` unused | grep | ❌ Author did NOT verify |
| `components/maps/AreaDrawingControls.tsx` unused | grep | ❌ Author did NOT verify |
| Other 7 misc orphans | grep | ❌ Author did NOT verify |
| ~80 unused exports | knip | ❌ Author verified ONE (`moveReservation` in calendar.ts), did not check the other 79 |
| `server-only` unlisted | knip | ❌ Author did NOT re-verify |

## What Agent B (security) reported and how much it was verified

| Claim | Author verified? |
|---|---|
| 3 tenant leaks (reservation-detail, guest-profile, reservations) | ✅ Confirmed all 3 by opening files at cited lines |
| `updateReservationStatus`/`toggleVip`/`cancelReservation` lacking `requireActor` | ✅ Confirmed by reading lines 39-72 of reservations.ts |
| Open redirect at `/auth/callback?next=...` | ✅ Confirmed at lines 32, 77 |
| Channex webhook property_id fallback | ✅ Confirmed at lines 66-84 |
| Cron secret `!==` (timing) | ❌ Only `automation-queue/route.ts` was sampled in Agent B's transcript; the other 3 cron routes were NOT individually verified |
| Register endpoint tenant uniqueness | ❌ Author did NOT open this file |
| Verified-secure patterns (service-role confined, no NEXT_PUBLIC leaks, etc.) | ✅ Confirmed by author's own grep |

## What Agent C (architecture) reported and how much it was verified

| Claim | Author verified? |
|---|---|
| Upload bugs (5 sites) | ✅ Author confirmed all 5 sites by grep + reading 2 in full |
| `lib/actions/create-reservation.ts` discards attachments | ✅ Author confirmed via grep — zero hits for "attachment" in that file |
| God-component line counts (top 9) | ✅ Author ran `find ... | wc -l` |
| Layering clean (no component→db imports) | ❌ Author did NOT independently re-verify this; trust at agent's word |
| 100% named exports in `components/` | ❌ Author did NOT re-verify |
| No critical TODOs/FIXMEs | ❌ Author did NOT re-verify |

## What was NOT checked at all

- **`lib/integrations/channex/orchestrator.ts`** (1,017 lines) — Channex sync logic. Could have tenant leaks, broken queries, race conditions. Unknown.
- **`lib/actions/maintenance.ts`** (1,137 lines) — only sampled by agents, not read.
- **`lib/actions/cleaning.ts`** (912 lines) — sampled.
- **`lib/actions/channex.ts`** (884 lines) — sampled.
- **`lib/reports/categories.ts`** (894 lines) — name suggests config table; never opened.
- **All cron routes** beyond `automation-queue` — only one of four was individually inspected.
- **Database schema** — no review of migrations, indexes, constraints, RLS.
- **Tests** — none reviewed; project may not have tests at all.
- **`next.config.js`** — not reviewed for unsafe directives.
- **Middleware** (`middleware.ts` / `lib/supabase/middleware.ts`) — not reviewed (just confirmed it exists).
- **Edge runtime functions** — not reviewed.
- **`output/` directory** — gitignored, deliberately excluded.
- **Performance, bundle size, runtime profiling** — not in scope.
- **CSP / HTTP security headers** — not in scope.
- **`npm audit` / known CVEs** — not run.

## Confidence breakdown

| Severity tier | Confidence in findings |
|---|---|
| 🔴 CRITICAL (4 items) | **HIGH** — all 4 personally verified by author opening files at cited lines |
| 🟠 HIGH (6 items) | **HIGH for upload bugs and open-redirect** (verified); **MEDIUM for Channex webhook bypass** (verified but the fallback might have a non-obvious legitimate use case the author hasn't considered); **MEDIUM-LOW for cron timing** (only one of four routes confirmed) |
| 🟡 MEDIUM (7 items) | **HIGH for `src/` deadness, 4 unused deps, duplicate invite forms** (all verified); **MEDIUM for register endpoint** (not opened); **MEDIUM for orphan files** (only sampled) |
| 🟢 LOW (5 items) | **HIGH** — console.* / `any` types verified, but the actual lists are mechanical and accurate |
| ℹ️  INFO | **HIGH** — observed patterns, not defects |

## How to extend coverage

If you (or a follow-up agent) want to close the gaps:

1. **Open `lib/integrations/channex/orchestrator.ts`** end-to-end and audit for tenant leaks (this is the biggest unread surface).
2. **Open the 3 cron routes** not yet verified and confirm timing/secret handling.
3. **Open `app/api/register/route.ts`** and verify tenant uniqueness policy.
4. **Per-file grep on the unverified orphans** listed in [03-dead-code.md](03-dead-code.md).
5. Re-run knip with `--include unresolved imports,dependencies,devDependencies,exports,types` and reconcile against this report.

## Trust calibration

This audit is accurate enough to **act on the CRITICAL and HIGH findings**. It is NOT accurate enough to claim "the project has no other security issues" — there are large unread surfaces, and the author was honest about not reading them. Treat the audit as **a high-confidence floor of what's wrong**, not as a ceiling.

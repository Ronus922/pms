# Quality Debt

Not security-critical. These are the rough edges that wear down a codebase if left alone — most are mechanical to fix.

---

## 🟢 `console.*` calls in production code — 18 instances

CLAUDE.md rule 3 forbids `console.log`. The 18 violations split into three groups:

### Drag-and-drop debug (10 of 18) — should be stripped

[app/(dashboard)/housekeeping/page.tsx:685-807](../../app/(dashboard)/housekeeping/page.tsx) — all `console.warn("[DND] ...")` calls instrumenting drag-and-drop state transitions. Useful while debugging the DnD logic, dead noise in production. Verified by author.

```ts
console.warn("[DND] dragStart", { activeId: id, containerId })
console.warn("[DND] dragOver", { ... })
console.warn("[DND] dragOver — BLOCKED anti-bounce")
console.warn("[DND] dragEnd — CROSS-CONTAINER COMMIT", { ... })
// ... 7 more
```

**Fix**: wrap behind a `if (process.env.NODE_ENV === 'development')` block, OR delete entirely. They're shipping to production users' browser consoles right now.

### Defensive error logs (4 of 18) — acceptable

- [components/shared/DateInput.tsx:53, 60](../../components/shared/DateInput.tsx) — invalid ISO date / out-of-window year
- [lib/utils/date-validation.ts:130](../../lib/utils/date-validation.ts) — implausible payload rejected
- [lib/services/email.ts:64](../../lib/services/email.ts) — dev-mode skip notice (explicitly documented in code as intentional)

These log unexpected/exceptional conditions. They're rare and useful. Leave them.

### `src/services/*` (4 of 18) — irrelevant

`src/services/files.ts`, `notifications.ts`, `audit.ts` have error logs. But the whole `src/` directory is dead code (see [03-dead-code.md](03-dead-code.md)). These disappear when `src/` is deleted.

---

## 🟢 `any` types — 6 real violations + 1 false positive

CLAUDE.md rule 3 also forbids `any`. Author opened each:

| File:Line | Type | Note |
|---|---|---|
| [app/(dashboard)/guests/[id]/page.tsx:27](../../app/(dashboard)/guests/[id]/page.tsx) | `useState<any>(null)` | Page state for guest profile — should be typed via the action's return type |
| [components/reservations/ReservationDetailView.tsx:50](../../components/reservations/ReservationDetailView.tsx) | `useState<any>(null)` | Same shape; reservation detail state |
| [lib/stores/reservation-edit-store.ts:228](../../lib/stores/reservation-edit-store.ts) | `mapServerToEdit(res: any)` | Mapper from server payload — write a proper type |
| [lib/stores/reservation-edit-store.ts:407](../../lib/stores/reservation-edit-store.ts) | `result as any` | Coercion — tighten or document why |
| [lib/actions/guest-profile.ts:35](../../lib/actions/guest-profile.ts) | `(reservations as any[]).reduce(...)` | Aggregation over postgres.js result — type the row |
| [lib/actions/guest-profile.ts:43](../../lib/actions/guest-profile.ts) | `(reservations as any[]).filter(...)` | Same |
| ~~[components/calendar/board/DayCell.tsx:39](../../components/calendar/board/DayCell.tsx)~~ | (false positive) | The word "any" appears in a code comment, not a type |

**Fix**: each is a 5-minute correction once you have the type at hand. Lowest priority of all findings, but easy + cheap to clean up.

---

## 🟡 Duplicate invite-form implementations

Two complete invite forms exist:

| File | Entry path | Fields |
|---|---|---|
| [components/permissions/PermissionsManager.tsx:75-336](../../components/permissions/PermissionsManager.tsx) | Permissions page → "הזמן עובד" → `userId === "__invite__"` | fullName, email, phone, password, username, allowGoogleAuth, sendCredentials, role |
| [components/staff/EmployeeSidePanel.tsx:56-256](../../components/staff/EmployeeSidePanel.tsx) | Staff page → "הוסף עובד חדש" → `panelMode === "invite"` | identical field set + role |

Both end up calling the same server action `inviteUser(tenantId, currentUserId, { ... })` in [lib/actions/permissions.ts](../../lib/actions/permissions.ts). Both were synced field-by-field in this session — but they will drift again the next time a field is added unless consolidated.

**Options**:
1. Extract a shared `<InviteEmployeeForm>` component, render in both places.
2. Decide which entry point is canonical and delete the other (the user mentioned earlier they may want to drop the permissions-screen invite).

Architectural call, not mechanical — see [06-action-plan.md](06-action-plan.md) bucket 8.

---

## 🟡 God-components (>500 lines)

Already enumerated in [03-dead-code.md](03-dead-code.md) → "Files known to be live but oversized". Summary:

- `RoomFormDialog.tsx` 1,501 lines — should consume the 7 tab files in `components/rooms/tabs/` (which currently exist but are unused). This is the **easiest god-component to split** because the destination components already exist on disk.
- `housekeeping/page.tsx` 1,099 lines — legitimately complex (drag-drop board with anti-bounce state machine). Not a high-priority split.
- `maintenance.ts`, `cleaning.ts`, `channex.ts` server-action files at 900-1100 lines — splitting these into per-operation files would improve grep/navigation. Behavior-preserving.

---

## ℹ️  Misplaced `"use server"` directive

[lib/services/email.ts](../../lib/services/email.ts) starts with `"use server"`. This is **not wrong** but it's unnecessary — the directive marks the file's exports as server actions callable from clients. The email service is only ever imported by other server-side modules (server actions, API routes). Removing `"use server"` would let the file be imported anywhere on the server without the framework treating its exports as RPC endpoints.

**Risk to remove**: trivial; if any client component imports from this file (none do today), the build would break and you'd find them immediately.

[lib/auth/errors.ts](../../lib/auth/errors.ts) does NOT have `"use server"`, contrary to what my initial grep suggested — the word matched a docstring. Verified by author.

---

## ℹ️  Untracked files from this session

`git status --short` shows 4 untracked-but-not-gitignored files:

```
?? app/(auth)/reset-password/      — new page from step 4
?? app/api/auth/                   — new record-login route
?? app/auth/                       — new callback route
?? lib/services/email.ts           — new email service (nodemailer)
```

These are **current work**, not "leftover noise" — they were created during this session for the username-auth feature. They need to be `git add`'d in the eventual commit covering this feature's work. Not part of this audit's commit.

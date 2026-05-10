# Critical Security Findings

All findings below were verified by the author opening the cited files directly. File:line refs are accurate as of 2026-05-10 21:00 UTC on the `feature/username-auth` branch.

---

## 🔴 CRITICAL-1: Multi-tenant data leak — `getReservationFull` reads any tenant's reservation

**File**: [lib/actions/reservation-detail.ts](../../lib/actions/reservation-detail.ts)

The function signature accepts only `reservationId`:

```ts
export async function getReservationFull(reservationId: string) {  // line 5
  ...
  WHERE r.id = ${reservationId}                                     // line 27 — no tenant filter
```

It then runs 4 follow-up queries (rooms, charges, payments, audit log) — all filtered only by `reservation_id`, none scoped by tenant. No `requireActor()` call anywhere in the function.

**Impact**: Any authenticated user can fetch any reservation in the database by guessing/learning its UUID. Includes guest PII, card last-4 details, audit logs, financial records.

**Fix sketch**:
```ts
const actor = await requireActor()
const [row] = await db`
  SELECT ... FROM reservations r
  WHERE r.id = ${reservationId} AND r.tenant_id = ${actor.tenantId}
`
if (!row) return null  // tenant-scoped not-found = correct (no enumeration)
```

---

## 🔴 CRITICAL-2: Multi-tenant data leak — `getGuestProfile` reads any tenant's guest

**File**: [lib/actions/guest-profile.ts](../../lib/actions/guest-profile.ts)

```ts
export async function getGuestProfile(guestId: string) {            // line 5
  ...
  FROM guests WHERE id = ${guestId}                                 // line 14 — no tenant filter
  ...
  FROM reservations WHERE r.guest_id = ${guestId}                   // line 28 — no tenant filter
```

Same shape as CRITICAL-1: no `requireActor`, no tenant scoping. Cross-tenant guest enumeration if `guestId` is known/guessable.

**Fix**: same pattern as CRITICAL-1. Derive tenant from session, add to every `WHERE`.

---

## 🔴 CRITICAL-3: Multi-tenant data leak — `getReservationDetails`

**File**: [lib/actions/reservations.ts:6-36](../../lib/actions/reservations.ts)

```ts
export async function getReservationDetails(reservationId: string) {  // line 6
  ...
  WHERE r.id = ${reservationId}                                       // line 21 — no tenant filter
```

Same issue. Interestingly, the *mutations* later in the same file (lines 42, 59, 67) DO have `tenant_id` filter — so someone partially hardened this file, just not the read paths.

**Fix**: same pattern.

---

## 🔴 CRITICAL-4: Mutations trust client-supplied `tenantId`

**File**: [lib/actions/reservations.ts:39-72](../../lib/actions/reservations.ts)

```ts
export async function updateReservationStatus(reservationId: string, tenantId: string, status: string) {
  await db`UPDATE reservations SET status = ${status} ... WHERE id = ${reservationId} AND tenant_id = ${tenantId}`
}
export async function toggleVip(reservationId: string, tenantId: string) { ... }
export async function cancelReservation(reservationId: string, tenantId: string) { ... }
```

None of these call `requireActor()`. The `tenantId` argument is taken from the client and used directly in the `WHERE`. A receptionist in tenant A could call `updateReservationStatus(otherReservationId, 'other-tenant-uuid', 'cancelled')` and — if their JS bundle is honest about it — cancel another tenant's reservation.

This contrasts with the hardened pattern in [lib/actions/permissions.ts:124-221](../../lib/actions/permissions.ts) where `inviteUser` and friends use `requireActor()` and derive `tenantId` from session. The reservations file appears to have been written before that pattern was established.

**Fix**: drop the `tenantId` arg or rename to `_tenantId` (ignored), use `actor.tenantId` instead. Add `canManageRole` or appropriate permission check for the action.

---

## 🟠 HIGH-1: Broken-by-design upload pipeline (silent data loss)

See [02-broken-uploads.md](02-broken-uploads.md) for the full breakdown. The TL;DR: `uploadSupplierDocument`, maintenance media, and reservation attachments all store `blob:` URLs into the database. The UI shows "המסמך הועלה בהצלחה" but the files are unrecoverable. This is functionally a critical bug but its remediation is a build-out (Supabase Storage integration), not a one-line fix — hence categorized HIGH here.

---

## 🟠 HIGH-2: Open redirect on `/auth/callback?next=...`

**File**: [app/auth/callback/route.ts](../../app/auth/callback/route.ts)

```ts
const next = searchParams.get("next") || "/dashboard"                  // line 32
...
return NextResponse.redirect(`${origin}${next}`)                       // line 77
```

`next` is unvalidated. With `origin = "https://pms.bios.co.il"` and a crafted `next`, an attacker can phish:

- `next=//attacker.com/login` → browser may parse `https://pms.bios.co.il//attacker.com/login` as scheme-relative
- `next=@attacker.com` → URL becomes `https://pms.bios.co.il@attacker.com` (userinfo syntax) → some browsers redirect to `attacker.com`
- `next=/dashboard?x=<svg onload=...>` → reflected payload

Combined with a successful OAuth login, this gives a credible phishing primitive ("login then go to your dashboard" but it's actually attacker.com).

**Fix**:
```ts
const next = searchParams.get("next") || "/dashboard"
const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
return NextResponse.redirect(`${origin}${safe}`)
```

---

## 🟠 HIGH-3: Channex webhook bypass via `property_id` fallback

**File**: [app/api/channex/webhooks/route.ts:66-84](../../app/api/channex/webhooks/route.ts)

The webhook tries to match the request by `webhook_secret` first:

```ts
if (providedSecret) {
  const [row] = await db`SELECT id, tenant_id FROM channel_connections
    WHERE webhook_secret = ${providedSecret}::text AND status IN ('connected','pending')`
  if (row) connectionRow = row
}

// Fallback: match by property_id payload → channel_property_links
if (!connectionRow && body.property_id) {
  const [row] = await db`SELECT pl.connection_id AS id, pl.tenant_id
    FROM channel_property_links pl
    WHERE pl.channex_property_id = ${body.property_id}::uuid`
  if (row) connectionRow = row
}
```

If `providedSecret` is missing or invalid, the route falls back to matching by the `property_id` in the request body — **with no authentication**. Channex property IDs are UUIDs; not literally guessable, but they can leak (logs, support tickets, screenshots, internal docs). Anyone with a property_id can POST arbitrary booking-event payloads that get processed as if they came from Channex.

**Fix**: remove the fallback. If `providedSecret` is missing or doesn't match a known connection, reject with 401. The fallback should be replaced with an explicit per-Channex-property webhook URL like `/api/channex/webhooks/[propertyId]` if needed.

---

## 🟠 HIGH-4: Cron routes use non-timing-safe string comparison

**Files**: `app/api/cron/automation-queue/route.ts`, `app/api/cron/channex-worker/route.ts`, `app/api/cron/cleaning-morning/route.ts`, `app/api/cron/maintenance-recurring/route.ts` _[unverified for the last 3 — author only opened automation-queue]_

```ts
if (secret !== expected) return 401
```

Not timing-safe. An attacker who can rapidly send requests and measure response timing could in theory brute-force the CRON_SECRET byte-by-byte. Practically hard but trivially fixable.

**Fix**: use `crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))` and ensure equal lengths before comparison.

---

## 🟡 MEDIUM-1: `lookupEmailByUsername` enables username enumeration

**File**: [lib/actions/auth.ts:20-38](../../lib/actions/auth.ts)

This is a public (no-auth) server action by design — it's how the login page resolves "type a username, get the email to actually `signInWithPassword` with". The implementation returns `{ email: null }` if the username doesn't exist. The login page uses a single generic error message for both "wrong password" and "no such username" (good), but:

- Timing differences (DB hit vs no DB hit) could allow username enumeration via repeated probes
- The function has no rate limit at the server-action layer

**Tradeoff**: this is inherent to the feature (you can't have username login without giving an oracle for "this username exists"). Acceptable risk if the application is intended for trusted tenant operators only, not a public-facing signup.

**Mitigation if needed**: add a rate limit on the action (5/min per IP), and add `await new Promise(r => setTimeout(r, jitter(50,150)))` to mask DB-hit timing.

---

## 🟡 MEDIUM-2: `register` endpoint creates tenants without uniqueness check

**File**: [app/api/register/route.ts:135-139](../../app/api/register/route.ts) _[unverified — Agent B's finding, not re-opened by author]_

Self-signup creates a new tenant with the user-supplied `businessName` and no namespace check. If anything in the app uses business name for routing (subdomain, slug, etc.), this is a tenant-name-hijacking vector. If business name is purely display, this is fine.

**Verify**: grep for places `tenants.business_name` or similar slug fields are used in routing.

---

## ℹ️  Verified-secure patterns worth knowing

These were checked and found correct — useful to know so future changes don't regress them:

- **Service-role key confined**: `SUPABASE_SERVICE_ROLE_KEY` is only read by [lib/supabase/server.ts:43](../../lib/supabase/server.ts). Author grep confirmed zero usage in any `"use client"` file.
- **No sensitive `NEXT_PUBLIC_*`**: only the legitimate four (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `GOOGLE_MAPS_API_KEY`). Verified by author.
- **No hardcoded secrets**: no credentials embedded in code (grep clean).
- **Role escalation prevented**: [lib/actions/permissions.ts:225-290](../../lib/actions/permissions.ts) `updateUserRole` properly blocks self-promotion and enforces `canManageRole(actor.role, newRole)` AND `canManageRole(actor.role, target.role)`. `inviteUser` (lines 124-221) and `updateUserPermissions` (lines 294-342) follow the same pattern.
- **XSS via `dangerouslySetInnerHTML`**: both uses ([components/automations/CreateTemplatePanel.tsx:136-140](../../components/automations/CreateTemplatePanel.tsx), [components/automations/TemplateDetailPanel.tsx:274-280](../../components/automations/TemplateDetailPanel.tsx)) pass content through `sanitizeHtml` from [lib/utils/sanitize-html.ts](../../lib/utils/sanitize-html.ts) first. Safe.
- **`record-login` API route**: looks unauthenticated but the underlying `recordLastLogin()` reads the user from cookie session via `supabase.auth.getUser()` — if no session, the function is a no-op. Effectively safe.

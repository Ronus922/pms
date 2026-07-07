# Decisions — Reservation Email Notifications (2026-07-07)

Autonomous build. Everything below was decided from the audit; open items are flagged **UNRESOLVED**.

## Transport
- **Chose Gmail SMTP** (`lib/services/email.ts` `sendEmail`) — creds are configured in
  `.env.local` (`GMAIL_USER`/`GMAIL_APP_PASSWORD`), supports HTML, and nodemailer accepts a
  comma-separated `to` for multi-recipient (used for the internal email).
- **Rejected the MAIL_SYSTEM_URL microservice.** It is dead: `MAIL_SYSTEM_URL=http://localhost:3002`
  points at a *different* app (sys-app, returns 401), and the real mail-system on `:3008` is a
  Gmail-inbox reader (`/api/emails`, `/api/gmail`, …) with **no `/api/send` route → 404**.
- **UNRESOLVED (out of scope):** `lib/services/automation-engine.ts` still POSTs to the dead
  `/api/send`, so automation emails silently fail. Follow-up: migrate automation-engine to
  `sendEmail`, or stand up a real `/api/send` transport and fix `MAIL_SYSTEM_URL`.
- **UNRESOLVED — DELIVERY BLOCKER (needs the account owner):** a live end-to-end send during
  verification returned Gmail SMTP `535-5.7.8 BadCredentials` for both emails. The
  `GMAIL_APP_PASSWORD` in `.env.local` (account `r@bios.co.il`) is rejected — so **no transport
  currently delivers** (microservice 404 + Gmail bad-creds). The feature code is correct and
  degrades gracefully: sends are logged to `message_log` as `failed` with the exact SMTP error, and
  reservation creation is unaffected (this is live proof of VERIFY #5). **To actually deliver, set a
  valid `GMAIL_USER`/`GMAIL_APP_PASSWORD`** (Workspace account with 2FA + a fresh App Password), or
  point the app at a working transport. Nothing else in this feature is blocked.

## Entry points / wiring
- `createReservation` (`lib/actions/create-reservation.ts`) is the **only** `INSERT INTO reservations`
  path (grep-verified; sole UI caller is `ReservationModal`). Wired the shared service there,
  fire-and-forget.
- **Channex bookings do not auto-materialise into `reservations`** — `orchestrator.importRevision`
  deliberately defers that (bookings live in `channel_booking_revisions`; operators push them into
  the reservation form, which then goes through `createReservation`). So the Channex path fires the
  internal email **via the operator push**, and external-source detection suppresses the guest email.
  Left a CORE-RULE comment in `importRevision` so any future auto-materialise also calls
  `sendReservationNotifications`.
- Replaced/deleted the old `lib/actions/send-reservation-email.ts` (`sendReservationConfirmationEmail`)
  — it emailed guest+business unconditionally through the dead microservice; superseded.

## Send timing
- **Inline fire-and-forget** (`sendReservationNotifications(...).catch(()=>{})`, not awaited). The
  service wraps everything in try/catch and never throws, so email failure can't fail reservation
  creation or webhook ingestion. No queue added (`message_queue` exists but a queue was YAGNI here).

## External-source detection
- Reused the canonical server-side `isExternalSource(source, external_id, channel_manager_id)` from
  `lib/constants/reservation.ts` — no new set. Guest email only when it returns `false` AND the guest
  has a valid email AND `guest_email_enabled`.

## Schema (Phase B)
- Audit found `tenants` already has `name`, `brand_name`, `address`, `phone`, `website`, `email`,
  `logo_url`, `default_checkin_time`, `default_checkout_time`. Migration
  `scripts/migrations/2026-07-07_reservation_notify.sql` adds only the 3 missing columns:
  `reservation_notify_emails text`, `guest_email_enabled boolean default true`, `terms_text text`.
- Seeded `reservation_notify_emails` from the legacy single `notification_email`. Internal recipients
  read **only** from `reservation_notify_emails`; empty → no internal send (per spec). Legacy
  `notification_email` kept for backward-compat but no longer drives reservation email.

## Audit log
- Reused `message_log` (`channel_type='email'`, `delivery_status` ∈ `sent|skipped|failed`,
  `error_message` = skip/fail reason). No CHECK constraint on `delivery_status` (verified), so
  `skipped` is safe. No new table.

## i18n
- `guests.preferred_language` in use = `he` only. Guest template: Hebrew by default; anything not
  starting with `he` → English variant of the same template. Missing business fields render as
  nothing (never "undefined").

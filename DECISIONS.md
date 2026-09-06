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

---

# מנוע תמחור ותשלומים בהזמנות — 2026-07-25

ענף `feat/reservation-pricing-engine`, worktree `/var/www/wt-pms-pricing`.

## פרוטוקול ה-LOCKED — נפתח ותועד

`claude/PROJECT_MEMORY.md` מסמן את מודול ההזמנות **LOCKED as of 2026-04-10**, ו"pricing
calculation" ו-"card fields" נמצאים מפורשות ברשימת מה שנעול. חמישה מקבצי המפתח הנעולים
נגעו: `create-reservation.ts`, `reservation-update.ts`, `reservation-form-store.ts`,
`reservation-edit-store.ts`, `Step3Pricing.tsx`.

הפרוטוקול אינו דורש אסימון אישור אנושי — הוא דורש **בדיקת רגרסיה בת 10 נקודות** לפני כל
שינוי. היא בוצעה ומתועדת ב-`ref/audit/pricing-tests.md`. העבודה כולה בענף מבודד, ללא דפלוי.
`components/shared/DateInput.tsx` לא נגע.

## שיעור המע"מ — לכל הזמנה, לא לכל דייר

`tenants.vat_rate` הוא שדה **משתנה**, והוא כבר שונה 17 → 18. ארבע הזמנות חיות נמכרו ב-17%.
כל חישוב מחדש לפי שיעור הדייר הנוכחי היה מציג אותן מחדש בטעות.

לכן נוספה `reservations.vat_rate` (שבר, 4 ספרות) והיא ממולאת **מהמספרים של השורה עצמה**:
`tax_amount / (total_price − tax_amount)`. אומת על 20/20 השורות החיות לפני כתיבת המיגרציה
(`ref/proof/backfill-parity-live.txt`), ומקובע כטסט רגרסיה קבוע ב-`lib/pricing/backfill-parity.test.ts`.

**הבהרה לניסוח הבקשה:** הבקשה ביקשה להוסיף `vat_rate NUMERIC(5,4) DEFAULT 0.18` ברמת הדייר
"אם אין". **יש** — `tenants.vat_rate NUMERIC(5,2) DEFAULT 17.00`, השומר **אחוזים**. לא נוספה
עמודה כפולה; המנוע מחלק ב-100.

## `subtotal` שומר על משמעותו

`subtotal` נכתב היסטורית כ-`baseAmount` (לפני הנחה, לפני תוספות), ו-
`ReservationPrintView.tsx:272` גוזר ממנו את שורת ההנחה כ-`subtotal × discount_percent/100`.
לכן `subtotal = pricing.grossBeforeDiscount` ולא הנטו — שינוי המשמעות היה משבש בשקט כל הדפסה.

## `manual_total` — הסכום הוא הסכום

במצב `manual_total` הנחות ותוספות **אינן** מוחלות שוב, אחרת הדרישה "הסכום הסופי הוא בדיוק
manualTotal, בלי הפרש עיגול" אינה ניתנת לקיום. ה-UI מסתיר את שני הפקדים במצב הזה ומסביר למה.
טוגל "כולל מע"מ" עדיין קובע אם הסכום שהוזן מכיל מע"מ.

## CHECK במקום ENUM

הבקשה ציינה `ENUM` ל-`discount_type`. מומש כ-`CHECK` — אותה הבטחה, ורולבק שאינו נדרש למחוק
טיפוס שאובייקטים אחרים כבר עשויים להסתמך עליו.

## מקדמה = תשלום

`balanceDue = grandTotal − paid`, כאשר `paid = total_paid + deposit`. זה תואם לעמודה
ה-GENERATED `balance_due = total_price − total_paid` ומבטל את הפער שבו ה-preview ביצירה הראה
יתרה אחת וכל תצוגה שאחרי השמירה הראתה אחרת.

## סעיף 10 — "הערות חיוב": אין מה להסיר

חיפוש בכל הריפו: `grep -rn "הערות חיוב"` → **0 תוצאות**. `billing_notes` / `billingNotes` →
**0 תוצאות**. שדות ההערות הקיימים: `general_notes`, `internal_notes`, `reception_notes`,
`cleaning_notes`, `maintenance_notes`. אף אחד מהם אינו מתויג "הערות חיוב" (הקרוב ביותר בתווית
הוא `reception_notes` → "הערות קבלה").

**החלטה:** אין מיגרציה ואין שינוי UI. ניחוש שאחד מהשדות הקיימים הוא "הערות חיוב" והעברת תוכנו
ל-`general_notes` היא פעולה הרסנית על סמך השערה. הסעיף מסומן `N/A-NOT-PRESENT`.

## סעיף 11 — סדר "הערות" מול "מדיניות ביטול": אין מה לסדר

אין קומפוננטת מדיניות ביטול. `cancellation_policy` היא עמודה שנכתבת ב-
`reservation-update.ts:207` ואינה מוצגת באף קומפוננטה. כרטיס "הערות" קיים
(`Step4Review.tsx:350`, `EditStep4Summary.tsx:214`) והריווח כבר `gap` על ההורה.

**החלטה:** לא נבנה כרטיס מדיניות ביטול חדש — זו הרחבת תחום, לא שינוי סדר. הסעיף מסומן
`N/A-NOT-PRESENT`.

## סעיף 12 — CVC מהערוץ: חסום חיצונית

`channel_booking_revisions` = **0 שורות**. `channel_webhook_events` = 0. `channel_connections` = 0.
`lib/integrations/channex/client.ts` מממש 12 פונקציות, **אף אחת אינה endpoint תשלום/כרטיס**.
`guarantee?: unknown` (`types.ts:221`) אינו נקרא בשום מקום. המחרוזת "לא התקבל קוד סודי מהערוץ"
וכרטיס "גבייה מהערוץ" אינם קיימים.

**החלטה:** לא נבנתה חשיפת CVC ולא נבנו מצבי "למה לא זמין". ה-probe קבע שאין מקור נתונים, וגם
ארבעת המצבים אינם ניתנים לזיהוי מהנתונים שיש (ראה `ref/audit/pricing-security.md` §ב).
בניית UI כזה עכשיו הייתה שילוח פיצ'ר לא-ניתן-לבדיקה מול מקור לא-מוכח. הסעיף מסומן
`BLOCKED-EXTERNAL`. מה שנדרש כדי לפתוח אותו מפורט בדוח האבטחה §א.

## PCI — מה נשמר ומה לא

נשמרות: 4 ספרות אחרונות, שם בעל הכרטיס, ת.ז., תוקף, קוד אישור, אסמכתא, תשלומים.
**לא נשמרים: מספר כרטיס מלא ו-CVV — גם לא מוצפנים.** אין להם עמודה, ו-CHECK ברמת ה-DB
(`reservations_card_last4_check`) דוחה כל ערך שאינו 4 ספרות. הוכח בדחייה בפועל בעת ה-dry-run.

`CardNumberInput` הקודם החזיק PAN מלא בן 16 ספרות ב-state של React (מיסוך לתצוגה בלבד) — הוסר.

## פערים שאותרו ולא תוקנו כאן

- `payments` ו-`reservation_charges` נקראות ואף קוד אינו כותב אליהן. פאנל היסטוריית התשלומים
  יישאר ריק לכל הזמנה שנוצרה במערכת. **לא תוקן** — יצירת שכבת תשלומים היא תחום נפרד.
- אין כותב audit log חי. `createAuditLog` יושב ב-`src/services/audit.ts` שהוא קוד מת
  (`@/*` ממופה לשורש, לא ל-`src/`), הקוד החי קורא מ-`audit_log` ביחיד, ו-`audit_logs` ברבים
  אינה קיימת ב-DB כלל (`to_regclass` → NULL). אפס INSERT בכל הקוד החי.
- 22 קריאות `requirePermission` ב-`lib/actions/channex.ts` משתמשות במודול `"rooms"` ולא
  ב-`"channels"` הקיים.
- `rate_plans` ריקה (0 שורות) ומסך `/rate-plans` הוא stub "בפיתוח". תשתית ה-LOS נבנתה, אך אין
  עדיין תוכניות להחיל.

## סבב שני — `manual_nightly` היה no-op

`computePricing` הסתעף על `manual_total` בלבד. המצב הידני-ללילה הוחל אך ורק בתוך
`resolveNightRates`, ו**שום קוד באפליקציה לא קרא לפונקציה הזו** — כל הסטורים וה-server
actions בנו `NightRate[]` ידנית. לכן הזמנה שהוגדרה "מחיר ידני ללילה" חויבה בשקט לפי מחיר
המערכת, גם ב-preview וגם בשמירה.

הבדיקה של סעיף 2 עברה כי היא בדקה `manual_total`. **אסרשן שעובר מהסיבה הלא נכונה שווה
לאסרשן שנכשל.**

**החלטה:** `computePricing` מחיל את המצב בעצמו, כך שהמנוע נכון בכל מסלול קריאה ולא רק
כשהקורא זכר לעבור דרך ה-resolver. אידמפוטנטי מול `resolveNightRates`. נתונים קיימים לא
הושפעו — ה-backfill העמיד כל הזמנה על `manual_total`.

## מטבע — אחד לחשבון

`reservation_rooms.currency` קיימת והבורר מוצג, אך **המנוע אינו ממיר מטבעות**. חיבור חדרים
במטבעות שונים היה באג כסף שקט, והמצאת שער חליפין הייתה מחזירה אריתמטיקה אל מחוץ למנוע.
בורר המטבע ברמת החדר כותב את מטבע ההזמנה ומדליף לכל החדרים, עם הסבר גלוי ב-UI.
המרת FX אמיתית — תחום נפרד, לא נפתח כאן.

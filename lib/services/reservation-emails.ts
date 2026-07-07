import "server-only"

import { db } from "@/lib/db"
import { sendEmail } from "@/lib/services/email"
import { isExternalSource, SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants/reservation"

/**
 * Reservation email notifications — the ONE shared entry point.
 *
 * Called fire-and-forget from every reservation-creation path (currently
 * lib/actions/create-reservation.ts, which is also how Channex bookings become
 * reservations via the operator push). Never throws — email must never fail
 * reservation creation or webhook ingestion.
 *
 * Two emails, decided server-side:
 *   1. INTERNAL — always, every source — to tenants.reservation_notify_emails.
 *   2. GUEST CONFIRMATION — only for DIRECT sources (isExternalSource === false)
 *      AND when the guest has an email AND tenants.guest_email_enabled. External
 *      channels (booking/airbnb/expedia/channel-manager) email the guest from
 *      their own platform — we never do.
 *
 * Every send/skip/failure is written to message_log (channel_type='email').
 *
 * Transport: lib/services/email.ts (Gmail SMTP / nodemailer). The old
 * MAIL_SYSTEM_URL /api/send path is dead (that endpoint 404s) — see DECISIONS.md.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pms.bios.co.il"
const BRAND = "#2540C8" // Azure Ethos primary — guest confirmation only

/* ── DB shapes ───────────────────────────────────────────── */

interface ResRow {
  id: string
  reservation_number: string
  status: string
  source: string | null
  channel: string | null
  external_id: string | null
  channel_manager_id: string | null
  check_in: string | Date
  check_out: string | Date
  adults: number
  children: number
  infants: number
  subtotal: string | number | null
  tax_amount: string | number | null
  total_price: string | number | null
  total_paid: string | number | null
  balance_due: string | number | null
  special_requests: string | null
  general_notes: string | null
  guest_first_name: string | null
  guest_last_name: string | null
  guest_full_name: string | null
  guest_email: string | null
  guest_phone: string | null
  preferred_language: string | null
  business_name: string | null
  brand_name: string | null
  address: string | null
  business_phone: string | null
  website: string | null
  business_email: string | null
  logo_url: string | null
  currency: string | null
  default_checkin_time: string | null
  default_checkout_time: string | null
  reservation_notify_emails: string | null
  guest_email_enabled: boolean
  terms_text: string | null
}

interface RoomRow {
  check_in: string
  check_out: string
  adults: number
  children: number
  infants: number
  room_number: string | null
  room_type_name: string | null
}

/* ── Formatting helpers ──────────────────────────────────── */

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Date | 'yyyy-mm-dd' → dd/MM/yyyy. postgres.js returns `date` cols as Date
 *  objects, so handle both. Safe on nulls. */
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—"
  const dt = d instanceof Date ? d : new Date(String(d))
  if (isNaN(dt.getTime())) return String(d).slice(0, 10)
  const day = String(dt.getDate()).padStart(2, "0")
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  return `${day}/${m}/${dt.getFullYear()}`
}

function hhmm(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : ""
}

function currencySymbol(cur: string | null): string {
  return cur === "USD" ? "$" : cur === "EUR" ? "€" : "₪"
}

function money(v: string | number | null | undefined, cur: string | null): string {
  const n = Number(v ?? 0)
  return `${currencySymbol(cur)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function nights(ci: string | Date, co: string | Date): number {
  const a = (ci instanceof Date ? ci : new Date(String(ci))).getTime()
  const b = (co instanceof Date ? co : new Date(String(co))).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

function isHebrew(lang: string | null): boolean {
  return !lang || lang.toLowerCase().startsWith("he")
}

function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function guestName(r: ResRow): string {
  return (
    r.guest_full_name?.trim() ||
    [r.guest_first_name, r.guest_last_name].filter(Boolean).join(" ").trim() ||
    "אורח/ת"
  )
}

function businessName(r: ResRow): string {
  return r.business_name?.trim() || r.brand_name?.trim() || "GuestHub"
}

function roomsSummary(rooms: RoomRow[]): string {
  if (rooms.length === 0) return "—"
  return rooms
    .map((rm) => {
      const label = rm.room_number ? `חדר ${rm.room_number}` : rm.room_type_name || "חדר"
      return rm.room_type_name && rm.room_number ? `${label} (${rm.room_type_name})` : label
    })
    .join(", ")
}

/* ── Internal email (plain Hebrew RTL summary) ───────────── */

function buildInternalHtml(r: ResRow, rooms: RoomRow[]): string {
  const cur = r.currency
  const occ = `${r.adults} מבוגרים${r.children ? `, ${r.children} ילדים` : ""}${r.infants ? `, ${r.infants} תינוקות` : ""}`
  const sourceLabel = r.source ? SOURCE_LABELS[r.source] || r.source : "—"
  const link = `${APP_URL}/reservations/${r.id}`
  const notes = [r.special_requests, r.general_notes].filter(Boolean).join(" · ")

  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:700;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${v}</td></tr>`

  return `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:16px;background:#f4f5f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1b22;direction:rtl">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e5ea;border-radius:10px;padding:20px">
    <h2 style="margin:0 0 4px;font-size:18px">הזמנה חדשה #${escapeHtml(r.reservation_number)}</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${escapeHtml(businessName(r))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("מספר הזמנה", escapeHtml(r.reservation_number))}
      ${row("מקור", escapeHtml(sourceLabel))}
      ${row("סטטוס", escapeHtml(STATUS_LABELS[r.status] || r.status))}
      ${row("אורח/ת", escapeHtml(guestName(r)))}
      ${row("טלפון", r.guest_phone ? `<span dir="ltr">${escapeHtml(r.guest_phone)}</span>` : "—")}
      ${row("אימייל", r.guest_email ? `<span dir="ltr">${escapeHtml(r.guest_email)}</span>` : "—")}
      ${row("כניסה", fmtDate(r.check_in))}
      ${row("יציאה", fmtDate(r.check_out))}
      ${row("לילות", String(nights(r.check_in, r.check_out)))}
      ${row("חדרים", escapeHtml(roomsSummary(rooms)))}
      ${row("תפוסה", escapeHtml(occ))}
      ${row("סכום ביניים", money(r.subtotal, cur))}
      ${row('מע"מ', money(r.tax_amount, cur))}
      ${row('סה"כ', `<strong>${money(r.total_price, cur)}</strong>`)}
      ${row("שולם", money(r.total_paid, cur))}
      ${row("יתרה", money(r.balance_due, cur))}
      ${notes ? row("הערות", escapeHtml(notes)) : ""}
    </table>
    <p style="margin:18px 0 0">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">פתיחת ההזמנה במערכת</a>
    </p>
  </div>
</body></html>`
}

/* ── Guest confirmation (designed HTML, table-based, inline CSS) ── */

function buildGuestHtml(r: ResRow, rooms: RoomRow[]): string {
  const he = isHebrew(r.preferred_language)
  const dir = he ? "rtl" : "ltr"
  const lang = he ? "he" : "en"
  const cur = r.currency
  const biz = businessName(r)
  const ci = hhmm(r.default_checkin_time) || (he ? "" : "")
  const co = hhmm(r.default_checkout_time)
  const guestCount = r.adults + r.children + r.infants

  const t = he
    ? {
        confirmed: "ההזמנה שלך אושרה",
        hello: `שלום ${guestName(r)},`,
        intro: "תודה שבחרת בנו! להלן פרטי ההזמנה שלך:",
        resNo: "מספר הזמנה",
        checkIn: "כניסה",
        checkOut: "יציאה",
        from: "משעה",
        until: "עד שעה",
        rooms: "חדרים",
        guests: "אורחים",
        total: "סכום כולל",
        contact: "פרטי יצירת קשר",
        terms: "תנאים והערות",
        auto: "מייל זה נשלח אוטומטית עם אישור ההזמנה.",
      }
    : {
        confirmed: "Your reservation is confirmed",
        hello: `Hello ${guestName(r)},`,
        intro: "Thank you for booking with us! Here are your reservation details:",
        resNo: "Reservation number",
        checkIn: "Check-in",
        checkOut: "Check-out",
        from: "from",
        until: "until",
        rooms: "Rooms",
        guests: "Guests",
        total: "Total",
        contact: "Contact details",
        terms: "Terms & notes",
        auto: "This email was sent automatically upon confirmation of your reservation.",
      }

  const line = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f5;color:#6b7280;font-size:13px">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f5;font-size:14px;font-weight:600;color:#1a1b22;text-align:${he ? "left" : "right"}">${value}</td>
    </tr>`

  const contactBits = [
    r.address ? escapeHtml(r.address) : "",
    r.business_phone ? `<span dir="ltr">${escapeHtml(r.business_phone)}</span>` : "",
    r.business_email ? `<span dir="ltr">${escapeHtml(r.business_email)}</span>` : "",
    r.website ? `<a href="${escapeHtml(r.website)}" style="color:${BRAND};text-decoration:none">${escapeHtml(r.website)}</a>` : "",
  ].filter(Boolean)

  const logo = r.logo_url
    ? `<img src="${escapeHtml(r.logo_url)}" alt="${escapeHtml(biz)}" style="max-height:44px;max-width:180px;display:block;margin:0 auto 8px" />`
    : ""

  const checkInLine = ci ? `${fmtDate(r.check_in)} · ${t.from} ${ci}` : fmtDate(r.check_in)
  const checkOutLine = co ? `${fmtDate(r.check_out)} · ${t.until} ${co}` : fmtDate(r.check_out)

  return `<!doctype html>
<html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f8;direction:${dir}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f8;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Segoe UI',Tahoma,Arial,sans-serif;box-shadow:0 4px 16px rgba(37,64,200,0.08)">
        <tr>
          <td style="background:${BRAND};padding:28px 32px;text-align:center">
            ${logo}
            <div style="color:#ffffff;font-size:15px;font-weight:700;opacity:.95">${escapeHtml(biz)}</div>
            <div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:6px">${escapeHtml(t.confirmed)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1b22">${escapeHtml(t.hello)}</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563">${escapeHtml(t.intro)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${line(t.resNo, `<span dir="ltr">${escapeHtml(r.reservation_number)}</span>`)}
              ${line(t.checkIn, escapeHtml(checkInLine))}
              ${line(t.checkOut, escapeHtml(checkOutLine))}
              ${line(t.rooms, escapeHtml(roomsSummary(rooms)))}
              ${line(t.guests, String(guestCount))}
              ${line(t.total, `<span style="color:${BRAND};font-weight:800">${money(r.total_price, cur)}</span>`)}
            </table>
          </td>
        </tr>
        ${
          contactBits.length
            ? `<tr><td style="padding:0 32px 20px">
                 <div style="background:#f6f8fd;border-radius:12px;padding:16px 18px">
                   <div style="font-size:12px;font-weight:800;color:${BRAND};margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px">${escapeHtml(t.contact)}</div>
                   <div style="font-size:13px;line-height:1.9;color:#374151">${contactBits.join("<br>")}</div>
                 </div>
               </td></tr>`
            : ""
        }
        ${
          r.terms_text
            ? `<tr><td style="padding:0 32px 24px">
                 <div style="font-size:12px;font-weight:800;color:#6b7280;margin-bottom:6px">${escapeHtml(t.terms)}</div>
                 <div style="font-size:12px;line-height:1.7;color:#9ca3af;white-space:pre-wrap">${escapeHtml(r.terms_text)}</div>
               </td></tr>`
            : ""
        }
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #eef0f5;text-align:center;font-size:11px;color:#9ca3af">
            ${escapeHtml(t.auto)}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/* ── Audit log ───────────────────────────────────────────── */

type LogStatus = "sent" | "skipped" | "failed"

async function logEmail(
  tenantId: string,
  recipient: string,
  subject: string,
  status: LogStatus,
  opts: { body?: string; error?: string } = {},
): Promise<void> {
  try {
    const now = new Date()
    await db`
      INSERT INTO message_log
        (tenant_id, channel_type, recipient, subject, body_snapshot,
         delivery_status, sent_at, failed_at, error_message)
      VALUES
        (${tenantId}, 'email', ${recipient}, ${subject}, ${opts.body ?? ""},
         ${status},
         ${status === "sent" ? now : null},
         ${status === "failed" ? now : null},
         ${opts.error ?? null})
    `
  } catch {
    /* audit failure must never affect the send flow */
  }
}

/* ── Context loader (shared by send + preview) ───────────── */

async function loadContext(
  tenantId: string,
  reservationId: string,
): Promise<{ r: ResRow; rooms: RoomRow[] } | null> {
  const [r] = (await db`
    SELECT
      r.id, r.reservation_number, r.status, r.source, r.channel,
      r.external_id, r.channel_manager_id,
      r.check_in, r.check_out, r.adults, r.children, r.infants,
      r.subtotal, r.tax_amount, r.total_price, r.total_paid, r.balance_due,
      r.special_requests, r.general_notes,
      g.first_name AS guest_first_name, g.last_name AS guest_last_name,
      g.full_name AS guest_full_name, g.email AS guest_email,
      g.phone AS guest_phone, g.preferred_language,
      t.name AS business_name, t.brand_name, t.address,
      t.phone AS business_phone, t.website, t.email AS business_email,
      t.logo_url, t.currency, t.default_checkin_time, t.default_checkout_time,
      t.reservation_notify_emails, t.guest_email_enabled, t.terms_text
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    JOIN tenants t ON t.id = r.tenant_id
    WHERE r.id = ${reservationId} AND r.tenant_id = ${tenantId}
    LIMIT 1
  `) as unknown as ResRow[]
  if (!r) return null

  const rooms = (await db`
    SELECT rr.check_in, rr.check_out, rr.adults, rr.children, rr.infants,
           rm.room_number, rt.name AS room_type_name
    FROM reservation_rooms rr
    LEFT JOIN rooms rm ON rm.id = rr.room_id
    LEFT JOIN room_types rt ON rt.id = rm.room_type_id
    WHERE rr.reservation_id = ${reservationId} AND rr.tenant_id = ${tenantId}
    ORDER BY rr.check_in
  `) as unknown as RoomRow[]

  return { r, rooms }
}

/* ── Entry point ─────────────────────────────────────────── */

export async function sendReservationNotifications(
  tenantId: string,
  reservationId: string,
): Promise<void> {
  try {
    const ctx = await loadContext(tenantId, reservationId)
    if (!ctx) return
    const { r, rooms } = ctx

    const biz = businessName(r)

    /* 1 ── INTERNAL EMAIL — always, every source ── */
    const recipients = (r.reservation_notify_emails || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && validEmail(s))

    const internalSubject = `הזמנה חדשה #${r.reservation_number} — ${biz}`
    if (recipients.length === 0) {
      await logEmail(tenantId, "", internalSubject, "skipped", {
        error: "no_internal_recipients",
      })
    } else {
      const html = buildInternalHtml(r, rooms)
      const to = recipients.join(",")
      const res = await sendEmail({ to, subject: internalSubject, html })
      await logEmail(tenantId, to, internalSubject, res.success ? "sent" : "failed", {
        body: html,
        error: res.success ? undefined : res.error,
      })
    }

    /* 2 ── GUEST CONFIRMATION — direct sources only, opt-in, has email ── */
    const external = isExternalSource(r.source, r.external_id, r.channel_manager_id)
    const guestSubject = isHebrew(r.preferred_language)
      ? `אישור הזמנה #${r.reservation_number} — ${biz}`
      : `Reservation confirmation #${r.reservation_number} — ${biz}`

    let skipReason: string | null = null
    if (external) skipReason = "external_source"
    else if (!r.guest_email || !validEmail(r.guest_email)) skipReason = "no_guest_email"
    else if (!r.guest_email_enabled) skipReason = "guest_email_disabled"

    if (skipReason) {
      await logEmail(tenantId, r.guest_email || "", guestSubject, "skipped", {
        error: skipReason,
      })
    } else {
      const html = buildGuestHtml(r, rooms)
      const res = await sendEmail({ to: r.guest_email!, subject: guestSubject, html })
      await logEmail(
        tenantId,
        r.guest_email!,
        guestSubject,
        res.success ? "sent" : "failed",
        { body: html, error: res.success ? undefined : res.error },
      )
    }
  } catch {
    /* Never throw — email must not fail reservation creation / webhook ingest. */
  }
}

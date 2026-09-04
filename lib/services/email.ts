"use server"

/**
 * Email service — SMTP via nodemailer, configured from env.
 *
 * Production: the Google Workspace SMTP relay, which authorises the server's
 * registered IP addresses — no password:
 *   SMTP_HOST=smtp-relay.gmail.com
 *   SMTP_PORT=587                (empty = 587)
 *   SMTP_SECURE=false            (true = full TLS, e.g. 465; false = STARTTLS required)
 *   GMAIL_USER=name@bios.co.il   (sender; must be an address in the relay's domain)
 *   EMAIL_FROM="GuestHub <name@bios.co.il>"   (optional display form of the sender)
 *   GMAIL_APP_PASSWORD=          (optional; when set → authenticated login as GMAIL_USER)
 *
 * Why the relay: Google rejected App-Password logins from this server's IPv6
 * address (535 BadCredentials) while accepting IPv4, and Node picks an address
 * family per connection — so sends failed intermittently. The relay accepts
 * both registered addresses. To go back to an authenticated login, set
 * SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true and a password.
 *
 * Limits: relay ~10,000/day per Workspace user.
 *
 * If SMTP_HOST / GMAIL_USER are unset:
 *   - In dev: logs to console, returns success (so flows aren't blocked).
 *   - In prod: returns failure with a clear error.
 */

import nodemailer, { type Transporter } from "nodemailer"

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || "587")
const SMTP_SECURE = process.env.SMTP_SECURE === "true"
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const FROM =
  process.env.EMAIL_FROM ||
  `GuestHub <${GMAIL_USER || "noreply@guesthub.app"}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://guesthub.app"

let transporter: Transporter | null = null

/* Same safety net as sea-tower's mailer: each attempt opens a new connection,
   so a transient rejection is retried with a short backoff. */
const MAX_ATTEMPTS = 4
const BACKOFF_MS = [500, 1000, 2000]
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* nodemailer attaches code (EAUTH, EENVELOPE, ECONNECTION, ETIMEDOUT...). The
   message may contain addresses — only the code goes to the log. */
function errorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && typeof e.code === "string") {
    return e.code.slice(0, 40)
  }
  return "unknown"
}

function getTransporter(): Transporter | null {
  if (!SMTP_HOST || !GMAIL_USER) return null
  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      // Without full TLS, STARTTLS is mandatory — never plaintext.
      ...(SMTP_SECURE ? {} : { requireTLS: true }),
      // Auth only when a password exists; the relay authorises by IP.
      ...(GMAIL_APP_PASSWORD ? { auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporter
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const t = getTransporter()
  if (!t) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[email] Skipped (SMTP not configured). To: ${to}, Subject: ${subject}`,
      )
      return { success: true }
    }
    return {
      success: false,
      error: "שירות מייל לא מוגדר (SMTP_HOST / GMAIL_USER חסרים או SMTP_PORT לא תקין)",
    }
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await t.sendMail({ from: FROM, to, subject, html })
      // messageId is a generated id, not PII — the proof in the PM2 log that a mail left.
      console.info("[email] sent", { messageId: info.messageId ?? null, attempts: attempt })
      return { success: true }
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1])
    }
  }
  console.error("[email] failed", { code: errorCode(lastError), attempts: MAX_ATTEMPTS })
  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : "שגיאה בשליחת מייל",
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Templates                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

interface CredentialsEmailParams {
  to: string
  fullName: string
  username?: string | null
  password?: string | null
  loginUrl?: string
}

export async function sendCredentialsEmail(
  p: CredentialsEmailParams,
): Promise<{ success: boolean; error?: string }> {
  const loginUrl = p.loginUrl || `${APP_URL}/login`
  const subject = "פרטי התחברות למערכת GuestHub"

  const html = `<!doctype html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f2fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1e40af;">שלום ${escapeHtml(p.fullName)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">חשבונך במערכת נפתח. אלה פרטי ההתחברות שלך:</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0;">
      ${
        p.username
          ? `<div style="margin-bottom:14px;">
               <div style="color:#6b7280;font-size:12px;font-weight:600;margin-bottom:4px;">שם משתמש</div>
               <div dir="ltr" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(p.username)}</div>
             </div>`
          : ""
      }
      ${
        p.password
          ? `<div>
               <div style="color:#6b7280;font-size:12px;font-weight:600;margin-bottom:4px;">סיסמה</div>
               <div dir="ltr" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(p.password)}</div>
             </div>`
          : ""
      }
    </div>

    <p style="margin:24px 0;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#1e40af;color:#ffffff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">כניסה למערכת</a>
    </p>

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;line-height:1.6;">
      מומלץ להחליף סיסמה מיד לאחר ההתחברות הראשונה.<br>
      אם לא ביקשת חשבון — פשוט התעלם מההודעה.
    </p>
  </div>
</body>
</html>`

  return sendEmail({ to: p.to, subject, html })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

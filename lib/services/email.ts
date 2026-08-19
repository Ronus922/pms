"use server"

/**
 * Email service — Gmail SMTP via nodemailer.
 *
 * Setup:
 *   1. Enable 2-Step Verification on the Google account.
 *   2. Create an App Password: https://myaccount.google.com/apppasswords
 *   3. Set in .env.local:
 *        GMAIL_USER=your.email@gmail.com
 *        GMAIL_APP_PASSWORD=16-char-app-password
 *        EMAIL_FROM="GuestHub <your.email@gmail.com>"
 *
 * Limits: ~500 emails/day for free Gmail; ~2000/day for Workspace.
 *
 * Note: Gmail will silently rewrite FROM to match GMAIL_USER unless you've
 * configured SPF/DKIM for the sending domain. For Workspace + custom domain,
 * see https://support.google.com/a/answer/33786.
 *
 * If GMAIL_USER/GMAIL_APP_PASSWORD are unset:
 *   - In dev: logs to console, returns success (so flows aren't blocked).
 *   - In prod: returns failure with a clear error.
 */

import nodemailer, { type Transporter } from "nodemailer"

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const FROM =
  process.env.EMAIL_FROM ||
  `GuestHub <${GMAIL_USER || "noreply@guesthub.app"}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://guesthub.app"

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
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
        `[email] Skipped (Gmail credentials missing). To: ${to}, Subject: ${subject}`,
      )
      return { success: true }
    }
    return {
      success: false,
      error: "שירות מייל לא מוגדר (GMAIL_USER / GMAIL_APP_PASSWORD חסרים)",
    }
  }

  try {
    await t.sendMail({ from: FROM, to, subject, html })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בשליחת מייל",
    }
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

interface LoginLinkEmailParams {
  to: string
  fullName: string
  loginUrl: string
}

export async function sendLoginLinkEmail(
  p: LoginLinkEmailParams,
): Promise<{ success: boolean; error?: string }> {
  const subject = "קישור התחברות למערכת GuestHub"

  const html = `<!doctype html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f2fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1e40af;">שלום ${escapeHtml(p.fullName)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">קיבלת קישור חד-פעמי להתחברות למערכת. לחץ על הכפתור כדי להיכנס ולהגדיר סיסמה חדשה:</p>

    <p style="margin:24px 0;">
      <a href="${escapeHtml(p.loginUrl)}" style="display:inline-block;background:#1e40af;color:#ffffff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">כניסה למערכת</a>
    </p>

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;line-height:1.6;">
      הקישור תקף לזמן מוגבל וניתן לשימוש חד-פעמי.<br>
      אם לא ביקשת קישור זה — פשוט התעלם מההודעה.
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

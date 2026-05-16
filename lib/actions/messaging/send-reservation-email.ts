"use server"

import { db } from "@/lib/db"
import { sendEmail } from "@/lib/services/email"

interface SendInput {
  tenantId: string
  reservationId: string
  templateId: string
  recipient: string
  subject: string
  body: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

function wrapHtml(body: string, businessName: string): string {
  const inner = looksLikeHtml(body) ? body : `<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`
  return `<!doctype html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1b22;direction:rtl;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(to left,#003aa0,#3F51B5);padding:22px 28px;color:#fff;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(businessName)}</h1>
    </div>
    <div style="padding:28px 32px;font-size:15px;line-height:1.7;color:#1f2937;">
      ${inner}
    </div>
    <div style="padding:14px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">${escapeHtml(businessName)}</div>
  </div>
</body>
</html>`
}

export async function sendReservationEmailFromTemplate(
  input: SendInput,
): Promise<{ success: boolean; error?: string }> {
  if (!input.recipient?.trim()) return { success: false, error: "חובה למלא כתובת נמען" }
  if (!input.subject?.trim()) return { success: false, error: "חובה למלא נושא" }
  if (!input.body?.trim()) return { success: false, error: "חובה למלא תוכן" }

  const [tenant] = await db`
    SELECT name FROM tenants WHERE id = ${input.tenantId}
  ` as unknown as Array<{ name: string }>
  const businessName = tenant?.name || "GuestHub"
  const html = wrapHtml(input.body, businessName)

  const res = await sendEmail({ to: input.recipient.trim(), subject: input.subject.trim(), html })

  try {
    if (res.success) {
      await db`
        INSERT INTO message_log (
          tenant_id, template_id, channel_type, recipient, subject, body_snapshot,
          delivery_status, sent_at
        ) VALUES (
          ${input.tenantId}, ${input.templateId || null}, 'email',
          ${input.recipient.trim()}, ${input.subject.trim()}, ${input.body},
          'sent', NOW()
        )
      `
    } else {
      await db`
        INSERT INTO message_log (
          tenant_id, template_id, channel_type, recipient, subject, body_snapshot,
          delivery_status, failed_at, error_message
        ) VALUES (
          ${input.tenantId}, ${input.templateId || null}, 'email',
          ${input.recipient.trim()}, ${input.subject.trim()}, ${input.body},
          'failed', NOW(), ${res.error || "unknown"}
        )
      `
    }
  } catch {
    /* Log failure must never block user feedback. */
  }

  return res
}

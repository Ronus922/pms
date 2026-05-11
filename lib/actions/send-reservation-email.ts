"use server"

import { db } from "@/lib/db"

interface EmailPayload {
  tenantId: string
  reservationId: string
  reservationNumber: string
  guestEmail: string
  guestName: string
  checkIn: string
  checkOut: string
  totalPrice: number
  currency: string
}

/**
 * Build an RTL Hebrew confirmation email template.
 */
function buildConfirmationHtml(payload: EmailPayload, businessName: string): string {
  const sym = payload.currency === "USD" ? "$" : payload.currency === "EUR" ? "\u20AC" : "\u20AA"
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f6f8fb;direction:rtl">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(to left,#003aa0,#3F51B5);padding:28px 32px;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:700">${businessName}</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.85">אישור הזמנה #${payload.reservationNumber}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;margin:0 0 20px;color:#1a1b22">שלום ${payload.guestName},</p>
      <p style="font-size:15px;margin:0 0 24px;color:#4b5563;line-height:1.6">ההזמנה שלך אושרה בהצלחה. להלן הפרטים:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1a1b22">
        <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:700">מספר הזמנה</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:left" dir="ltr">${payload.reservationNumber}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:700">תאריך כניסה</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0">${payload.checkIn}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:700">תאריך יציאה</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0">${payload.checkOut}</td></tr>
        <tr><td style="padding:10px 0;font-weight:700">סה"כ לתשלום</td><td style="padding:10px 0;font-weight:700;color:#003aa0" dir="ltr">${sym}${payload.totalPrice.toLocaleString()}</td></tr>
      </table>
      <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">מייל זה נשלח אוטומטית. לשאלות, אנא צרו קשר ישירות עם ${businessName}.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Send reservation confirmation emails to guest and business.
 * Fire-and-forget — never throws, never blocks reservation flow.
 */
export async function sendReservationConfirmationEmail(payload: EmailPayload): Promise<void> {
  try {
    // Get tenant info
    const [tenant] = await db`
      SELECT name, notification_email FROM tenants WHERE id = ${payload.tenantId}
    `
    const businessName = tenant?.name || "GuestHub"
    const html = buildConfirmationHtml(payload, businessName)

    const recipients: string[] = []
    if (payload.guestEmail) recipients.push(payload.guestEmail)
    if (tenant?.notification_email) recipients.push(tenant.notification_email)

    if (recipients.length === 0) return

    // Try to send via the mail system API (on same server)
    for (const to of recipients) {
      try {
        await fetch(`${process.env.MAIL_SYSTEM_URL || "http://localhost:3002"}/api/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject: `אישור הזמנה #${payload.reservationNumber} - ${businessName}`,
            html,
          }),
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        // Silently fail per recipient — don't block other recipients
      }
    }
  } catch {
    // Silently fail — email must never block reservation creation
  }
}

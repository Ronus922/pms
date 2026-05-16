"use server"

import { db } from "@/lib/db"

interface LogInput {
  tenantId: string
  templateId: string
  recipient: string
  body: string
}

export async function logWhatsAppSend(input: LogInput): Promise<{ success: boolean }> {
  try {
    await db`
      INSERT INTO message_log (
        tenant_id, template_id, channel_type, recipient, subject, body_snapshot,
        delivery_status, sent_at
      ) VALUES (
        ${input.tenantId}, ${input.templateId || null}, 'whatsapp',
        ${input.recipient}, '', ${input.body},
        'sent', NOW()
      )
    `
    return { success: true }
  } catch {
    return { success: false }
  }
}

"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"

interface LogInput {
  tenantId: string
  templateId: string
  recipient: string
  body: string
}

export async function logWhatsAppSend(input: LogInput): Promise<{ success: boolean }> {
  try {
    // Tenant derived from the session — never trust input.tenantId.
    const actor = await requireActor()
    const tenantId = actor.tenantId
    await db`
      INSERT INTO message_log (
        tenant_id, template_id, channel_type, recipient, subject, body_snapshot,
        delivery_status, sent_at
      ) VALUES (
        ${tenantId}, ${input.templateId || null}, 'whatsapp',
        ${input.recipient}, '', ${input.body},
        'sent', NOW()
      )
    `
    return { success: true }
  } catch {
    return { success: false }
  }
}

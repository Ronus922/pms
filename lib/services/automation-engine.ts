import "server-only"

import { db } from "@/lib/db"

/* ══════════════════════════════════════════════════════════════
   AUTOMATION ENGINE — Queue processor + template renderer
   ══════════════════════════════════════════════════════════════ */

/* ── Template Variable Renderer ───────────────────────────── */

export function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

/* ── Queue: Enqueue Message ───────────────────────────────── */

export async function enqueueMessage(params: {
  tenantId: string
  ruleId?: string
  templateId?: string
  targetEntityType: string
  targetEntityId?: string
  recipientName: string
  recipientEmail?: string
  recipientPhone?: string
  channelType: string
  scheduledFor?: Date
  payload?: Record<string, string>
}): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const [row] = await db`
      INSERT INTO message_queue (
        tenant_id, automation_rule_id, template_id,
        target_entity_type, target_entity_id,
        recipient_name, recipient_email, recipient_phone,
        channel_type, scheduled_for, delivery_status, payload_snapshot
      ) VALUES (
        ${params.tenantId}, ${params.ruleId ?? null}, ${params.templateId ?? null},
        ${params.targetEntityType}, ${params.targetEntityId ?? null},
        ${params.recipientName}, ${params.recipientEmail ?? ""},
        ${params.recipientPhone ?? ""}, ${params.channelType},
        ${params.scheduledFor ?? new Date()}, 'pending',
        ${JSON.stringify(params.payload ?? {})}
      )
      RETURNING id
    `
    return { success: true, queueId: row.id as string }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהכנסה לתור" }
  }
}

/* ── Queue: Process Pending Messages ──────────────────────── */

export async function processQueue(tenantId: string): Promise<{ processed: number; failed: number }> {
  let processed = 0
  let failed = 0

  // Get pending messages that are due
  const pending = await db`
    SELECT mq.*, at.subject, at.body, at.channel_type AS template_channel
    FROM message_queue mq
    LEFT JOIN automation_templates at ON at.id = mq.template_id
    WHERE mq.tenant_id = ${tenantId}
      AND mq.delivery_status IN ('pending', 'retry')
      AND mq.scheduled_for <= NOW()
    ORDER BY mq.scheduled_for
    LIMIT 50
  `

  for (const msg of pending) {
    try {
      // Mark as sending
      await db`UPDATE message_queue SET delivery_status = 'sending' WHERE id = ${msg.id}`

      // Render template with payload variables
      const payload = (msg.payload_snapshot as Record<string, string>) ?? {}
      const renderedSubject = renderTemplate((msg.subject as string) ?? "", payload)
      const renderedBody = renderTemplate((msg.body as string) ?? "", payload)
      const channel = msg.channel_type as string

      // Dispatch based on channel
      let sent = false
      let providerResponse = ""

      if (channel === "email") {
        const result = await sendEmail(
          msg.recipient_email as string,
          msg.recipient_name as string,
          renderedSubject,
          renderedBody,
        )
        sent = result.success
        providerResponse = result.response ?? ""
      } else if (channel === "in_app") {
        // Create in-app notification
        await db`
          INSERT INTO notifications (user_id, type, channel, title, body, entity_type, entity_id)
          VALUES (${msg.target_entity_id}, 'info', 'in_app', ${renderedSubject}, ${renderedBody},
                  ${msg.target_entity_type}, ${msg.target_entity_id})
        `
        sent = true
        providerResponse = "in_app_created"
      } else {
        // WhatsApp, SMS, Push — placeholder for future providers
        providerResponse = `channel_${channel}_not_configured`
        sent = false
      }

      if (sent) {
        await db`UPDATE message_queue SET delivery_status = 'sent', sent_at = NOW() WHERE id = ${msg.id}`

        // Log success
        await db`
          INSERT INTO message_log (
            tenant_id, queue_id, template_id, channel_type, recipient,
            subject, body_snapshot, delivery_status, provider_response, sent_at
          ) VALUES (
            ${tenantId}, ${msg.id}, ${msg.template_id}, ${channel},
            ${msg.recipient_email || msg.recipient_phone || msg.recipient_name},
            ${renderedSubject}, ${renderedBody}, 'sent', ${providerResponse}, NOW()
          )
        `
        processed++
      } else {
        const retryCount = (msg.retry_count as number) + 1
        const maxRetries = 3
        const newStatus = retryCount >= maxRetries ? "failed" : "retry"

        await db`
          UPDATE message_queue
          SET delivery_status = ${newStatus}, retry_count = ${retryCount},
              error_message = ${providerResponse}
          WHERE id = ${msg.id}
        `

        // Log failure
        await db`
          INSERT INTO message_log (
            tenant_id, queue_id, template_id, channel_type, recipient,
            subject, body_snapshot, delivery_status, provider_response, failed_at, error_message
          ) VALUES (
            ${tenantId}, ${msg.id}, ${msg.template_id}, ${channel},
            ${msg.recipient_email || msg.recipient_phone || msg.recipient_name},
            ${renderedSubject}, ${renderedBody}, 'failed', ${providerResponse}, NOW(), ${providerResponse}
          )
        `
        failed++
      }
    } catch {
      // Mark as failed
      await db`
        UPDATE message_queue SET delivery_status = 'failed', error_message = 'processing_error',
               retry_count = retry_count + 1
        WHERE id = ${msg.id}
      `
      failed++
    }
  }

  return { processed, failed }
}

/* ── Email Sender (uses existing mail-system) ─────────────── */

async function sendEmail(
  to: string,
  name: string,
  subject: string,
  htmlBody: string,
): Promise<{ success: boolean; response?: string }> {
  if (!to) return { success: false, response: "no_recipient_email" }

  const mailUrl = process.env.MAIL_SYSTEM_URL || "http://localhost:3002"
  try {
    const res = await fetch(`${mailUrl}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        name,
        subject,
        html: htmlBody,
      }),
    })

    if (res.ok) {
      return { success: true, response: "sent_via_mail_system" }
    }
    const errorText = await res.text().catch(() => "unknown")
    return { success: false, response: `mail_system_error_${res.status}: ${errorText}` }
  } catch (err: unknown) {
    return { success: false, response: err instanceof Error ? err.message : "mail_system_unreachable" }
  }
}

/* ── Process All Tenants (for cron) ───────────────────────── */

export async function processAllQueues(): Promise<{ tenants: number; processed: number; failed: number }> {
  const tenants = await db`
    SELECT DISTINCT tenant_id FROM message_queue
    WHERE delivery_status IN ('pending', 'retry')
      AND scheduled_for <= NOW()
  `

  let totalProcessed = 0
  let totalFailed = 0

  for (const t of tenants) {
    const result = await processQueue(t.tenant_id as string)
    totalProcessed += result.processed
    totalFailed += result.failed
  }

  return { tenants: tenants.length, processed: totalProcessed, failed: totalFailed }
}

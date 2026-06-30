"use server"

import { db } from "@/lib/db"
import { requireActor, requireSuperAdmin } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type {
  AutomationTemplate,
  AutomationRule,
  MessageQueueItem,
  MessageLogEntry,
  DynamicVariable,
  AutomationStats,
  TemplateCreateInput,
  RuleCreateInput,
  TemplateFilters,
  RuleFilters,
  LogFilters,
} from "@/lib/types/automations"

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export async function getAutomationStats(_tenantId: string): Promise<AutomationStats> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const today = new Date().toISOString().slice(0, 10)

  const [row] = await db`
    SELECT
      (SELECT COUNT(*) FROM automation_rules WHERE tenant_id = ${tenantId} AND is_active = TRUE)::int AS active_automations,
      (SELECT COUNT(*) FROM automation_rules WHERE tenant_id = ${tenantId} AND is_active = FALSE)::int AS paused_automations,
      (SELECT COUNT(*) FROM message_log WHERE tenant_id = ${tenantId} AND delivery_status = 'sent' AND created_at::date = ${today}::date)::int AS sent_today,
      (SELECT COUNT(*) FROM message_log WHERE tenant_id = ${tenantId} AND delivery_status = 'failed' AND created_at::date = ${today}::date)::int AS failed_today,
      (SELECT COUNT(*) FROM message_queue WHERE tenant_id = ${tenantId} AND delivery_status IN ('pending','scheduled','retry'))::int AS pending_queue,
      (SELECT COUNT(*) FROM automation_templates WHERE tenant_id = ${tenantId} AND is_active = TRUE)::int AS active_templates
  `
  return {
    active_automations: Number(row.active_automations),
    paused_automations: Number(row.paused_automations),
    sent_today: Number(row.sent_today),
    failed_today: Number(row.failed_today),
    pending_queue: Number(row.pending_queue),
    active_templates: Number(row.active_templates),
  }
}

/* ══════════════════════════════════════════════════════════════
   TEMPLATES
   ══════════════════════════════════════════════════════════════ */

export async function getTemplates(
  _tenantId: string,
  filters?: TemplateFilters,
): Promise<AutomationTemplate[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const search = filters?.search?.trim() || null
  const category = filters?.category === "all" ? null : (filters?.category || null)
  const channel = filters?.channel === "all" ? null : (filters?.channel || null)
  const activeFilter = filters?.active

  const rows = await db`
    SELECT * FROM automation_templates
    WHERE tenant_id = ${tenantId}
      AND (${search === null}::boolean OR name ILIKE '%' || ${search} || '%' OR key ILIKE '%' || ${search} || '%')
      AND (${category === null}::boolean OR category = ${category})
      AND (${channel === null}::boolean OR channel_type = ${channel})
      AND (${activeFilter === "all" || activeFilter === undefined}::boolean OR is_active = ${activeFilter === true})
    ORDER BY category, name
  `
  return rows as unknown as AutomationTemplate[]
}

export async function getTemplate(_tenantId: string, templateId: string): Promise<AutomationTemplate | null> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT * FROM automation_templates WHERE id = ${templateId} AND tenant_id = ${tenantId}
  `
  return (row as unknown as AutomationTemplate) ?? null
}

export async function createTemplate(
  _tenantId: string,
  data: TemplateCreateInput,
  _userId: string,
): Promise<{ success: boolean; error?: string; templateId?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId
    const userId = actor.userId

    if (!data.name?.trim()) return { success: false, error: "חובה להזין שם תבנית" }
    if (!data.key?.trim()) return { success: false, error: "חובה להזין מפתח" }

    const [row] = await db`
      INSERT INTO automation_templates (
        tenant_id, key, name, category, description, channel_type,
        subject, body, default_trigger, default_delay_minutes,
        available_variables, notes_internal, created_by
      ) VALUES (
        ${tenantId}, ${data.key.trim()}, ${data.name.trim()},
        ${data.category}, ${data.description?.trim() ?? ""},
        ${data.channel_type}, ${data.subject?.trim() ?? ""},
        ${data.body ?? ""}, ${data.default_trigger ?? null},
        ${data.default_delay_minutes ?? 0},
        ${JSON.stringify(data.available_variables ?? [])},
        ${data.notes_internal?.trim() ?? ""}, ${userId}
      )
      RETURNING id
    `
    return { success: true, templateId: row.id as string }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת תבנית"
    if (msg.includes("duplicate key")) return { success: false, error: "מפתח תבנית כבר קיים" }
    return { success: false, error: msg }
  }
}

export async function updateTemplate(
  _tenantId: string,
  templateId: string,
  data: Partial<TemplateCreateInput> & { is_active?: boolean },
  _userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId
    const userId = actor.userId

    const existing = await getTemplate(tenantId, templateId)
    if (!existing) return { success: false, error: "תבנית לא נמצאה" }
    if (existing.is_system_locked && !existing.allow_super_admin_edit) {
      return { success: false, error: "לא ניתן לערוך תבנית מערכת נעולה" }
    }

    await db`
      UPDATE automation_templates SET
        name = ${data.name?.trim() ?? existing.name},
        category = ${data.category ?? existing.category},
        description = ${data.description?.trim() ?? existing.description},
        channel_type = ${data.channel_type ?? existing.channel_type},
        subject = ${data.subject?.trim() ?? existing.subject},
        body = ${data.body ?? existing.body},
        is_active = ${data.is_active ?? existing.is_active},
        default_trigger = ${data.default_trigger ?? existing.default_trigger},
        default_delay_minutes = ${data.default_delay_minutes ?? existing.default_delay_minutes},
        available_variables = ${JSON.stringify(data.available_variables ?? existing.available_variables)},
        notes_internal = ${data.notes_internal?.trim() ?? existing.notes_internal},
        updated_by = ${userId}
      WHERE id = ${templateId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון" }
  }
}

export async function deleteTemplate(
  _tenantId: string,
  templateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId

    const existing = await getTemplate(tenantId, templateId)
    if (!existing) return { success: false, error: "תבנית לא נמצאה" }
    if (existing.is_system_locked) return { success: false, error: "לא ניתן למחוק תבנית מערכת" }

    await db`DELETE FROM automation_templates WHERE id = ${templateId} AND tenant_id = ${tenantId}`
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

export async function duplicateTemplate(
  _tenantId: string,
  templateId: string,
  _userId: string,
): Promise<{ success: boolean; error?: string; templateId?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId
    const userId = actor.userId

    const existing = await getTemplate(tenantId, templateId)
    if (!existing) return { success: false, error: "תבנית לא נמצאה" }

    const newKey = `${existing.key}_copy_${Date.now()}`
    const [row] = await db`
      INSERT INTO automation_templates (
        tenant_id, key, name, category, description, channel_type,
        subject, body, default_trigger, default_delay_minutes,
        available_variables, notes_internal, created_by
      ) VALUES (
        ${tenantId}, ${newKey}, ${existing.name + " (העתק)"},
        ${existing.category}, ${existing.description},
        ${existing.channel_type}, ${existing.subject},
        ${existing.body}, ${existing.default_trigger},
        ${existing.default_delay_minutes},
        ${JSON.stringify(existing.available_variables)},
        ${existing.notes_internal}, ${userId}
      )
      RETURNING id
    `
    return { success: true, templateId: row.id as string }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בשכפול" }
  }
}

/* ══════════════════════════════════════════════════════════════
   RULES
   ══════════════════════════════════════════════════════════════ */

export async function getRules(
  _tenantId: string,
  filters?: RuleFilters,
): Promise<AutomationRule[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const search = filters?.search?.trim() || null
  const triggerType = filters?.trigger_type === "all" ? null : (filters?.trigger_type || null)
  const activeFilter = filters?.active

  const rows = await db`
    SELECT ar.*, at.name AS template_name
    FROM automation_rules ar
    LEFT JOIN automation_templates at ON at.id = ar.template_id
    WHERE ar.tenant_id = ${tenantId}
      AND (${search === null}::boolean OR ar.name ILIKE '%' || ${search} || '%')
      AND (${triggerType === null}::boolean OR ar.trigger_type = ${triggerType})
      AND (${activeFilter === "all" || activeFilter === undefined}::boolean OR ar.is_active = ${activeFilter === true})
    ORDER BY ar.execution_order, ar.priority, ar.name
  `
  return rows as unknown as AutomationRule[]
}

export async function createRule(
  _tenantId: string,
  data: RuleCreateInput,
): Promise<{ success: boolean; error?: string; ruleId?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId

    if (!data.name?.trim()) return { success: false, error: "חובה להזין שם" }
    if (!data.key?.trim()) return { success: false, error: "חובה להזין מפתח" }

    const [row] = await db`
      INSERT INTO automation_rules (
        tenant_id, key, name, description, trigger_type, trigger_entity,
        trigger_condition, delay_minutes, send_time, send_days_before,
        send_days_after, repeat_every, repeat_unit, stop_when_condition_met,
        priority, channel_priority, template_id, fallback_template_id
      ) VALUES (
        ${tenantId}, ${data.key.trim()}, ${data.name.trim()},
        ${data.description?.trim() ?? ""}, ${data.trigger_type},
        ${data.trigger_entity}, ${JSON.stringify(data.trigger_condition ?? {})},
        ${data.delay_minutes ?? 0}, ${data.send_time ?? null},
        ${data.send_days_before ?? null}, ${data.send_days_after ?? null},
        ${data.repeat_every ?? null}, ${data.repeat_unit ?? null},
        ${data.stop_when_condition_met ?? false}, ${data.priority ?? 50},
        ${JSON.stringify(data.channel_priority ?? ["email"])},
        ${data.template_id ?? null}, ${data.fallback_template_id ?? null}
      )
      RETURNING id
    `
    return { success: true, ruleId: row.id as string }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת אוטומציה"
    if (msg.includes("duplicate key")) return { success: false, error: "מפתח כבר קיים" }
    return { success: false, error: msg }
  }
}

export async function getRule(_tenantId: string, ruleId: string): Promise<AutomationRule | null> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT ar.*, at.name AS template_name
    FROM automation_rules ar
    LEFT JOIN automation_templates at ON at.id = ar.template_id
    WHERE ar.id = ${ruleId} AND ar.tenant_id = ${tenantId}
  `
  return (row as unknown as AutomationRule) ?? null
}

export async function updateRule(
  _tenantId: string,
  ruleId: string,
  data: Partial<RuleCreateInput> & { is_active?: boolean },
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId

    const existing = await getRule(tenantId, ruleId)
    if (!existing) return { success: false, error: "אוטומציה לא נמצאה" }

    await db`
      UPDATE automation_rules SET
        name = ${data.name?.trim() ?? existing.name},
        description = ${data.description?.trim() ?? existing.description},
        is_active = ${data.is_active ?? existing.is_active},
        trigger_type = ${data.trigger_type ?? existing.trigger_type},
        trigger_entity = ${data.trigger_entity ?? existing.trigger_entity},
        trigger_condition = ${JSON.stringify(data.trigger_condition ?? existing.trigger_condition)},
        delay_minutes = ${data.delay_minutes ?? existing.delay_minutes},
        send_time = ${data.send_time ?? existing.send_time},
        send_days_before = ${data.send_days_before ?? existing.send_days_before},
        send_days_after = ${data.send_days_after ?? existing.send_days_after},
        repeat_every = ${data.repeat_every ?? existing.repeat_every},
        repeat_unit = ${data.repeat_unit ?? existing.repeat_unit},
        stop_when_condition_met = ${data.stop_when_condition_met ?? existing.stop_when_condition_met},
        priority = ${data.priority ?? existing.priority},
        channel_priority = ${JSON.stringify(data.channel_priority ?? existing.channel_priority)},
        template_id = ${data.template_id ?? existing.template_id},
        fallback_template_id = ${data.fallback_template_id ?? existing.fallback_template_id}
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון" }
  }
}

export async function toggleRule(
  _tenantId: string,
  ruleId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId

    await db`
      UPDATE automation_rules SET is_active = ${isActive}
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ══════════════════════════════════════════════════════════════
   QUEUE
   ══════════════════════════════════════════════════════════════ */

export async function getQueueItems(
  _tenantId: string,
  status?: string,
): Promise<MessageQueueItem[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const statusFilter = status === "all" ? null : (status || null)

  const rows = await db`
    SELECT mq.*, at.name AS template_name, ar.name AS rule_name
    FROM message_queue mq
    LEFT JOIN automation_templates at ON at.id = mq.template_id
    LEFT JOIN automation_rules ar ON ar.id = mq.automation_rule_id
    WHERE mq.tenant_id = ${tenantId}
      AND (${statusFilter === null}::boolean OR mq.delivery_status = ${statusFilter})
    ORDER BY mq.scheduled_for DESC
    LIMIT 200
  `
  return rows as unknown as MessageQueueItem[]
}

export async function cancelQueueItem(
  _tenantId: string,
  queueId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const tenantId = actor.tenantId

    await db`
      UPDATE message_queue SET delivery_status = 'cancelled'
      WHERE id = ${queueId} AND tenant_id = ${tenantId} AND delivery_status IN ('pending','scheduled')
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ══════════════════════════════════════════════════════════════
   LOGS
   ══════════════════════════════════════════════════════════════ */

export async function getMessageLogs(
  _tenantId: string,
  filters?: LogFilters,
): Promise<MessageLogEntry[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const search = filters?.search?.trim() || null
  const channel = filters?.channel === "all" ? null : (filters?.channel || null)
  const status = filters?.status === "all" ? null : (filters?.status || null)
  const dateFrom = filters?.dateFrom || null
  const dateTo = filters?.dateTo || null
  const templateId = filters?.template_id === "all" ? null : (filters?.template_id || null)

  const rows = await db`
    SELECT ml.*, at.name AS template_name
    FROM message_log ml
    LEFT JOIN automation_templates at ON at.id = ml.template_id
    WHERE ml.tenant_id = ${tenantId}
      AND (${search === null}::boolean OR ml.recipient ILIKE '%' || ${search} || '%' OR ml.subject ILIKE '%' || ${search} || '%')
      AND (${channel === null}::boolean OR ml.channel_type = ${channel})
      AND (${status === null}::boolean OR ml.delivery_status = ${status})
      AND (${dateFrom === null}::boolean OR ml.created_at >= ${dateFrom}::date)
      AND (${dateTo === null}::boolean OR ml.created_at <= (${dateTo}::date + interval '1 day'))
      AND (${templateId === null}::boolean OR ml.template_id = ${templateId})
    ORDER BY ml.created_at DESC
    LIMIT 500
  `
  return rows as unknown as MessageLogEntry[]
}

/* ══════════════════════════════════════════════════════════════
   VARIABLES
   ══════════════════════════════════════════════════════════════ */

export async function getVariables(_tenantId: string): Promise<DynamicVariable[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT * FROM automation_variables
    WHERE tenant_id = ${tenantId}
    ORDER BY entity_type, variable_key
  `
  return rows as unknown as DynamicVariable[]
}

export async function seedDefaultVariables(_tenantId: string): Promise<void> {
  const actor = await requireSuperAdmin()
  const tenantId = actor.tenantId

  const { DEFAULT_VARIABLES } = await import("@/lib/constants/automations")
  for (const v of DEFAULT_VARIABLES) {
    await db`
      INSERT INTO automation_variables (tenant_id, entity_type, variable_key, variable_label, example_value)
      VALUES (${tenantId}, ${v.entity_type}, ${v.variable_key}, ${v.variable_label}, ${v.example_value})
      ON CONFLICT (tenant_id, entity_type, variable_key) DO NOTHING
    `
  }
}

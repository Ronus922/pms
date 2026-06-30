// Server-internal maintenance layer. NOT a "use server" module: these helpers
// and the recurring-instance generator are never client-callable Server
// Actions. They take an EXPLICIT tenantId and scope every query to it.
//   • getNextSortOrder / getNextTaskNumber are shared with lib/actions/maintenance.ts
//     (imported there; session actions derive tenantId from requireActor()).
//   • generateRecurringMaintenanceInstances() is the SERVICE-ROLE cron entry
//     point — it iterates tenants and runs a tenant-scoped pass per tenant,
//     reachable only from /api/cron/maintenance-recurring (CRON_SECRET).
// Living outside a "use server" file is what prevents a browser from invoking
// the cron job (or any tenant-scoped helper) directly with an arbitrary tenant.

import { db } from "@/lib/db"
import type { MaintenanceStatus } from "@/lib/types/maintenance"

/* ── Shared counters (tenant-scoped) ───────────────────────── */

export async function getNextSortOrder(
  tenantId: string,
  assignedTo: string | null,
): Promise<number> {
  const [row] = assignedTo
    ? await db`
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
        FROM maintenance_tasks
        WHERE tenant_id = ${tenantId}
          AND assigned_to = ${assignedTo}
          AND deleted_at IS NULL
          AND status NOT IN ('resolved','cancelled')
      `
    : await db`
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
        FROM maintenance_tasks
        WHERE tenant_id = ${tenantId}
          AND assigned_to IS NULL
          AND deleted_at IS NULL
          AND status NOT IN ('resolved','cancelled')
      `
  return Number(row.next)
}

export async function getNextTaskNumber(tenantId: string): Promise<number> {
  const [row] = await db`
    SELECT COALESCE(MAX(task_number), 0) + 1 AS next
    FROM maintenance_tasks
    WHERE tenant_id = ${tenantId}
  `
  return Number(row.next)
}

/* ── Recurring instance generation (per tenant) ────────────── */

/**
 * Generate today's due recurring maintenance instances for ONE tenant. Every
 * query is scoped to the passed tenantId — the rules query, the duplicate
 * check, and the insert all carry it. This is the inner layer.
 */
async function generateRecurringForTenant(
  tenantId: string,
  today: Date,
  todayStr: string,
  todayDay: number,
): Promise<{ created: number; errors: number }> {
  let created = 0
  let errors = 0

  // Active rules for THIS tenant that may need generation.
  const rules = await db`
    SELECT *
    FROM maintenance_recurrence_rules
    WHERE tenant_id = ${tenantId}
      AND is_active = true
      AND start_date <= ${todayStr}::date
      AND (end_date IS NULL OR end_date >= ${todayStr}::date)
      AND (last_generated_date IS NULL OR last_generated_date < ${todayStr}::date)
  `

  for (const rule of rules) {
    try {
      const freq = rule.frequency as string
      const startDate = new Date(rule.start_date as string)
      const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / 86400000)

      // Check if today matches the frequency
      let shouldGenerate = false
      if (freq === "daily") {
        shouldGenerate = true
      } else if (freq === "specific_days") {
        const days = (rule.days_of_week as number[]) ?? []
        shouldGenerate = days.includes(todayDay)
      } else if (freq === "weekly") {
        shouldGenerate = daysDiff % 7 === 0
      } else if (freq === "biweekly") {
        shouldGenerate = daysDiff % 14 === 0
      } else if (freq === "monthly") {
        const startDay = startDate.getDate()
        const todayDate = today.getDate()
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        // Match day-of-month, or last day if start was on 29/30/31
        shouldGenerate = todayDate === startDay || (startDay > lastDayOfMonth && todayDate === lastDayOfMonth)
      }

      if (!shouldGenerate) {
        // Still update last_generated_date so we don't re-check
        await db`
          UPDATE maintenance_recurrence_rules SET last_generated_date = ${todayStr}::date
          WHERE id = ${rule.id} AND tenant_id = ${tenantId}
        `
        continue
      }

      // Check no duplicate for today (scoped to tenant)
      const [dup] = await db`
        SELECT 1 FROM maintenance_tasks
        WHERE tenant_id = ${tenantId}
          AND recurrence_rule_id = ${rule.id}
          AND scheduled_date = ${todayStr}::date
          AND deleted_at IS NULL
      `
      if (dup) {
        await db`
          UPDATE maintenance_recurrence_rules SET last_generated_date = ${todayStr}::date
          WHERE id = ${rule.id} AND tenant_id = ${tenantId}
        `
        continue
      }

      // Create instance — tenantId is the loop tenant (== rule.tenant_id).
      const taskNumber = await getNextTaskNumber(tenantId)
      const assignedTo = rule.assigned_to as string | null
      const initialStatus: MaintenanceStatus = assignedTo ? "assigned" : "open"
      const sortOrder = await getNextSortOrder(tenantId, assignedTo)

      await db`
        INSERT INTO maintenance_tasks (
          tenant_id, task_number, source_type, target_type, target_id, target_label,
          room_number, issue_category, title, description, priority, urgency_level,
          status, assigned_to, assigned_to_name, reported_by, reported_by_name,
          scheduled_date, scheduled_time_from, scheduled_time_to,
          sort_order, estimated_duration_minutes,
          requires_guest_coordination, can_enter_room, access_notes,
          recurrence_rule_id, is_recurring
        ) VALUES (
          ${tenantId}, ${taskNumber}, ${rule.source_type},
          ${rule.target_type}, ${rule.target_id}, ${rule.target_label},
          ${rule.room_number}, ${rule.issue_category}, ${rule.title},
          ${rule.description}, ${rule.priority}, ${rule.urgency_level},
          ${initialStatus}, ${assignedTo}, ${rule.assigned_to_name},
          ${rule.created_by}, ${rule.created_by_name},
          ${todayStr}, ${rule.scheduled_time_from}, ${rule.scheduled_time_to},
          ${sortOrder}, ${rule.estimated_duration_minutes},
          ${rule.requires_guest_coordination}, ${rule.can_enter_room}, ${rule.access_notes},
          ${rule.id}, true
        )
      `

      await db`
        UPDATE maintenance_recurrence_rules SET last_generated_date = ${todayStr}::date, updated_at = NOW()
        WHERE id = ${rule.id} AND tenant_id = ${tenantId}
      `

      created++
    } catch {
      errors++
    }
  }

  return { created, errors }
}

/**
 * Daily 06:00 cron entry point. SERVICE-ROLE path: no acting user, so iterate
 * the tenants table and run a tenant-scoped pass per tenant. No query spans
 * tenants. Reachable only from /api/cron/maintenance-recurring (CRON_SECRET).
 */
export async function generateRecurringMaintenanceInstances(): Promise<{ created: number; errors: number }> {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const todayDay = today.getDay() // 0=Sun..6=Sat

  const tenants = (await db`SELECT id FROM tenants`) as unknown as { id: string }[]

  let created = 0
  let errors = 0
  for (const t of tenants) {
    const r = await generateRecurringForTenant(t.id, today, todayStr, todayDay)
    created += r.created
    errors += r.errors
  }

  return { created, errors }
}

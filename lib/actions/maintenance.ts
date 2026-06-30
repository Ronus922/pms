"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { createAdminSupabase } from "@/lib/supabase/server"
import { getNextSortOrder, getNextTaskNumber } from "@/lib/services/maintenance-core"
import { MAINTENANCE_STATUS_TRANSITIONS } from "@/lib/constants/maintenance"
import type {
  MaintenanceTask,
  MaintenanceTaskMedia,
  MaintenanceAuditEntry,
  MaintenanceBoard,
  MaintenanceWorkerSummary,
  MaintenanceStats,
  MaintenanceFilters,
  MaintenanceStatus,
  MaintenanceTaskCreateInput,
  MaintenanceTaskUpdateInput,
  MaintenanceAuditAction,
} from "@/lib/types/maintenance"

/* ── Helpers ───────────────────────────────────────────────── */

async function insertAudit(
  tenantId: string,
  taskId: string,
  action: MaintenanceAuditAction,
  changedBy: string | null,
  changedByName: string | null,
  changes: Record<string, { old: unknown; new: unknown }> = {},
): Promise<void> {
  await db`
    INSERT INTO maintenance_task_audit_log
      (tenant_id, task_id, action, changed_by, changed_by_name, changes_json)
    VALUES
      (${tenantId}::uuid, ${taskId}::uuid, ${action}::text, ${changedBy}::uuid, ${changedByName}::text, ${db.json(changes as unknown as Parameters<typeof db.json>[0])})
  `
}

function isValidTransition(current: MaintenanceStatus, next: MaintenanceStatus): boolean {
  const allowed = MAINTENANCE_STATUS_TRANSITIONS[current]
  return allowed?.includes(next) ?? false
}

/**
 * Safely coerce any date-shaped value into a YYYY-MM-DD string (or null).
 * Prevents "Invalid time value" crashes when postgres-js serializes a Date
 * parameter via toISOString() — we normalize to a plain string before binding.
 */
function toDateString(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  if (typeof value === "string") {
    if (value === "") return null
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }
  return null
}

/* ── Read: Board ───────────────────────────────────────────── */

export async function getMaintenanceBoard(
  _tenantId: string,
  date: string,
  filters?: MaintenanceFilters,
): Promise<MaintenanceBoard> {
  const actor = await requireActor()
  const tenantId = actor.tenantId

  // 1. All active staff members
  const workerRows = await db`
    SELECT u.id, u.full_name, u.avatar_url
    FROM users u
    WHERE u.tenant_id = ${tenantId}::uuid
      AND u.is_active = true
    ORDER BY u.full_name
  `
  const workers = workerRows as unknown as MaintenanceWorkerSummary[]

  // 2. Build WHERE conditions — use empty string as "no filter" to avoid null type issues
  const statusFilter = filters?.status
    ? Array.isArray(filters.status) ? filters.status : [filters.status]
    : [] as string[]
  const hasStatusFilter = statusFilter.length > 0
  const priorityFilter = filters?.priority ?? ""
  const urgencyFilter = filters?.urgency ?? ""
  const categoryFilter = filters?.category ?? ""
  const searchFilter = filters?.search?.trim() ?? ""

  // 3. Tasks for this date (or active non-resolved tasks if today)
  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)
  const taskRows = await db`
    SELECT
      mt.*,
      (SELECT COUNT(*) FROM maintenance_task_media m WHERE m.task_id = mt.id) AS media_count
    FROM maintenance_tasks mt
    WHERE mt.tenant_id = ${tenantId}::uuid
      AND mt.deleted_at IS NULL
      AND (
        (mt.scheduled_date = ${safeDate}::date)
        OR (mt.scheduled_date IS NULL AND mt.status NOT IN ('resolved','cancelled'))
        OR (${safeDate}::date = CURRENT_DATE AND mt.status NOT IN ('resolved','cancelled'))
      )
      AND (${!hasStatusFilter}::boolean OR mt.status = ANY(${statusFilter}::text[]))
      AND (${priorityFilter === ""}::boolean OR mt.priority = ${priorityFilter}::text)
      AND (${urgencyFilter === ""}::boolean OR mt.urgency_level = ${urgencyFilter}::text)
      AND (${categoryFilter === ""}::boolean OR mt.issue_category = ${categoryFilter}::text)
      AND (${searchFilter === ""}::boolean OR mt.title ILIKE '%' || ${searchFilter}::text || '%' OR mt.task_number::text = ${searchFilter || "0"}::text)
    ORDER BY mt.assigned_to NULLS FIRST, mt.sort_order
  `
  const tasks = taskRows as unknown as MaintenanceTask[]

  // 4. Group by worker
  const byWorker: Record<string, MaintenanceTask[]> = {}
  const unassigned: MaintenanceTask[] = []

  for (const w of workers) byWorker[w.id] = []
  for (const task of tasks) {
    if (task.assigned_to && byWorker[task.assigned_to]) {
      byWorker[task.assigned_to].push(task)
    } else {
      unassigned.push(task)
    }
  }

  return { workers, byWorker, unassigned }
}

/* ── Read: Worker Queue ────────────────────────────────────── */

export async function getMyMaintenanceTasks(
  _tenantId: string,
  _userId: string,
  date?: string,
): Promise<MaintenanceTask[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const userId = actor.userId

  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : new Date().toISOString().slice(0, 10)

  const rows = await db`
    SELECT
      mt.*,
      (SELECT COUNT(*) FROM maintenance_task_media m WHERE m.task_id = mt.id) AS media_count
    FROM maintenance_tasks mt
    WHERE mt.tenant_id = ${tenantId}::uuid
      AND mt.assigned_to = ${userId}::uuid
      AND mt.deleted_at IS NULL
      AND (
        mt.scheduled_date = ${targetDate}::date
        OR mt.scheduled_date IS NULL
        OR (
          mt.scheduled_date < CURRENT_DATE
          AND mt.status NOT IN ('resolved','cancelled')
        )
      )
      AND mt.status NOT IN ('cancelled')
    ORDER BY
      CASE WHEN mt.status = 'resolved' THEN 1 ELSE 0 END,
      mt.sort_order
  `
  return rows as unknown as MaintenanceTask[]
}

/* ── Read: Table List ──────────────────────────────────────── */

export async function getMaintenanceList(
  _tenantId: string,
  filters?: MaintenanceFilters,
  sortField?: string,
  sortDir?: "asc" | "desc",
  page?: number,
  pageSize?: number,
): Promise<{ tasks: MaintenanceTask[]; total: number }> {
  const actor = await requireActor()
  const tenantId = actor.tenantId

  const limit = pageSize ?? 50
  const offset = ((page ?? 1) - 1) * limit

  const statusFilter = filters?.status
    ? Array.isArray(filters.status) ? filters.status : [filters.status]
    : [] as string[]
  const hasStatusFilter = statusFilter.length > 0
  const priorityFilter = filters?.priority ?? ""
  const urgencyFilter = filters?.urgency ?? ""
  const categoryFilter = filters?.category ?? ""
  const assignedFilter = filters?.assignedTo || null
  const targetFilter = filters?.targetType || null
  const dateFrom = filters?.dateFrom || null
  const dateTo = filters?.dateTo || null
  const searchFilter = filters?.search?.trim() || null
  const onlyUnassigned = filters?.onlyUnassigned ?? false
  const onlyUrgent = filters?.onlyUrgent ?? false

  // Null-safe: pass null for empty filters so ::uuid / ::date casts don't fail at bind time
  const safeAssigned: string | null = assignedFilter || null
  const safeTarget: string | null = targetFilter || null
  const safeDateFrom: string | null =
    dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : null
  const safeDateTo: string | null =
    dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : null
  const safeSearch: string | null = searchFilter || null
  const safePriority: string | null = priorityFilter || null
  const safeUrgency: string | null = urgencyFilter || null
  const safeCategory: string | null = categoryFilter || null

  const [countRow] = await db`
    SELECT COUNT(*) AS total
    FROM maintenance_tasks mt
    WHERE mt.tenant_id = ${tenantId}::uuid
      AND mt.deleted_at IS NULL
      AND (${!hasStatusFilter}::boolean OR mt.status = ANY(${statusFilter}::text[]))
      AND (${safePriority}::text IS NULL OR mt.priority = ${safePriority}::text)
      AND (${safeUrgency}::text IS NULL OR mt.urgency_level = ${safeUrgency}::text)
      AND (${safeCategory}::text IS NULL OR mt.issue_category = ${safeCategory}::text)
      AND (${safeAssigned}::uuid IS NULL OR mt.assigned_to = ${safeAssigned}::uuid)
      AND (${safeTarget}::text IS NULL OR mt.target_type = ${safeTarget}::text)
      AND (${safeDateFrom}::date IS NULL OR mt.scheduled_date >= ${safeDateFrom}::date)
      AND (${safeDateTo}::date IS NULL OR mt.scheduled_date <= ${safeDateTo}::date)
      AND (${safeSearch}::text IS NULL OR mt.title ILIKE '%' || ${safeSearch}::text || '%' OR mt.task_number::text = COALESCE(${safeSearch}::text, '0'))
      AND (${!onlyUnassigned}::boolean OR mt.assigned_to IS NULL)
      AND (${!onlyUrgent}::boolean OR mt.urgency_level IN ('urgent','immediate'))
  `

  const rows = await db`
    SELECT
      mt.*,
      (SELECT COUNT(*) FROM maintenance_task_media m WHERE m.task_id = mt.id) AS media_count
    FROM maintenance_tasks mt
    WHERE mt.tenant_id = ${tenantId}::uuid
      AND mt.deleted_at IS NULL
      AND (${!hasStatusFilter}::boolean OR mt.status = ANY(${statusFilter}::text[]))
      AND (${safePriority}::text IS NULL OR mt.priority = ${safePriority}::text)
      AND (${safeUrgency}::text IS NULL OR mt.urgency_level = ${safeUrgency}::text)
      AND (${safeCategory}::text IS NULL OR mt.issue_category = ${safeCategory}::text)
      AND (${safeAssigned}::uuid IS NULL OR mt.assigned_to = ${safeAssigned}::uuid)
      AND (${safeTarget}::text IS NULL OR mt.target_type = ${safeTarget}::text)
      AND (${safeDateFrom}::date IS NULL OR mt.scheduled_date >= ${safeDateFrom}::date)
      AND (${safeDateTo}::date IS NULL OR mt.scheduled_date <= ${safeDateTo}::date)
      AND (${safeSearch}::text IS NULL OR mt.title ILIKE '%' || ${safeSearch}::text || '%' OR mt.task_number::text = COALESCE(${safeSearch}::text, '0'))
      AND (${!onlyUnassigned}::boolean OR mt.assigned_to IS NULL)
      AND (${!onlyUrgent}::boolean OR mt.urgency_level IN ('urgent','immediate'))
    ORDER BY
      CASE mt.urgency_level WHEN 'immediate' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
      CASE mt.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      mt.created_at DESC
    LIMIT ${limit}::integer OFFSET ${offset}::integer
  `

  return {
    tasks: rows as unknown as MaintenanceTask[],
    total: Number(countRow.total),
  }
}

/* ── Read: Stats ───────────────────────────────────────────── */

export async function getMaintenanceStats(
  _tenantId: string,
): Promise<MaintenanceStats> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT
      COUNT(*) FILTER (WHERE status = 'open') AS open,
      COUNT(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('resolved','cancelled')) AS unassigned,
      COUNT(*) FILTER (WHERE urgency_level IN ('urgent','immediate') AND status NOT IN ('resolved','cancelled')) AS urgent,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status IN ('waiting_parts','waiting_external_vendor')) AS waiting_parts,
      COUNT(*) FILTER (WHERE status = 'resolved' AND completed_at::date = CURRENT_DATE) AS completed_today
    FROM maintenance_tasks
    WHERE tenant_id = ${tenantId}
      AND deleted_at IS NULL
  `
  return {
    open: Number(row.open),
    unassigned: Number(row.unassigned),
    urgent: Number(row.urgent),
    inProgress: Number(row.in_progress),
    waitingParts: Number(row.waiting_parts),
    completedToday: Number(row.completed_today),
  }
}

/* ── Read: Single Task ─────────────────────────────────────── */

export async function getMaintenanceTask(
  _tenantId: string,
  taskId: string,
): Promise<MaintenanceTask | null> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT
      mt.*,
      (SELECT COUNT(*) FROM maintenance_task_media m WHERE m.task_id = mt.id) AS media_count
    FROM maintenance_tasks mt
    WHERE mt.id = ${taskId}
      AND mt.tenant_id = ${tenantId}
      AND mt.deleted_at IS NULL
  `
  return (row as unknown as MaintenanceTask) ?? null
}

/* ── Read: Audit Log ───────────────────────────────────────── */

export async function getMaintenanceAuditLog(
  _tenantId: string,
  taskId: string,
): Promise<MaintenanceAuditEntry[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT *
    FROM maintenance_task_audit_log
    WHERE task_id = ${taskId}
      AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `
  return rows as unknown as MaintenanceAuditEntry[]
}

/* ── Read: Media ───────────────────────────────────────────── */

export async function getMaintenanceTaskMedia(
  _tenantId: string,
  taskId: string,
): Promise<MaintenanceTaskMedia[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT *
    FROM maintenance_task_media
    WHERE task_id = ${taskId}
      AND tenant_id = ${tenantId}
    ORDER BY phase, sort_order
  `
  const media = rows as unknown as MaintenanceTaskMedia[]

  // Resolve storage paths (legacy full URLs are passed through unchanged).
  const supabase = createAdminSupabase()
  const resolved = await Promise.all(
    media.map(async (m) => {
      if (!m.file_url) return m
      if (m.file_url.startsWith("http://") || m.file_url.startsWith("https://")) return m
      const { data } = await supabase.storage
        .from("maintenance-media")
        .createSignedUrl(m.file_url, 3600)
      return data?.signedUrl ? { ...m, file_url: data.signedUrl } : m
    }),
  )
  return resolved
}

/* ── Read: Workers ─────────────────────────────────────────── */

export async function getMaintenanceWorkers(
  _tenantId: string,
): Promise<MaintenanceWorkerSummary[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT u.id, u.full_name, u.avatar_url
    FROM users u
    WHERE u.tenant_id = ${tenantId}
      AND u.is_active = true
    ORDER BY u.full_name
  `
  return rows as unknown as MaintenanceWorkerSummary[]
}

/* ── Read: Rooms list (for target picker) ──────────────────── */

export async function getRoomsForPicker(
  _tenantId: string,
): Promise<Array<{ id: string; room_number: string; room_type_name: string; max_occupancy: number | null }>> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT
      r.id,
      r.room_number,
      COALESCE(rt.name, '') AS room_type_name,
      COALESCE(r.max_occupancy, rt.max_occupancy) AS max_occupancy
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.tenant_id = ${tenantId}
      AND r.is_active = true
    ORDER BY r.room_number
  `
  return rows as unknown as Array<{ id: string; room_number: string; room_type_name: string; max_occupancy: number | null }>
}

/* ── Write: Create ─────────────────────────────────────────── */

export async function createMaintenanceTask(
  _tenantId: string,
  data: MaintenanceTaskCreateInput,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string; taskId?: string; taskNumber?: number; ruleId?: string | null }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    if (!data.title?.trim()) return { success: false, error: "חובה להזין כותרת" }
    if (!data.target_label?.trim()) return { success: false, error: "חובה לבחור יעד" }
    // Category defaults to 'general' if not provided
    if (!data.issue_category) data.issue_category = "general"

    const taskNumber = await getNextTaskNumber(tenantId)
    const initialStatus: MaintenanceStatus = data.assigned_to ? "assigned" : "open"
    const sortOrder = await getNextSortOrder(tenantId, data.assigned_to ?? null)

    // Resolve assigned_to_name
    let assignedToName: string | null = null
    if (data.assigned_to) {
      const [u] = await db`
        SELECT full_name FROM users WHERE id = ${data.assigned_to} AND tenant_id = ${tenantId}
      `
      assignedToName = (u?.full_name as string) ?? null
    }

    // If recurrence is requested, create a rule first
    let ruleId: string | null = null
    if (data.recurrence) {
      const rec = data.recurrence
      const [ruleRow] = await db`
        INSERT INTO maintenance_recurrence_rules (
          tenant_id, source_type, target_type, target_id, target_label,
          room_number, issue_category, title, description, priority, urgency_level,
          assigned_to, assigned_to_name, scheduled_time_from, scheduled_time_to,
          estimated_duration_minutes, requires_guest_coordination, can_enter_room, access_notes,
          frequency, days_of_week, start_date, end_date, last_generated_date,
          created_by, created_by_name
        ) VALUES (
          ${tenantId}, ${data.source_type ?? "preventive_maintenance"},
          ${data.target_type}, ${data.target_id ?? null}, ${data.target_label},
          ${data.room_number ?? null}, ${data.issue_category}, ${data.title.trim()},
          ${data.description?.trim() ?? ""}, ${data.priority}, ${data.urgency_level},
          ${data.assigned_to ?? null}, ${assignedToName},
          ${data.scheduled_time_from ?? null}, ${data.scheduled_time_to ?? null},
          ${data.estimated_duration_minutes ?? null},
          ${data.requires_guest_coordination ?? false},
          ${data.can_enter_room ?? true},
          ${data.access_notes ?? null},
          ${rec.frequency}, ${rec.days_of_week ?? []},
          ${toDateString(rec.start_date)}::date, ${toDateString(rec.end_date)}::date,
          ${toDateString(data.scheduled_date) ?? toDateString(rec.start_date)}::date,
          ${userId}, ${userName}
        )
        RETURNING id
      `
      ruleId = ruleRow.id as string
    }

    const [row] = await db`
      INSERT INTO maintenance_tasks (
        tenant_id, task_number, source_type, target_type, target_id, target_label,
        room_number, issue_category, title, description, priority, urgency_level,
        status, assigned_to, assigned_to_name, reported_by, reported_by_name,
        scheduled_date, scheduled_time_from, scheduled_time_to,
        sort_order, estimated_duration_minutes,
        room_status_context, requires_guest_coordination, can_enter_room, access_notes,
        recurrence_rule_id, is_recurring
      ) VALUES (
        ${tenantId}, ${taskNumber}, ${data.source_type ?? "manual"},
        ${data.target_type}, ${data.target_id ?? null}, ${data.target_label},
        ${data.room_number ?? null}, ${data.issue_category}, ${data.title.trim()},
        ${data.description?.trim() ?? ""}, ${data.priority}, ${data.urgency_level},
        ${initialStatus}, ${data.assigned_to ?? null}, ${assignedToName},
        ${userId}, ${userName},
        ${toDateString(data.scheduled_date)}::date, ${data.scheduled_time_from ?? null}, ${data.scheduled_time_to ?? null},
        ${sortOrder}, ${data.estimated_duration_minutes ?? null},
        ${data.room_status_context ?? null},
        ${data.requires_guest_coordination ?? false},
        ${data.can_enter_room ?? true},
        ${data.access_notes ?? null},
        ${ruleId}, ${!!ruleId}
      )
      RETURNING id
    `

    const taskId = row.id as string

    await insertAudit(tenantId, taskId, "created", userId, userName, {
      title: { old: null, new: data.title },
      status: { old: null, new: initialStatus },
      ...(ruleId ? { recurrence: { old: null, new: data.recurrence?.frequency } } : {}),
    })

    return { success: true, taskId, taskNumber, ruleId }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת משימה" }
  }
}

/* ── Write: Update ─────────────────────────────────────────── */

export async function updateMaintenanceTask(
  _tenantId: string,
  taskId: string,
  data: MaintenanceTaskUpdateInput,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const existing = await getMaintenanceTask(tenantId, taskId)
    if (!existing) return { success: false, error: "משימה לא נמצאה" }

    // Build changes diff
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    const updates: Record<string, unknown> = {}

    const fields: Array<keyof MaintenanceTaskUpdateInput> = [
      "target_type", "target_id", "target_label", "room_number",
      "issue_category", "title", "description", "priority", "urgency_level",
      "scheduled_date", "scheduled_time_from", "scheduled_time_to",
      "estimated_duration_minutes", "room_status_context",
      "requires_guest_coordination", "can_enter_room", "access_notes",
      "resolution_notes", "actual_duration_minutes",
    ]

    for (const field of fields) {
      if (field in data && data[field] !== existing[field as keyof MaintenanceTask]) {
        changes[field] = { old: existing[field as keyof MaintenanceTask], new: data[field] }
        updates[field] = data[field]
      }
    }

    // Handle assignment change
    if ("assigned_to" in data && data.assigned_to !== existing.assigned_to) {
      let newName: string | null = null
      if (data.assigned_to) {
        const [u] = await db`SELECT full_name FROM users WHERE id = ${data.assigned_to}`
        newName = (u?.full_name as string) ?? null
      }
      changes.assigned_to = { old: existing.assigned_to_name, new: newName }
      updates.assigned_to = data.assigned_to
      updates.assigned_to_name = newName

      // Auto-transition status
      if (data.assigned_to && existing.status === "open") {
        updates.status = "assigned"
        changes.status = { old: "open", new: "assigned" }
      } else if (!data.assigned_to && existing.status === "assigned") {
        updates.status = "open"
        changes.status = { old: "assigned", new: "open" }
      }
    }

    if (Object.keys(updates).length === 0) return { success: true }

    // Full update with COALESCE — only changes what's in `updates`
    await db`
      UPDATE maintenance_tasks SET
        target_type = ${(updates.target_type as string) ?? existing.target_type},
        target_id = ${(updates.target_id as string | null) ?? existing.target_id},
        target_label = ${(updates.target_label as string) ?? existing.target_label},
        room_number = ${(updates.room_number as string | null) ?? existing.room_number},
        issue_category = ${(updates.issue_category as string) ?? existing.issue_category},
        title = ${(updates.title as string) ?? existing.title},
        description = ${(updates.description as string) ?? existing.description},
        priority = ${(updates.priority as string) ?? existing.priority},
        urgency_level = ${(updates.urgency_level as string) ?? existing.urgency_level},
        assigned_to = ${updates.assigned_to !== undefined ? (updates.assigned_to as string | null) : existing.assigned_to},
        assigned_to_name = ${updates.assigned_to_name !== undefined ? (updates.assigned_to_name as string | null) : existing.assigned_to_name},
        status = ${(updates.status as string) ?? existing.status},
        scheduled_date = ${
          "scheduled_date" in updates
            ? toDateString(updates.scheduled_date)
            : toDateString(existing.scheduled_date)
        }::date,
        scheduled_time_from = ${"scheduled_time_from" in updates ? (updates.scheduled_time_from as string | null) : existing.scheduled_time_from},
        scheduled_time_to = ${"scheduled_time_to" in updates ? (updates.scheduled_time_to as string | null) : existing.scheduled_time_to},
        estimated_duration_minutes = ${"estimated_duration_minutes" in updates ? (updates.estimated_duration_minutes as number | null) : existing.estimated_duration_minutes},
        room_status_context = ${"room_status_context" in updates ? (updates.room_status_context as string | null) : existing.room_status_context},
        requires_guest_coordination = ${(updates.requires_guest_coordination as boolean) ?? existing.requires_guest_coordination},
        can_enter_room = ${(updates.can_enter_room as boolean) ?? existing.can_enter_room},
        access_notes = ${"access_notes" in updates ? (updates.access_notes as string | null) : existing.access_notes},
        resolution_notes = ${"resolution_notes" in updates ? (updates.resolution_notes as string | null) : existing.resolution_notes},
        actual_duration_minutes = ${"actual_duration_minutes" in updates ? (updates.actual_duration_minutes as number | null) : existing.actual_duration_minutes},
        updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
    `

    await insertAudit(tenantId, taskId, "updated", userId, userName, changes)

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון" }
  }
}

/* ── Write: Assign ─────────────────────────────────────────── */

export async function assignMaintenanceTask(
  _tenantId: string,
  taskId: string,
  workerId: string | null,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const existing = await getMaintenanceTask(tenantId, taskId)
    if (!existing) return { success: false, error: "משימה לא נמצאה" }

    let workerName: string | null = null
    if (workerId) {
      const [u] = await db`SELECT full_name FROM users WHERE id = ${workerId} AND tenant_id = ${tenantId}`
      workerName = (u?.full_name as string) ?? null
    }

    // Determine new status
    let newStatus = existing.status
    if (workerId && (existing.status === "open")) {
      newStatus = "assigned"
    } else if (!workerId && existing.status === "assigned") {
      newStatus = "open"
    }

    await db`
      UPDATE maintenance_tasks
      SET assigned_to = ${workerId},
          assigned_to_name = ${workerName},
          status = ${newStatus},
          updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `

    // Recompute sort_order for the target bucket
    const sorted = workerId
      ? await db`
          SELECT id FROM maintenance_tasks
          WHERE tenant_id = ${tenantId}
            AND assigned_to = ${workerId}
            AND deleted_at IS NULL
            AND status NOT IN ('resolved','cancelled')
          ORDER BY sort_order
        `
      : await db`
          SELECT id FROM maintenance_tasks
          WHERE tenant_id = ${tenantId}
            AND assigned_to IS NULL
            AND deleted_at IS NULL
            AND status NOT IN ('resolved','cancelled')
          ORDER BY sort_order
        `

    for (let i = 0; i < sorted.length; i++) {
      await db`
        UPDATE maintenance_tasks
        SET sort_order = ${i + 1}
        WHERE id = ${(sorted[i] as { id: string }).id}
          AND tenant_id = ${tenantId}
      `
    }

    const auditAction: MaintenanceAuditAction =
      existing.assigned_to && workerId ? "moved_between_workers"
        : workerId ? "assigned"
        : "assigned"

    await insertAudit(tenantId, taskId, auditAction, userId, userName, {
      assigned_to: { old: existing.assigned_to_name, new: workerName },
      status: { old: existing.status, new: newStatus },
    })

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בשיוך" }
  }
}

/* ── Write: Reorder ────────────────────────────────────────── */

export async function reorderMaintenanceTasks(
  _tenantId: string,
  workerId: string | null,
  orderedTaskIds: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId

    for (let i = 0; i < orderedTaskIds.length; i++) {
      if (workerId) {
        await db`
          UPDATE maintenance_tasks
          SET sort_order = ${i + 1},
              assigned_to = ${workerId},
              updated_at = NOW()
          WHERE id = ${orderedTaskIds[i]} AND tenant_id = ${tenantId}
        `
      } else {
        await db`
          UPDATE maintenance_tasks
          SET sort_order = ${i + 1},
              assigned_to = NULL,
              assigned_to_name = NULL,
              updated_at = NOW()
          WHERE id = ${orderedTaskIds[i]} AND tenant_id = ${tenantId}
        `
      }
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בסידור" }
  }
}

/* ── Write: Change Status ──────────────────────────────────── */

export async function changeMaintenanceStatus(
  _tenantId: string,
  taskId: string,
  newStatus: MaintenanceStatus,
  _userId: string,
  _userName: string,
  resolutionNotes?: string,
  resolutionCode?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const existing = await getMaintenanceTask(tenantId, taskId)
    if (!existing) return { success: false, error: "משימה לא נמצאה" }

    if (!isValidTransition(existing.status, newStatus)) {
      return { success: false, error: `לא ניתן לעבור מ-${existing.status} ל-${newStatus}` }
    }

    if (newStatus === "resolved") {
      await db`
        UPDATE maintenance_tasks
        SET status = ${newStatus},
            completed_at = NOW(),
            completed_by = ${userId},
            completed_by_name = ${userName},
            resolution_notes = COALESCE(${resolutionNotes || null}, resolution_notes),
            resolution_code = COALESCE(${resolutionCode || null}, resolution_code),
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
      await insertAudit(tenantId, taskId, "completed", userId, userName, {
        status: { old: existing.status, new: newStatus },
        resolution_code: { old: null, new: resolutionCode },
      })
    } else if (newStatus === "in_progress" && existing.status !== "in_progress") {
      await db`
        UPDATE maintenance_tasks
        SET status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
      await insertAudit(tenantId, taskId, "status_changed", userId, userName, {
        status: { old: existing.status, new: newStatus },
      })
    } else if (newStatus === "cancelled") {
      await db`
        UPDATE maintenance_tasks
        SET status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
      await insertAudit(tenantId, taskId, "cancelled", userId, userName, {
        status: { old: existing.status, new: newStatus },
      })
    } else {
      await db`
        UPDATE maintenance_tasks
        SET status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
      await insertAudit(tenantId, taskId, "status_changed", userId, userName, {
        status: { old: existing.status, new: newStatus },
      })
    }

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בשינוי סטטוס" }
  }
}

/* ── Write: Reopen ─────────────────────────────────────────── */

export async function reopenMaintenanceTask(
  _tenantId: string,
  taskId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const existing = await getMaintenanceTask(tenantId, taskId)
    if (!existing) return { success: false, error: "משימה לא נמצאה" }

    if (existing.status !== "resolved" && existing.status !== "cancelled") {
      return { success: false, error: "ניתן לפתוח מחדש רק משימה שהושלמה או בוטלה" }
    }

    const newStatus: MaintenanceStatus = existing.assigned_to ? "assigned" : "open"

    await db`
      UPDATE maintenance_tasks
      SET status = ${newStatus},
          reopened_count = reopened_count + 1,
          last_reopened_at = NOW(),
          last_reopened_by = ${userId},
          completed_at = NULL,
          completed_by = NULL,
          completed_by_name = NULL,
          resolution_code = NULL,
          resolution_notes = NULL,
          updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `

    await insertAudit(tenantId, taskId, "reopened", userId, userName, {
      status: { old: existing.status, new: newStatus },
      reopened_count: { old: existing.reopened_count, new: existing.reopened_count + 1 },
    })

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בפתיחה מחדש" }
  }
}

/* ── Write: Media ──────────────────────────────────────────── */

export async function addMaintenanceMedia(
  _tenantId: string,
  taskId: string,
  files: Array<{ url: string; name: string; mime: string; size: number }>,
  phase: "before" | "after" | "general",
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string; mediaIds?: string[] }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const ids: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const mediaType = f.mime.startsWith("image/") ? "image"
        : f.mime.startsWith("video/") ? "video"
        : "document"

      const [row] = await db`
        INSERT INTO maintenance_task_media
          (tenant_id, task_id, media_type, phase, file_url, file_name, mime_type, file_size_bytes,
           uploaded_by, uploaded_by_name, sort_order)
        VALUES
          (${tenantId}, ${taskId}, ${mediaType}, ${phase}, ${f.url}, ${f.name}, ${f.mime}, ${f.size},
           ${userId}, ${userName}, ${i})
        RETURNING id
      `
      ids.push(row.id as string)
    }

    await insertAudit(tenantId, taskId, "media_added", userId, userName, {
      phase: { old: null, new: phase },
      count: { old: null, new: files.length },
    })

    return { success: true, mediaIds: ids }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהעלאת קובץ" }
  }
}

export async function removeMaintenanceMedia(
  _tenantId: string,
  mediaId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const [media] = await db`
      SELECT task_id, file_name, phase
      FROM maintenance_task_media
      WHERE id = ${mediaId} AND tenant_id = ${tenantId}
    `
    if (!media) return { success: false, error: "קובץ לא נמצא" }

    await db`
      DELETE FROM maintenance_task_media
      WHERE id = ${mediaId} AND tenant_id = ${tenantId}
    `

    await insertAudit(tenantId, media.task_id as string, "media_removed", userId, userName, {
      file_name: { old: media.file_name, new: null },
      phase: { old: media.phase, new: null },
    })

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקת קובץ" }
  }
}

/* ── Read: User Name ───────────────────────────────────────── */

export async function getUserFullName(
  _tenantId: string,
  userId: string,
): Promise<string> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT full_name FROM users WHERE id = ${userId} AND tenant_id = ${tenantId}
  `
  return (row?.full_name as string) ?? ""
}

/* ── Write: Delete ─────────────────────────────────────────── */

export async function deleteMaintenanceTask(
  _tenantId: string,
  taskId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Must be authenticated and have edit permission on maintenance.
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    // Look up the task (server side, with tenant scope)
    const [task] = await db`
      SELECT reported_by, reported_by_name
      FROM maintenance_tasks
      WHERE id = ${taskId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
    `
    if (!task) return { success: false, error: "משימה לא נמצאה" }

    // Admin/super_admin can delete any task. Otherwise only the creator.
    const isAdmin = actor.role === "super_admin" || actor.role === "admin"
    if (!isAdmin && task.reported_by !== userId) {
      const creatorName = (task.reported_by_name as string) || "יוצר התקלה"
      return { success: false, error: `רק יוצר התקלה או מנהל יכולים למחוק אותה. פנה אל ${creatorName}` }
    }

    await db`
      UPDATE maintenance_tasks
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `

    await insertAudit(tenantId, taskId, "deleted", userId, userName, {})

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

/* ── Recurring: Deactivate Rule ───────────────────────────── */

export async function deactivateRecurrenceRule(
  _tenantId: string,
  ruleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("maintenance", "edit")
    const tenantId = actor.tenantId

    await db`
      UPDATE maintenance_recurrence_rules
      SET is_active = false, updated_at = NOW()
      WHERE id = ${ruleId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בביטול חזרתיות" }
  }
}

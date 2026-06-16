"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { createAdminSupabase } from "@/lib/supabase/server"
import crypto from "crypto"
import type {
  MaintenanceTaskCreateInput,
  MaintenanceStatus,
} from "@/lib/types/maintenance"

const BUCKET = "maintenance-media"

/**
 * Allow access if the actor is admin/super_admin, has maintenance.edit,
 * OR is the original reporter of the task. Used by the report flow so that
 * a cleaner who opens a ticket can upload its media without holding edit perms.
 */
function actorMayAccessTask(
  actor: { role: string; userId: string; permissions: Array<{ module: string; canEdit: boolean }> },
  reportedBy: string | null,
): boolean {
  if (actor.role === "super_admin" || actor.role === "admin") return true
  if (reportedBy && reportedBy === actor.userId) return true
  return actor.permissions.some((p) => p.module === "maintenance" && p.canEdit)
}

/** Whether the current actor may assign a maintenance task to a worker. */
export async function canCurrentUserAssignMaintenance(): Promise<boolean> {
  try {
    const actor = await requirePermission("maintenance", "view")
    if (actor.role === "super_admin" || actor.role === "admin") return true
    const [row] = await db`
      SELECT can_assign_maintenance
      FROM users
      WHERE id = ${actor.userId} AND tenant_id = ${actor.tenantId}
    `
    return Boolean(row?.can_assign_maintenance)
  } catch {
    return false
  }
}

/** Signed upload targets for the maintenance-media bucket. Called after task creation. */
export async function createMaintenanceUploadTargets(
  taskId: string,
  planned: Array<{ media_type: "image" | "video"; mime_type: string }>,
): Promise<{
  success: boolean
  error?: string
  targets?: Array<{
    storage_path: string
    signed_url: string
    token: string
    media_type: "image" | "video"
    index: number
  }>
}> {
  try {
    const actor = await requireActor()

    const [task] = await db`
      SELECT id, reported_by FROM maintenance_tasks
      WHERE id = ${taskId} AND tenant_id = ${actor.tenantId} AND deleted_at IS NULL
    `
    if (!task) return { success: false, error: "משימה לא נמצאה" }
    if (!actorMayAccessTask(actor, (task.reported_by as string | null) ?? null)) {
      return { success: false, error: "אין הרשאה להעלות מדיה למשימה זו" }
    }

    if (planned.length === 0) return { success: true, targets: [] }
    if (planned.length > 10) return { success: false, error: "מקסימום 10 קבצים לקריאה" }

    const supabase = createAdminSupabase()
    const targets: Array<{
      storage_path: string
      signed_url: string
      token: string
      media_type: "image" | "video"
      index: number
    }> = []

    for (let i = 0; i < planned.length; i++) {
      const item = planned[i]
      const ext = mimeToExt(item.mime_type)
      const prefix = item.media_type === "image" ? "img" : "vid"
      const path = `${actor.tenantId}/${taskId}/${prefix}_${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path)

      if (error || !data) {
        return { success: false, error: `שגיאה ביצירת URL להעלאה: ${error?.message ?? "unknown"}` }
      }

      targets.push({
        storage_path: path,
        signed_url: data.signedUrl,
        token: data.token,
        media_type: item.media_type,
        index: i,
      })
    }

    return { success: true, targets }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת URLs להעלאה" }
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  }
  return map[mime] ?? "bin"
}

/* ────────────────────────────────────────────────────────────
 * Free-form maintenance reporting (any authenticated user)
 * Bypasses maintenance.edit. createMaintenanceTask stays untouched
 * for the manager UI.
 * ──────────────────────────────────────────────────────────── */

export async function reportMaintenanceIssue(
  input: Omit<MaintenanceTaskCreateInput, "assigned_to"> & { assigned_to?: string | null },
): Promise<{ success: boolean; error?: string; taskId?: string; taskNumber?: number }> {
  try {
    const actor = await requireActor()
    const { tenantId, userId, fullName } = actor

    if (!input.title?.trim()) return { success: false, error: "חובה להזין כותרת" }
    if (!input.target_label?.trim()) return { success: false, error: "חובה לבחור יעד" }

    // Honor assigned_to only if the reporter is allowed to assign.
    let assignedTo: string | null = null
    let assignedToName: string | null = null
    if (input.assigned_to) {
      const mayAssign = await canCurrentUserAssignMaintenance()
      if (mayAssign) {
        assignedTo = input.assigned_to
        const [u] = await db`
          SELECT full_name FROM users
          WHERE id = ${assignedTo} AND tenant_id = ${tenantId}
        `
        assignedToName = (u?.full_name as string) ?? null
      }
    }

    const [numRow] = await db`
      SELECT COALESCE(MAX(task_number), 0) + 1 AS next
      FROM maintenance_tasks
      WHERE tenant_id = ${tenantId}
    `
    const taskNumber = Number(numRow.next)

    const initialStatus: MaintenanceStatus = assignedTo ? "assigned" : "open"

    const [sortRow] = assignedTo
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
    const sortOrder = Number(sortRow.next)

    const [row] = await db`
      INSERT INTO maintenance_tasks (
        tenant_id, task_number, source_type, target_type, target_id, target_label,
        room_number, issue_category, title, description, priority, urgency_level,
        status, assigned_to, assigned_to_name, reported_by, reported_by_name,
        scheduled_date, sort_order,
        requires_guest_coordination, can_enter_room,
        recurrence_rule_id, is_recurring
      ) VALUES (
        ${tenantId}, ${taskNumber}, ${input.source_type ?? "staff_report"},
        ${input.target_type}, ${input.target_id ?? null}, ${input.target_label},
        ${input.room_number ?? null}, ${input.issue_category ?? "general"},
        ${input.title.trim()}, ${input.description?.trim() ?? ""},
        ${input.priority}, ${input.urgency_level ?? "normal"},
        ${initialStatus}, ${assignedTo}, ${assignedToName},
        ${userId}, ${fullName},
        NULL::date, ${sortOrder},
        ${input.requires_guest_coordination ?? false},
        ${input.can_enter_room ?? true},
        NULL, false
      )
      RETURNING id
    `
    const taskId = row.id as string

    await db`
      INSERT INTO maintenance_task_audit_log
        (tenant_id, task_id, action, changed_by, changed_by_name, changes_json)
      VALUES
        (${tenantId}::uuid, ${taskId}::uuid, 'created'::text, ${userId}::uuid, ${fullName}::text,
         ${db.json({
           title: { old: null, new: input.title },
           status: { old: null, new: initialStatus },
           source: { old: null, new: "report_flow" },
         })})
    `

    return { success: true, taskId, taskNumber }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בדיווח" }
  }
}

/**
 * Mirror of addMaintenanceMedia (lib/actions/maintenance.ts) that allows the
 * task reporter to attach media without holding maintenance.edit.
 */
export async function addMaintenanceMediaAsReporter(
  taskId: string,
  files: Array<{ url: string; name: string; mime: string; size: number }>,
  phase: "before" | "after" | "general",
): Promise<{ success: boolean; error?: string; mediaIds?: string[] }> {
  try {
    const actor = await requireActor()

    const [task] = await db`
      SELECT id, reported_by FROM maintenance_tasks
      WHERE id = ${taskId} AND tenant_id = ${actor.tenantId} AND deleted_at IS NULL
    `
    if (!task) return { success: false, error: "משימה לא נמצאה" }
    if (!actorMayAccessTask(actor, (task.reported_by as string | null) ?? null)) {
      return { success: false, error: "אין הרשאה לצרף מדיה למשימה זו" }
    }

    const ids: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const mediaType = f.mime.startsWith("image/")
        ? "image"
        : f.mime.startsWith("video/")
          ? "video"
          : "document"
      const [row] = await db`
        INSERT INTO maintenance_task_media
          (tenant_id, task_id, media_type, phase, file_url, file_name, mime_type, file_size_bytes,
           uploaded_by, uploaded_by_name, sort_order)
        VALUES
          (${actor.tenantId}, ${taskId}, ${mediaType}, ${phase}, ${f.url}, ${f.name}, ${f.mime}, ${f.size},
           ${actor.userId}, ${actor.fullName}, ${i})
        RETURNING id
      `
      ids.push(row.id as string)
    }

    await db`
      INSERT INTO maintenance_task_audit_log
        (tenant_id, task_id, action, changed_by, changed_by_name, changes_json)
      VALUES
        (${actor.tenantId}::uuid, ${taskId}::uuid, 'media_added'::text, ${actor.userId}::uuid, ${actor.fullName}::text,
         ${db.json({
           phase: { old: null, new: phase },
           count: { old: null, new: files.length },
         })})
    `

    return { success: true, mediaIds: ids }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהעלאת קובץ" }
  }
}

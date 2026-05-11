"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type { Employee, EmployeeWithStats, EmployeeWithPermissions, EmployeeActivity, EmployeeTaskSummary, StaffFilter } from "@/lib/types/staff"
import type { Role, ModulePermission } from "@/lib/permissions/constants"

/* ── Get Employee List (with filters + stats) ──────────────── */

export async function getEmployeeList(
  tenantId: string,
  filters?: Partial<StaffFilter>
): Promise<EmployeeWithStats[]> {
  const search = filters?.search?.trim() || ""
  const roleFilter = filters?.role && filters.role !== "all" ? filters.role : null
  const statusFilter = filters?.status || "all"

  const rows = await db`
    SELECT
      u.id, u.tenant_id, u.email, u.username, u.full_name, u.phone,
      u.avatar_url, u.role, u.is_active, u.allow_google_auth,
      u.last_login, u.created_at, u.updated_at,
      u.invited_by, u.job_title, u.department, u.notes,
      u.emergency_contact, u.start_date,
      inv.full_name AS invited_by_name,
      COALESCE(active.cnt, 0)::int AS active_tasks_count,
      COALESCE(done_today.cnt, 0)::int AS completed_tasks_today
    FROM users u
    LEFT JOIN users inv ON inv.id = u.invited_by
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM housekeeping_tasks ht
      WHERE ht.assigned_to = u.id AND ht.status IN ('pending', 'in_progress')
    ) active ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM housekeeping_tasks ht
      WHERE ht.assigned_to = u.id
        AND ht.status = 'done'
        AND ht.completed_at::date = CURRENT_DATE
    ) done_today ON TRUE
    WHERE u.tenant_id = ${tenantId}
      ${search ? db`AND (
        u.full_name ILIKE ${"%" + search + "%"}
        OR u.email ILIKE ${"%" + search + "%"}
        OR u.phone ILIKE ${"%" + search + "%"}
      )` : db``}
      ${roleFilter ? db`AND u.role = ${roleFilter}` : db``}
      ${statusFilter === "active" ? db`AND u.is_active = true` : statusFilter === "inactive" ? db`AND u.is_active = false` : db``}
    ORDER BY
      CASE u.role
        WHEN 'super_admin' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'receptionist' THEN 2
        WHEN 'cleaner' THEN 3
        ELSE 4
      END,
      u.full_name
  `

  return rows as unknown as EmployeeWithStats[]
}

/* ── Get Single Employee Profile ───────────────────────────── */

export async function getEmployeeProfile(
  userId: string,
  tenantId: string
): Promise<EmployeeWithPermissions | null> {
  const [user] = await db`
    SELECT
      u.id, u.tenant_id, u.email, u.username, u.full_name, u.phone,
      u.avatar_url, u.role, u.is_active, u.allow_google_auth,
      u.last_login, u.created_at, u.updated_at,
      u.invited_by, u.job_title, u.department, u.notes,
      u.emergency_contact, u.start_date
    FROM users u
    WHERE u.id = ${userId} AND u.tenant_id = ${tenantId}
  `
  if (!user) return null

  const perms = await db`
    SELECT module, can_view, can_edit, can_delete
    FROM user_permissions
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
  `

  return {
    ...(user as unknown as Employee),
    permissions: (perms as unknown as { module: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]).map((p) => ({
      module: p.module,
      canView: p.can_view,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
    })),
  }
}

/* ── Update Employee Profile ───────────────────────────────── */

export async function updateEmployeeProfile(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  data: {
    full_name?: string
    phone?: string
    job_title?: string | null
    department?: string | null
    notes?: string | null
    emergency_contact?: string | null
    start_date?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── AUTHORIZATION ────────────────────────────────────────
    // Allow: admin/super_admin editing anyone in their tenant,
    //        OR a user editing their own profile.
    const actor = await requireActor()
    const tenantId = actor.tenantId
    const isAdminOrAbove = actor.role === "super_admin" || actor.role === "admin"
    const isSelf = userId === actor.userId

    if (!isAdminOrAbove && !isSelf) {
      throw new AuthorizationError("אין הרשאה לערוך עובד זה")
    }

    // Verify the target user is in the actor's tenant.
    const [target] = await db`
      SELECT id, role FROM users WHERE id = ${userId} AND tenant_id = ${tenantId} LIMIT 1
    `
    if (!target) {
      throw new AuthorizationError("עובד לא נמצא")
    }

    // No one (except super_admin) can edit a super_admin profile.
    const targetRole = (target.role as Role) ?? "receptionist"
    if (targetRole === "super_admin" && actor.role !== "super_admin") {
      throw new AuthorizationError("אין הרשאה לערוך פרופיל של סופר אדמין")
    }

    await db`
      UPDATE users SET
        full_name = COALESCE(${data.full_name ?? null}, full_name),
        phone = COALESCE(${data.phone ?? null}, phone),
        job_title = ${data.job_title ?? null},
        department = ${data.department ?? null},
        notes = ${data.notes ?? null},
        emergency_contact = ${data.emergency_contact ?? null},
        start_date = ${data.start_date ?? null},
        updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון פרופיל" }
  }
}

/* ── Get Employee Activity ─────────────────────────────────── */

export async function getEmployeeActivity(
  userId: string,
  tenantId: string,
  limit = 20
): Promise<EmployeeActivity[]> {
  // Cleaning tasks completed as activity
  const tasks = await db`
    SELECT
      ht.id,
      'task_completed' AS type,
      CONCAT('ניקיון חדר ', r.room_number) AS description,
      ht.completed_at AS timestamp,
      jsonb_build_object('room', r.room_number, 'status', ht.status) AS metadata
    FROM housekeeping_tasks ht
    LEFT JOIN rooms r ON r.id = ht.room_id
    WHERE ht.assigned_to = ${userId}
      AND ht.tenant_id = ${tenantId}
      AND ht.status IN ('done', 'skipped')
      AND ht.completed_at IS NOT NULL
    ORDER BY ht.completed_at DESC
    LIMIT ${limit}
  `

  return (tasks as unknown as EmployeeActivity[])
}

/* ── Get Employee Task Summary ─────────────────────────────── */

export async function getEmployeeTaskSummary(
  userId: string,
  tenantId: string
): Promise<EmployeeTaskSummary> {
  const [row] = await db`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'done' AND completed_at::date = CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS today,
      COALESCE(SUM(CASE WHEN status = 'done' AND completed_at >= date_trunc('week', CURRENT_DATE) THEN 1 ELSE 0 END), 0)::int AS this_week,
      COALESCE(SUM(CASE WHEN status = 'done' AND completed_at >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END), 0)::int AS this_month,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END), 0)::int AS pending
    FROM housekeeping_tasks
    WHERE assigned_to = ${userId} AND tenant_id = ${tenantId}
  `

  return row as unknown as EmployeeTaskSummary
}

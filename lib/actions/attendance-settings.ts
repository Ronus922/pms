"use server"

/**
 * Attendance Settings — server actions
 * ─────────────────────────────────────
 * Per-employee policy: which attendance level applies, which area is mapped,
 * and whether the employee can report absences in-app.
 *
 * Read access:
 *   - `attendance.view` permission (managers / receptionists)
 *   - OR the user reading their own settings (used by /staff/punch in Part E)
 *
 * Write access:
 *   - `attendance.edit` permission (effectively admin/super_admin in Phase 1)
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { attendanceSettingsSchema } from "@/lib/schemas/attendance"
import type {
  AttendanceSettings,
  AttendanceSettingsInput,
} from "@/lib/types/attendance"

/* ── Get Attendance Settings (own or via attendance.view) ───── */

export async function getAttendanceSettings(
  userId: string,
): Promise<AttendanceSettings | null> {
  const actor = await requireActor()
  const isSelf = actor.userId === userId
  if (!isSelf) {
    // Will throw AuthorizationError if not allowed.
    await requirePermission("attendance", "view")
  }

  const [row] = await db`
    SELECT
      u.id                     AS user_id,
      u.attendance_required,
      u.attendance_area_id,
      u.report_absence_in_app,
      a.name                   AS area_name
    FROM users u
    LEFT JOIN attendance_areas a
      ON a.id = u.attendance_area_id AND a.deleted_at IS NULL
    WHERE u.id = ${userId} AND u.tenant_id = ${actor.tenantId}
    LIMIT 1
  `
  if (!row) return null
  return row as unknown as AttendanceSettings
}

/* ── Update Attendance Settings ─────────────────────────────── */

export async function updateAttendanceSettings(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  input: AttendanceSettingsInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("attendance", "edit")

    // Zod validation (covers required_inside/outside ⇒ area_id refine).
    const parsed = attendanceSettingsSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { success: false, error: first?.message ?? "ולידציה נכשלה" }
    }
    const data = parsed.data

    // Verify target user is in actor's tenant.
    const [target] = await db`
      SELECT id FROM users
      WHERE id = ${data.user_id} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `
    if (!target) throw new AuthorizationError("עובד לא נמצא")

    // If an area is supplied, verify it belongs to the actor's tenant
    // and is not soft-deleted.
    if (data.attendance_area_id) {
      const [area] = await db`
        SELECT id FROM attendance_areas
        WHERE id = ${data.attendance_area_id}
          AND tenant_id = ${actor.tenantId}
          AND deleted_at IS NULL
        LIMIT 1
      `
      if (!area) {
        return { success: false, error: "האזור שנבחר אינו קיים" }
      }
    }

    await db`
      UPDATE users SET
        attendance_required   = ${data.attendance_required},
        attendance_area_id    = ${data.attendance_area_id},
        report_absence_in_app = ${data.report_absence_in_app},
        updated_at            = NOW()
      WHERE id = ${data.user_id} AND tenant_id = ${actor.tenantId}
    `
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון הגדרות",
    }
  }
}

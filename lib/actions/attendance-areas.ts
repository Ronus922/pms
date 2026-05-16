"use server"

/**
 * Attendance Areas — CRUD with cascade-aware soft delete
 * ───────────────────────────────────────────────────────
 * Pool-style 1:N relationship: one area can be referenced by many users
 * via `users.attendance_area_id`.
 *
 * Delete behavior (§12.9.4):
 *   - First call returns `AREA_HAS_USERS` with the affected user list
 *     and asks the caller to confirm.
 *   - Second call (with `confirmCascade: true`) soft-deletes the area
 *     AND nulls `users.attendance_area_id` for everyone affected.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { createAreaSchema, updateAreaSchema } from "@/lib/schemas/attendance"
import { DEFAULT_AREA_COLOR } from "@/lib/constants/attendance"
import type {
  AttendanceArea,
  AttendanceAreaPickerItem,
  AreaDeletionConflict,
  CreateAreaInput,
  UpdateAreaInput,
} from "@/lib/types/attendance"

/* ── List Active Areas (for selector dropdown) ──────────────── */

export async function listAttendanceAreas(): Promise<AttendanceArea[]> {
  const actor = await requirePermission("attendance", "view")
  const rows = await db`
    SELECT
      a.id, a.tenant_id, a.name, a.shape_type, a.geometry, a.address,
      a.color, a.notes, a.is_active, a.created_by,
      a.created_at, a.updated_at, a.deleted_at,
      COALESCE(lc.cnt, 0)::int AS linked_users_count
    FROM attendance_areas a
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM users u
      WHERE u.attendance_area_id = a.id
        AND u.tenant_id = ${actor.tenantId}
    ) lc ON TRUE
    WHERE a.tenant_id = ${actor.tenantId} AND a.deleted_at IS NULL
    ORDER BY a.name
  `
  return rows as unknown as AttendanceArea[]
}

/* ── Get Users Linked to an Area (peek, no mutation) ────────── */

/**
 * Returns the users currently linked to the area via
 * `users.attendance_area_id`. Used by the delete UX to surface a
 * "cannot delete — N users assigned" block before any destructive call.
 */
export async function getAreaLinkedUsers(
  areaId: string,
): Promise<{ id: string; full_name: string }[]> {
  const actor = await requirePermission("attendance", "view")
  const rows = await db`
    SELECT u.id, u.full_name
    FROM users u
    INNER JOIN attendance_areas a ON a.id = u.attendance_area_id
    WHERE u.attendance_area_id = ${areaId}
      AND u.tenant_id = ${actor.tenantId}
      AND a.tenant_id = ${actor.tenantId}
      AND a.deleted_at IS NULL
    ORDER BY u.full_name
  `
  return rows as unknown as { id: string; full_name: string }[]
}

/* ── Picker list (lightweight — no geometry payload) ────────── */

export async function listAttendanceAreasForPicker(): Promise<
  AttendanceAreaPickerItem[]
> {
  const actor = await requirePermission("attendance", "view")
  const rows = await db`
    SELECT id, name, shape_type, color
    FROM attendance_areas
    WHERE tenant_id = ${actor.tenantId}
      AND deleted_at IS NULL
      AND is_active = TRUE
    ORDER BY name
  `
  return rows as unknown as AttendanceAreaPickerItem[]
}

/* ── Get Single Area ────────────────────────────────────────── */

export async function getAttendanceAreaById(
  areaId: string,
): Promise<AttendanceArea | null> {
  const actor = await requirePermission("attendance", "view")
  const [row] = await db`
    SELECT
      id, tenant_id, name, shape_type, geometry, address,
      color, notes, is_active, created_by,
      created_at, updated_at, deleted_at
    FROM attendance_areas
    WHERE id = ${areaId} AND tenant_id = ${actor.tenantId}
    LIMIT 1
  `
  return (row as unknown as AttendanceArea) ?? null
}

/* ── Create Area ────────────────────────────────────────────── */

export async function createAttendanceArea(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  input: CreateAreaInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const actor = await requirePermission("attendance", "edit")
    const parsed = createAreaSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה",
      }
    }
    const data = parsed.data

    const [row] = await db`
      INSERT INTO attendance_areas
        (tenant_id, name, shape_type, geometry, address, color, notes, created_by)
      VALUES
        (${actor.tenantId},
         ${data.name},
         ${data.shape_type},
         ${db.json(data.geometry as unknown as Parameters<typeof db.json>[0])},
         ${data.address ?? null},
         ${data.color ?? DEFAULT_AREA_COLOR},
         ${data.notes ?? null},
         ${actor.userId})
      RETURNING id
    `
    return { success: true, id: (row as unknown as { id: string }).id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה ביצירת אזור",
    }
  }
}

/* ── Update Area ────────────────────────────────────────────── */

export async function updateAttendanceArea(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  areaId: string,
  input: UpdateAreaInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("attendance", "edit")
    const parsed = updateAreaSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה",
      }
    }
    const data = parsed.data

    // Verify ownership.
    const [owner] = await db`
      SELECT id FROM attendance_areas
      WHERE id = ${areaId} AND tenant_id = ${actor.tenantId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (!owner) throw new AuthorizationError("אזור לא נמצא")

    const sets: Record<string, unknown> = {}
    if (data.name !== undefined) sets.name = data.name
    if (data.shape_type !== undefined) sets.shape_type = data.shape_type
    if (data.geometry !== undefined) sets.geometry = data.geometry
    if (data.address !== undefined) sets.address = data.address ?? null
    if (data.color !== undefined) sets.color = data.color
    if (data.notes !== undefined) sets.notes = data.notes ?? null
    if (data.is_active !== undefined) sets.is_active = data.is_active

    if (Object.keys(sets).length === 0) {
      return { success: true }
    }

    await db`
      UPDATE attendance_areas
      SET ${db(sets, ...Object.keys(sets))}, updated_at = NOW()
      WHERE id = ${areaId} AND tenant_id = ${actor.tenantId}
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
      error: err instanceof Error ? err.message : "שגיאה בעדכון אזור",
    }
  }
}

/* ── Delete Area (soft + cascade-aware) ─────────────────────── */

export async function deleteAttendanceArea(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  areaId: string,
  opts: { confirmCascade: boolean } = { confirmCascade: false },
): Promise<{ success: true } | AreaDeletionConflict | { success: false; error: string }> {
  try {
    const actor = await requirePermission("attendance", "edit")

    // Verify the area belongs to the actor's tenant.
    const [owner] = await db`
      SELECT id FROM attendance_areas
      WHERE id = ${areaId} AND tenant_id = ${actor.tenantId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (!owner) throw new AuthorizationError("אזור לא נמצא")

    // Find affected users (linked).
    const affected = await db`
      SELECT id, full_name
      FROM users
      WHERE attendance_area_id = ${areaId}
        AND tenant_id = ${actor.tenantId}
      ORDER BY full_name
    `

    if (affected.length > 0 && !opts.confirmCascade) {
      return {
        success: false,
        error: "AREA_HAS_USERS",
        message: `האזור משויך ל-${affected.length} עובדים. אישור מפורש נדרש.`,
        affected_users: affected as unknown as { id: string; full_name: string }[],
      }
    }

    // Cascade: detach users + soft-delete area in a single statement chain.
    if (affected.length > 0) {
      await db`
        UPDATE users
        SET attendance_area_id = NULL, updated_at = NOW()
        WHERE attendance_area_id = ${areaId}
          AND tenant_id = ${actor.tenantId}
      `
    }
    await db`
      UPDATE attendance_areas
      SET deleted_at = NOW(), updated_at = NOW(), is_active = FALSE
      WHERE id = ${areaId} AND tenant_id = ${actor.tenantId}
    `

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה במחיקת אזור",
    }
  }
}

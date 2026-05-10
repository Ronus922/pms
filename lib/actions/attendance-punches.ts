"use server"

/**
 * Attendance Punches — clock-in / clock-out / shift queries
 * ──────────────────────────────────────────────────────────
 * Phase 1 surface: only `clockIn`, `clockOut`, `getMyShifts`.
 * Per-day aggregation, monthly reports, etc. live in Part E.
 *
 * Authorization model:
 *   - clockIn / clockOut: actor punches FOR THEMSELVES only (no admin spoofing).
 *   - getMyShifts: returns punches for the actor only.
 *
 * Validation pipeline for clockIn:
 *   1. Load actor's `attendance_required` + `attendance_area_id`.
 *   2. If level === 'none' → reject (employee not configured).
 *   3. If level requires location → require lat/lng.
 *   4. If level requires area → load area, run isPointInArea, enforce
 *      inside (required_inside) or outside (required_outside).
 *   5. Reject if there's already an open shift.
 *   6. INSERT punch with snapshot of area geometry.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { clockInputSchema } from "@/lib/schemas/attendance"
import {
  attendanceRequiresArea,
  attendanceRequiresLocation,
  type AttendanceRequired,
} from "@/lib/constants/attendance"
import { isPointInArea } from "@/lib/services/geofencing"
import type {
  AreaGeometry,
  AttendancePunch,
  AttendanceShift,
  ClockInput,
} from "@/lib/types/attendance"

/* ── Internal: find the actor's open shift, if any ──────────── */

async function findOpenShift(
  userId: string,
  tenantId: string,
): Promise<{ id: string; punched_at: string } | null> {
  const [row] = await db`
    SELECT p1.id, p1.punched_at
    FROM attendance_punches p1
    WHERE p1.user_id = ${userId}
      AND p1.tenant_id = ${tenantId}
      AND p1.punch_type = 'clock_in'
      AND p1.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM attendance_punches p2
        WHERE p2.user_id = p1.user_id
          AND p2.tenant_id = p1.tenant_id
          AND p2.punch_type = 'clock_out'
          AND p2.deleted_at IS NULL
          AND p2.punched_at > p1.punched_at
      )
    ORDER BY p1.punched_at DESC
    LIMIT 1
  `
  return (row as unknown as { id: string; punched_at: string } | undefined) ?? null
}

/* ── Internal: validate location vs area policy ─────────────── */

interface LocationCheck {
  ok: boolean
  error?: string
  is_within_area: boolean | null
  area_snapshot: AreaGeometry | null
  area_id: string | null
}

async function validateLocationAgainstPolicy(
  userId: string,
  tenantId: string,
  level: AttendanceRequired,
  lat: number | undefined,
  lng: number | undefined,
): Promise<LocationCheck> {
  if (!attendanceRequiresLocation(level)) {
    return { ok: true, is_within_area: null, area_snapshot: null, area_id: null }
  }

  if (lat == null || lng == null) {
    return {
      ok: false,
      error: "נדרש מיקום (lat/lng) לצורך החתמה",
      is_within_area: null,
      area_snapshot: null,
      area_id: null,
    }
  }

  if (!attendanceRequiresArea(level)) {
    return {
      ok: true,
      is_within_area: null,
      area_snapshot: null,
      area_id: null,
    }
  }

  // Need to load the user's mapped area.
  const [user] = await db`
    SELECT attendance_area_id FROM users
    WHERE id = ${userId} AND tenant_id = ${tenantId}
    LIMIT 1
  `
  const areaId = (user as unknown as { attendance_area_id: string | null } | undefined)
    ?.attendance_area_id ?? null

  if (!areaId) {
    return {
      ok: false,
      error: "לא הוקצה לעובד אזור — לא ניתן להחתים",
      is_within_area: null,
      area_snapshot: null,
      area_id: null,
    }
  }

  const [area] = await db`
    SELECT id, geometry FROM attendance_areas
    WHERE id = ${areaId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (!area) {
    return {
      ok: false,
      error: "האזור המוקצה לעובד אינו זמין",
      is_within_area: null,
      area_snapshot: null,
      area_id: null,
    }
  }

  const geometry = (area as unknown as { geometry: AreaGeometry }).geometry
  const inside = isPointInArea(lat, lng, geometry)
  const allowed = level === "required_inside" ? inside : !inside

  if (!allowed) {
    return {
      ok: false,
      error:
        level === "required_inside"
          ? "אינך נמצא בתוך האזור הנדרש להחתמה"
          : "אינך נמצא מחוץ לאזור הנדרש להחתמה",
      is_within_area: inside,
      area_snapshot: geometry,
      area_id: areaId,
    }
  }

  return {
    ok: true,
    is_within_area: inside,
    area_snapshot: geometry,
    area_id: areaId,
  }
}

/* ── Clock In ───────────────────────────────────────────────── */

export async function clockIn(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  input: ClockInput = {},
): Promise<{ success: boolean; error?: string; punch_id?: string }> {
  try {
    const actor = await requireActor()

    const parsed = clockInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה",
      }
    }
    const data = parsed.data

    // 1. Load policy.
    const [user] = await db`
      SELECT attendance_required FROM users
      WHERE id = ${actor.userId} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `
    const level =
      ((user as unknown as { attendance_required: AttendanceRequired } | undefined)
        ?.attendance_required) ?? "none"

    if (level === "none") {
      return {
        success: false,
        error: "החתמת נוכחות אינה מופעלת עבורך",
      }
    }

    // 2. Validate location against policy.
    const locCheck = await validateLocationAgainstPolicy(
      actor.userId,
      actor.tenantId,
      level,
      data.lat,
      data.lng,
    )
    if (!locCheck.ok) {
      return { success: false, error: locCheck.error }
    }

    // 3. Refuse if shift is already open.
    const open = await findOpenShift(actor.userId, actor.tenantId)
    if (open) {
      return {
        success: false,
        error: "יש משמרת פתוחה. סגור אותה לפני החתמה חדשה",
      }
    }

    // 4. Insert.
    const deviceInfo = data.device_info ?? null
    const [row] = await db`
      INSERT INTO attendance_punches
        (tenant_id, user_id, punch_type, lat, lng,
         area_id, area_snapshot, is_within_area, device_info, notes)
      VALUES
        (${actor.tenantId}, ${actor.userId}, 'clock_in',
         ${data.lat ?? null}, ${data.lng ?? null},
         ${locCheck.area_id},
         ${locCheck.area_snapshot ? db.json(locCheck.area_snapshot as unknown as Parameters<typeof db.json>[0]) : null},
         ${locCheck.is_within_area},
         ${deviceInfo ? db.json(deviceInfo as unknown as Parameters<typeof db.json>[0]) : null},
         ${data.notes ?? null})
      RETURNING id
    `
    return { success: true, punch_id: (row as unknown as { id: string }).id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בהחתמת כניסה",
    }
  }
}

/* ── Clock Out ──────────────────────────────────────────────── */

export async function clockOut(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  input: ClockInput = {},
): Promise<{ success: boolean; error?: string; punch_id?: string }> {
  try {
    const actor = await requireActor()

    const parsed = clockInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה",
      }
    }
    const data = parsed.data

    // 1. Must have an open shift.
    const open = await findOpenShift(actor.userId, actor.tenantId)
    if (!open) {
      return {
        success: false,
        error: "אין משמרת פתוחה לסגירה",
      }
    }

    // 2. Re-load policy + validate location with same rules as clockIn.
    const [user] = await db`
      SELECT attendance_required FROM users
      WHERE id = ${actor.userId} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `
    const level =
      ((user as unknown as { attendance_required: AttendanceRequired } | undefined)
        ?.attendance_required) ?? "none"

    const locCheck = await validateLocationAgainstPolicy(
      actor.userId,
      actor.tenantId,
      level,
      data.lat,
      data.lng,
    )
    if (!locCheck.ok) {
      return { success: false, error: locCheck.error }
    }

    // 3. Insert.
    const deviceInfo = data.device_info ?? null
    const [row] = await db`
      INSERT INTO attendance_punches
        (tenant_id, user_id, punch_type, lat, lng,
         area_id, area_snapshot, is_within_area, device_info, notes)
      VALUES
        (${actor.tenantId}, ${actor.userId}, 'clock_out',
         ${data.lat ?? null}, ${data.lng ?? null},
         ${locCheck.area_id},
         ${locCheck.area_snapshot ? db.json(locCheck.area_snapshot as unknown as Parameters<typeof db.json>[0]) : null},
         ${locCheck.is_within_area},
         ${deviceInfo ? db.json(deviceInfo as unknown as Parameters<typeof db.json>[0]) : null},
         ${data.notes ?? null})
      RETURNING id
    `
    return { success: true, punch_id: (row as unknown as { id: string }).id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בהחתמת יציאה",
    }
  }
}

/* ── Get My Shifts (chronological, paired) ──────────────────── */

export async function getMyShifts(opts?: {
  from?: string
  to?: string
}): Promise<AttendanceShift[]> {
  const actor = await requireActor()

  const from = opts?.from ?? null
  const to = opts?.to ?? null

  const rows = await db`
    SELECT
      id, tenant_id, user_id, punch_type, punched_at,
      lat, lng, area_id, area_snapshot, is_within_area,
      device_info, ip_address, notes,
      absence_type, absence_from, absence_to,
      created_at, deleted_at
    FROM attendance_punches
    WHERE user_id = ${actor.userId}
      AND tenant_id = ${actor.tenantId}
      AND deleted_at IS NULL
      AND punch_type IN ('clock_in', 'clock_out')
      ${from ? db`AND punched_at >= ${from}::timestamptz` : db``}
      ${to ? db`AND punched_at <= ${to}::timestamptz` : db``}
    ORDER BY punched_at ASC
  `

  const punches = rows as unknown as AttendancePunch[]
  const shifts: AttendanceShift[] = []
  let pending: AttendancePunch | null = null

  for (const p of punches) {
    if (p.punch_type === "clock_in") {
      // If we already had a pending clock_in (orphan — no clock_out before it),
      // close it as an open shift before starting a new one.
      if (pending) {
        shifts.push({
          clock_in: pending,
          clock_out: null,
          duration_ms: null,
          is_open: true,
        })
      }
      pending = p
    } else if (p.punch_type === "clock_out" && pending) {
      const duration =
        new Date(p.punched_at).getTime() - new Date(pending.punched_at).getTime()
      shifts.push({
        clock_in: pending,
        clock_out: p,
        duration_ms: duration,
        is_open: false,
      })
      pending = null
    }
    // Stray clock_out without pending clock_in: ignore (data anomaly).
  }

  // Final pending = current open shift.
  if (pending) {
    shifts.push({
      clock_in: pending,
      clock_out: null,
      duration_ms: null,
      is_open: true,
    })
  }

  return shifts
}

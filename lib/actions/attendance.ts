"use server"

/**
 * Attendance Records — server actions
 * ───────────────────────────────────
 * Shift-per-row model (see migration 2026-05-16_attendance.sql).
 * Authorization is *not* enforced here — callers must gate by the
 * `attendance` module's permission flags before invoking these.
 *
 * Open-shift invariant: a partial UNIQUE index
 * (uq_attendance_records_open_shift) guarantees at most one row per
 * user has clock_out IS NULL. `clockIn` translates the resulting
 * 23505 into a friendly Hebrew error.
 */

import { db } from "@/lib/db"
import { isPointInArea } from "@/lib/services/geofencing"
import type {
  AreaGeometry,
  AttendanceRecord,
  AttendanceSummary,
} from "@/lib/types/attendance"

export type GeoCoords = { lat: number; lng: number }

type UserGeofenceRow = {
  id: string
  attendance_area_id: string | null
  geometry: AreaGeometry | null
  area_name: string | null
}

async function checkGeofence(
  tenantId: string,
  userId: string,
  coords: GeoCoords | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = (await db`
    SELECT u.id, u.attendance_area_id, a.geometry, a.name AS area_name
    FROM users u
    LEFT JOIN attendance_areas a
      ON a.id = u.attendance_area_id
     AND a.deleted_at IS NULL
    WHERE u.id = ${userId} AND u.tenant_id = ${tenantId}
  `) as unknown as [UserGeofenceRow?]

  if (!user || user.attendance_area_id === null) return { ok: true }

  if (!coords) {
    return { ok: false, error: "נדרשת הרשאת מיקום לדיווח נוכחות" }
  }

  if (!user.geometry) return { ok: true }

  if (!isPointInArea(coords.lat, coords.lng, user.geometry)) {
    return {
      ok: false,
      error: `יש לדווח מתוך אזור "${user.area_name ?? ""}"`,
    }
  }
  return { ok: true }
}

/* ── 1. Clock in ──────────────────────────────────────────── */

export async function clockIn(
  tenantId: string,
  userId: string,
  coords?: GeoCoords,
): Promise<{ success: boolean; error?: string; recordId?: string }> {
  const gate = await checkGeofence(tenantId, userId, coords)
  if (!gate.ok) return { success: false, error: gate.error }

  try {
    const [row] = await db`
      INSERT INTO attendance_records
        (tenant_id, user_id, clock_in, work_date, source)
      VALUES
        (${tenantId}, ${userId}, NOW(),
         (NOW() AT TIME ZONE 'Asia/Jerusalem')::date,
         'self')
      RETURNING id
    `
    return { success: true, recordId: (row as { id: string }).id }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (
      e.code === "23505" ||
      (e.message ?? "").includes("uq_attendance_records_open_shift")
    ) {
      return { success: false, error: "כבר יש משמרת פתוחה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בהחתמת כניסה",
    }
  }
}

/* ── 2. Clock out ─────────────────────────────────────────── */

export async function clockOut(
  tenantId: string,
  userId: string,
  coords?: GeoCoords,
): Promise<{ success: boolean; error?: string }> {
  const gate = await checkGeofence(tenantId, userId, coords)
  if (!gate.ok) return { success: false, error: gate.error }

  try {
    const rows = await db`
      UPDATE attendance_records
      SET clock_out = NOW(), updated_at = NOW()
      WHERE tenant_id = ${tenantId}
        AND user_id = ${userId}
        AND clock_out IS NULL
      RETURNING id
    `
    if (rows.length === 0) {
      return { success: false, error: "אין משמרת פתוחה" }
    }
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בהחתמת יציאה",
    }
  }
}

/* ── 3. Get open shift (or null) ──────────────────────────── */

export async function getOpenShift(
  tenantId: string,
  userId: string,
): Promise<AttendanceRecord | null> {
  const rows = await db`
    SELECT *
    FROM attendance_records
    WHERE tenant_id = ${tenantId}
      AND user_id = ${userId}
      AND clock_out IS NULL
    LIMIT 1
  `
  return (rows[0] as unknown as AttendanceRecord | undefined) ?? null
}

/* ── 4. Get my attendance (date range) ────────────────────── */

/**
 * Defaults to the last 30 days (DB-computed so date math runs in the
 * DB session's TZ rather than the Node process's local TZ).
 */
export async function getMyAttendance(
  tenantId: string,
  userId: string,
  fromDate?: string,
  toDate?: string,
): Promise<AttendanceRecord[]> {
  const fromFrag = fromDate ? db`${fromDate}::date` : db`CURRENT_DATE - 30`
  const toFrag = toDate ? db`${toDate}::date` : db`CURRENT_DATE`

  const rows = await db`
    SELECT *
    FROM attendance_records
    WHERE tenant_id = ${tenantId}
      AND user_id = ${userId}
      AND work_date BETWEEN ${fromFrag} AND ${toFrag}
    ORDER BY work_date DESC, clock_in DESC
  `
  return rows as unknown as AttendanceRecord[]
}

/* ── 5. Get today's punches ───────────────────────────────── */

export async function getTodayPunches(
  tenantId: string,
  userId: string,
): Promise<AttendanceRecord[]> {
  const rows = await db`
    SELECT *
    FROM attendance_records
    WHERE tenant_id = ${tenantId}
      AND user_id = ${userId}
      AND work_date = CURRENT_DATE
    ORDER BY clock_in ASC
  `
  return rows as unknown as AttendanceRecord[]
}

/* ── 6. Get attendance board (per-user daily roll-up) ─────── */

/**
 * Returns one AttendanceSummary per active user — even users with no
 * records for the date appear (with total_minutes=0, open_shift=false,
 * records=[]) so managers can see who didn't punch.
 */
export async function getAttendanceBoard(
  tenantId: string,
  date: string,
): Promise<AttendanceSummary[]> {
  const users = (await db`
    SELECT id, full_name, role
    FROM users
    WHERE tenant_id = ${tenantId}
      AND is_active = true
    ORDER BY full_name
  `) as unknown as { id: string; full_name: string; role: string }[]

  const records = (await db`
    SELECT ar.*, u.full_name
    FROM attendance_records ar
    JOIN users u ON u.id = ar.user_id
    WHERE ar.tenant_id = ${tenantId}
      AND ar.work_date = ${date}::date
    ORDER BY u.full_name, ar.clock_in
  `) as unknown as AttendanceRecord[]

  const byUser = new Map<string, AttendanceRecord[]>()
  for (const rec of records) {
    const arr = byUser.get(rec.user_id) ?? []
    arr.push(rec)
    byUser.set(rec.user_id, arr)
  }

  return users.map((u) => {
    const userRecords = byUser.get(u.id) ?? []
    let totalMs = 0
    let openShift = false
    for (const rec of userRecords) {
      if (rec.clock_out === null) {
        openShift = true
      } else {
        totalMs +=
          new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()
      }
    }
    return {
      user_id: u.id,
      full_name: u.full_name,
      work_date: date,
      total_minutes: Math.floor(totalMs / 60000),
      open_shift: openShift,
      records: userRecords,
    }
  })
}

/* ── 7. Update record (manager edit) ──────────────────────── */

export async function updateAttendanceRecord(
  tenantId: string,
  recordId: string,
  input: {
    clock_in?: string
    clock_out?: string | null
    notes?: string | null
  },
  editedBy: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = await db`
      UPDATE attendance_records SET
        clock_in   = COALESCE(${input.clock_in ?? null}::timestamptz, clock_in),
        clock_out  = COALESCE(${input.clock_out ?? null}::timestamptz, clock_out),
        notes      = COALESCE(${input.notes ?? null}::text, notes),
        source     = 'manager_edit',
        edited_by  = ${editedBy},
        edited_at  = NOW(),
        updated_at = NOW()
      WHERE id = ${recordId}
        AND tenant_id = ${tenantId}
      RETURNING id
    `
    if (rows.length === 0) {
      return { success: false, error: "רשומה לא נמצאה" }
    }
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון רשומה",
    }
  }
}

/* ── 8. Create record (manager-manual) ────────────────────── */

export async function createAttendanceRecord(
  tenantId: string,
  userId: string,
  input: {
    clock_in: string
    clock_out?: string | null
    notes?: string | null
  },
  editedBy: string,
): Promise<{ success: boolean; error?: string; recordId?: string }> {
  try {
    const [row] = await db`
      INSERT INTO attendance_records
        (tenant_id, user_id, clock_in, clock_out, work_date,
         notes, source, edited_by, edited_at)
      VALUES (
        ${tenantId},
        ${userId},
        ${input.clock_in}::timestamptz,
        ${input.clock_out ?? null}::timestamptz,
        (${input.clock_in}::timestamptz)::date,
        ${input.notes ?? null},
        'manager_manual',
        ${editedBy},
        NOW()
      )
      RETURNING id
    `
    return { success: true, recordId: (row as { id: string }).id }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה ביצירת רשומה",
    }
  }
}

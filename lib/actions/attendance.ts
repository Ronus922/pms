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
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type {
  AreaGeometry,
  AttendanceRecord,
  AttendanceStaffOption,
  AttendanceSummary,
  MonthlyAttendanceSummary,
  UpsertAttendanceEntryInput,
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
        AND entry_type = 'regular'
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
      AND entry_type = 'regular'
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
    SELECT
      id, tenant_id, user_id,
      clock_in, clock_out,
      TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
      notes, source, entry_type,
      edited_by, edited_at, created_at, updated_at
    FROM attendance_records
    WHERE tenant_id = ${tenantId}
      AND user_id = ${userId}
      AND work_date BETWEEN ${fromFrag} AND ${toFrag}
    ORDER BY work_date DESC, clock_in DESC NULLS LAST
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
      // Non-regular rows (vacation/sick/holiday/absence) have NULL
      // clock_in/out by design — they don't count toward worked time
      // and they aren't "open shifts" awaiting a clock-out.
      if (rec.entry_type !== "regular") continue
      if (rec.clock_out === null || rec.clock_in === null) {
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

/* ── 9. Manager — staff picker ────────────────────────────── */

/**
 * Returns active employees + the actor themselves (kept even if
 * inactive so a self-view doesn't accidentally vanish). Used by
 * the manager attendance page.
 */
export async function getStaffListForAttendance(): Promise<
  | { success: true; data: AttendanceStaffOption[] }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("attendance", "view")
    const rows = (await db`
      SELECT id, full_name, role, is_active
      FROM users
      WHERE tenant_id = ${actor.tenantId}
        AND (is_active = true OR id = ${actor.userId})
      ORDER BY is_active DESC, full_name
    `) as unknown as AttendanceStaffOption[]
    return { success: true, data: rows }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת רשימת עובדים",
    }
  }
}

/* ── 10. Manager — monthly view (single employee) ────────── */

/**
 * Returns every attendance row for `employeeId` in the given
 * calendar month (`year`/`month` are 1-based), ordered by work_date
 * then clock_in. Caller renders a per-day list — multiple shifts on
 * the same date show as separate rows.
 */
export async function getMonthlyAttendanceForEmployee(
  employeeId: string,
  year: number,
  month: number,
): Promise<
  | { success: true; records: AttendanceRecord[]; summary: MonthlyAttendanceSummary }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("attendance", "view")

    const from = monthStart(year, month)
    const to = monthEnd(year, month)

    const rows = (await db`
      SELECT
        ar.id, ar.tenant_id, ar.user_id,
        ar.clock_in, ar.clock_out,
        TO_CHAR(ar.work_date, 'YYYY-MM-DD') AS work_date,
        ar.notes, ar.source, ar.entry_type,
        ar.edited_by, ar.edited_at, ar.created_at, ar.updated_at,
        u.full_name AS user_name
      FROM attendance_records ar
      JOIN users u ON u.id = ar.user_id
      WHERE ar.tenant_id = ${actor.tenantId}
        AND ar.user_id = ${employeeId}
        AND ar.work_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY ar.work_date ASC, ar.clock_in ASC
    `) as unknown as AttendanceRecord[]

    const summary = buildMonthlySummary(rows)
    return { success: true, records: rows, summary }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת נוכחות חודשית",
    }
  }
}

/* ── 11. Manager — monthly view (all employees) ──────────── */

export async function getMonthlyAttendanceForAll(
  year: number,
  month: number,
): Promise<
  | { success: true; records: AttendanceRecord[] }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("attendance", "view")

    const from = monthStart(year, month)
    const to = monthEnd(year, month)

    const rows = (await db`
      SELECT
        ar.id, ar.tenant_id, ar.user_id,
        ar.clock_in, ar.clock_out,
        TO_CHAR(ar.work_date, 'YYYY-MM-DD') AS work_date,
        ar.notes, ar.source, ar.entry_type,
        ar.edited_by, ar.edited_at, ar.created_at, ar.updated_at,
        u.full_name AS user_name
      FROM attendance_records ar
      JOIN users u ON u.id = ar.user_id
      WHERE ar.tenant_id = ${actor.tenantId}
        AND ar.work_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY ar.work_date ASC, u.full_name ASC, ar.clock_in ASC
    `) as unknown as AttendanceRecord[]

    return { success: true, records: rows }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת נוכחות חודשית",
    }
  }
}

/* ── 12. Manager — upsert entry ──────────────────────────── */

/**
 * Create-or-update a single attendance entry. Branches on entry_type:
 *
 *   - `regular`  → expects clock_in_time (HH:MM); clock_out_time optional.
 *   - non-regular → ignores time inputs; stores a midnight-of-work_date
 *     sentinel in clock_in (so the row satisfies NOT NULL + the
 *     clock-order check) and leaves clock_out NULL.
 *
 * The midnight sentinel for non-regular rows is invisible to the UI —
 * components decide what to render based on `entry_type`, not the
 * timestamp. Storing it lets the existing user_date index keep working
 * without a separate calendar-entries table.
 */
export async function upsertAttendanceEntry(
  input: UpsertAttendanceEntryInput,
): Promise<{ success: boolean; error?: string; recordId?: string }> {
  try {
    const actor = await requirePermission("attendance", "edit")

    if (!input.user_id) return { success: false, error: "חסר עובד" }
    if (!input.work_date) return { success: false, error: "חסר תאריך" }

    const isRegular = input.entry_type === "regular"

    let clockInIso: string | null
    let clockOutIso: string | null

    if (isRegular) {
      if (!input.clock_in_time) {
        return { success: false, error: "שעת הגעה נדרשת למשמרת רגילה" }
      }
      clockInIso = combineDateAndTime(input.work_date, input.clock_in_time)
      clockOutIso = input.clock_out_time
        ? combineDateAndTime(input.work_date, input.clock_out_time, clockInIso)
        : null
    } else {
      // Non-regular rows don't carry timestamps — work_date alone
      // anchors them on the calendar (matches the column-nullable
      // schema introduced 2026-05-17 + chk_attendance_regular_…check).
      clockInIso = null
      clockOutIso = null
    }

    const notes = input.notes?.trim() || null

    if (input.id) {
      const rows = await db`
        UPDATE attendance_records SET
          user_id    = ${input.user_id},
          work_date  = ${input.work_date}::date,
          entry_type = ${input.entry_type},
          clock_in   = ${clockInIso}::timestamptz,
          clock_out  = ${clockOutIso}::timestamptz,
          notes      = ${notes},
          source     = 'manager_edit',
          edited_by  = ${actor.userId},
          edited_at  = NOW(),
          updated_at = NOW()
        WHERE id = ${input.id}
          AND tenant_id = ${actor.tenantId}
        RETURNING id
      `
      if (rows.length === 0) {
        return { success: false, error: "רשומה לא נמצאה" }
      }
      return { success: true, recordId: (rows[0] as { id: string }).id }
    }

    const [row] = await db`
      INSERT INTO attendance_records
        (tenant_id, user_id, clock_in, clock_out, work_date,
         notes, entry_type, source, edited_by, edited_at)
      VALUES (
        ${actor.tenantId},
        ${input.user_id},
        ${clockInIso}::timestamptz,
        ${clockOutIso}::timestamptz,
        ${input.work_date}::date,
        ${notes},
        ${input.entry_type},
        'manager_manual',
        ${actor.userId},
        NOW()
      )
      RETURNING id
    `
    return { success: true, recordId: (row as { id: string }).id }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    const e = err as { code?: string; message?: string }
    if (
      e.code === "23505" ||
      (e.message ?? "").includes("uq_attendance_records_open_shift")
    ) {
      return { success: false, error: "כבר קיימת משמרת פתוחה לעובד זה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בשמירת הרשומה",
    }
  }
}

/* ── 13. Manager — delete entry ──────────────────────────── */

export async function deleteAttendanceEntry(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("attendance", "delete")
    const rows = await db`
      DELETE FROM attendance_records
      WHERE id = ${id}
        AND tenant_id = ${actor.tenantId}
      RETURNING id
    `
    if (rows.length === 0) {
      return { success: false, error: "רשומה לא נמצאה" }
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה במחיקה",
    }
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function monthStart(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`
}

function monthEnd(year: number, month: number): string {
  // JS Date: month is 0-based; day=0 → last day of previous month.
  // So new Date(year, month, 0) gives the last day of `month` (1-based).
  const d = new Date(Date.UTC(year, month, 0))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
 * Combines a YYYY-MM-DD date with HH:MM in Asia/Jerusalem (+03:00).
 * If `afterIso` is provided and the resulting timestamp is ≤ it,
 * adds one day so an overnight shift's clock_out lands on the next
 * calendar day (matches the DB's clock_order check).
 */
function combineDateAndTime(date: string, time: string, afterIso?: string): string {
  const iso = `${date}T${time.length === 5 ? `${time}:00` : time}+03:00`
  if (!afterIso) return iso
  if (new Date(iso).getTime() > new Date(afterIso).getTime()) return iso
  const next = new Date(`${date}T00:00:00+03:00`)
  next.setUTCDate(next.getUTCDate() + 1)
  const y = next.getUTCFullYear()
  const m = pad2(next.getUTCMonth() + 1)
  const d = pad2(next.getUTCDate())
  return `${y}-${m}-${d}T${time.length === 5 ? `${time}:00` : time}+03:00`
}

function buildMonthlySummary(rows: AttendanceRecord[]): MonthlyAttendanceSummary {
  const STANDARD_DAY_MINUTES = 9 * 60
  const issues: string[] = []
  const workedDays = new Set<string>()
  let totalMinutes = 0

  for (const r of rows) {
    if (r.entry_type !== "regular") continue
    workedDays.add(r.work_date)
    if (r.clock_out === null || r.clock_in === null) {
      issues.push(`משמרת פתוחה בתאריך ${r.work_date}`)
      continue
    }
    const minutes = Math.max(
      0,
      Math.floor(
        (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000,
      ),
    )
    totalMinutes += minutes
  }

  const workDays = workedDays.size
  const avgMinutesPerDay = workDays === 0 ? 0 : Math.round(totalMinutes / workDays)
  const overtimeMinutes = Math.max(0, totalMinutes - workDays * STANDARD_DAY_MINUTES)

  return {
    work_days: workDays,
    total_minutes: totalMinutes,
    avg_minutes_per_day: avgMinutesPerDay,
    overtime_minutes: overtimeMinutes,
    issues,
  }
}

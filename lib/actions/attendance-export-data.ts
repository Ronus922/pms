"use server"

/**
 * Attendance — data fetch for client-side PDF rendering.
 * Mirrors the export-Excel query but returns plain JSON so the
 * client can hand it to @react-pdf/renderer.
 */

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type { AttendanceRecord } from "@/lib/types/attendance"

export interface AttendanceExportPayload {
  tenantName: string
  employeeName: string | null
  year: number
  month: number
  records: AttendanceRecord[]
}

export async function getAttendanceExportData(input: {
  year: number
  month: number
  employeeId?: string
}): Promise<{ success: true; data: AttendanceExportPayload } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("attendance", "view")
    const { year, month, employeeId } = input
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, error: "חודש לא תקין" }
    }

    function pad2(n: number): string {
      return n < 10 ? `0${n}` : String(n)
    }
    const from = `${year}-${pad2(month)}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const to = `${year}-${pad2(month)}-${pad2(lastDay)}`

    const records = (await db`
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
        ${employeeId ? db`AND ar.user_id = ${employeeId}` : db``}
      ORDER BY ar.work_date ASC, u.full_name ASC, ar.clock_in ASC
    `) as unknown as AttendanceRecord[]

    const [tenant] = (await db`
      SELECT name FROM tenants WHERE id = ${actor.tenantId}
    `) as unknown as [{ name: string }?]
    const tenantName = tenant?.name || "GuestHub"

    let employeeName: string | null = null
    if (employeeId) {
      const [u] = (await db`
        SELECT full_name FROM users
        WHERE id = ${employeeId} AND tenant_id = ${actor.tenantId}
      `) as unknown as [{ full_name: string }?]
      employeeName = u?.full_name ?? null
    }

    return {
      success: true,
      data: { tenantName, employeeName, year, month, records },
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת הנתונים",
    }
  }
}

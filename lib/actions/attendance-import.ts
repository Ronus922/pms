"use server"

/**
 * Attendance — bulk import from Excel.
 * ────────────────────────────────────
 * Client parses the xlsx and ships a normalized JSON payload here.
 * We validate each row, resolve employee names → ids (case-insensitive,
 * trimmed), and upsert via the same INSERT path used for manual entry.
 *
 * Strategy: each row inserts a NEW record. We deliberately don't
 * "update existing rows for same (user, date)" — that would silently
 * mutate manager-edited timestamps. If the user wants to overwrite,
 * they should delete first or edit in the UI. The collision case is
 * surfaced in the per-row error list so it's visible.
 *
 * The open-shift unique index still applies: trying to import a row
 * with NULL clock_out when the user already has an open shift returns
 * the same friendly Hebrew error as manual entry.
 */

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type { AttendanceEntryType } from "@/lib/types/attendance"

export interface ImportRow {
  /** 1-based index from the source spreadsheet (header is row 1, first data row is 2…). */
  rowNumber: number
  workDate: string | null
  employeeName: string | null
  /** Hebrew label as it appears in the export — converted to canonical type server-side. */
  entryTypeLabel: string | null
  clockInTime: string | null
  clockOutTime: string | null
  notes: string | null
}

export interface ImportResult {
  success: boolean
  insertedCount: number
  errorCount: number
  errors: { rowNumber: number; message: string }[]
  error?: string
}

const TYPE_LABEL_TO_ENUM: Record<string, AttendanceEntryType> = {
  "רגיל":    "regular",
  "חופשה":   "vacation",
  "מחלה":    "sick",
  "חג":      "holiday",
  "היעדרות": "absence",
  "regular":  "regular",
  "vacation": "vacation",
  "sick":     "sick",
  "holiday":  "holiday",
  "absence":  "absence",
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

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

export async function bulkImportAttendance(input: {
  /** When set, rows with empty employee name default to this user. */
  defaultEmployeeId?: string
  rows: ImportRow[]
}): Promise<ImportResult> {
  try {
    const actor = await requirePermission("attendance", "edit")

    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      return { success: false, insertedCount: 0, errorCount: 0, errors: [], error: "אין שורות לייבוא" }
    }

    /* ── Pre-load name → id map for the tenant (one query) ── */
    const users = (await db`
      SELECT id, full_name
      FROM users
      WHERE tenant_id = ${actor.tenantId}
    `) as unknown as { id: string; full_name: string }[]
    const nameToId = new Map<string, string>()
    for (const u of users) {
      nameToId.set(u.full_name.trim().toLowerCase(), u.id)
    }

    const errors: { rowNumber: number; message: string }[] = []
    let insertedCount = 0

    for (const row of input.rows) {
      const rowErr = (msg: string) => errors.push({ rowNumber: row.rowNumber, message: msg })

      const workDate = row.workDate?.trim() ?? null
      if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
        rowErr("תאריך חסר או לא בפורמט YYYY-MM-DD")
        continue
      }

      let userId: string | null = null
      const name = row.employeeName?.trim() ?? ""
      if (name) {
        userId = nameToId.get(name.toLowerCase()) ?? null
        if (!userId) {
          rowErr(`עובד "${name}" לא נמצא`)
          continue
        }
      } else if (input.defaultEmployeeId) {
        userId = input.defaultEmployeeId
      } else {
        rowErr("חסר שם עובד")
        continue
      }

      const typeLabel = row.entryTypeLabel?.trim() ?? ""
      const entryType = TYPE_LABEL_TO_ENUM[typeLabel] ?? null
      if (!entryType) {
        rowErr(`סוג רישום לא חוקי: "${typeLabel}"`)
        continue
      }

      const isRegular = entryType === "regular"
      let clockInIso: string
      let clockOutIso: string | null

      if (isRegular) {
        const ci = row.clockInTime?.trim()
        if (!ci || !/^\d{1,2}:\d{2}$/.test(ci)) {
          rowErr("שעת הגעה חסרה או לא בפורמט HH:MM")
          continue
        }
        clockInIso = combineDateAndTime(workDate, ci.length === 4 ? `0${ci}` : ci)
        const co = row.clockOutTime?.trim()
        if (co) {
          if (!/^\d{1,2}:\d{2}$/.test(co)) {
            rowErr("שעת יציאה לא בפורמט HH:MM")
            continue
          }
          clockOutIso = combineDateAndTime(workDate, co.length === 4 ? `0${co}` : co, clockInIso)
        } else {
          clockOutIso = null
        }
      } else {
        clockInIso = `${workDate}T00:00:00+03:00`
        clockOutIso = null
      }

      const notes = row.notes?.trim() || null

      try {
        await db`
          INSERT INTO attendance_records
            (tenant_id, user_id, clock_in, clock_out, work_date,
             notes, entry_type, source, edited_by, edited_at)
          VALUES (
            ${actor.tenantId},
            ${userId},
            ${clockInIso}::timestamptz,
            ${clockOutIso}::timestamptz,
            ${workDate}::date,
            ${notes},
            ${entryType},
            'manager_manual',
            ${actor.userId},
            NOW()
          )
        `
        insertedCount++
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (
          e.code === "23505" ||
          (e.message ?? "").includes("uq_attendance_records_open_shift")
        ) {
          rowErr("כבר קיימת משמרת פתוחה לעובד זה")
        } else {
          rowErr(e.message || "שגיאה בהוספת רשומה")
        }
      }
    }

    return {
      success: errors.length === 0,
      insertedCount,
      errorCount: errors.length,
      errors,
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, insertedCount: 0, errorCount: 0, errors: [], error: err.message }
    }
    return {
      success: false,
      insertedCount: 0,
      errorCount: 0,
      errors: [],
      error: err instanceof Error ? err.message : "שגיאה בייבוא",
    }
  }
}

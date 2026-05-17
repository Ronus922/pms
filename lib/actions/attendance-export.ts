"use server"

/**
 * Attendance — Excel export
 * ─────────────────────────
 * Generates an .xlsx workbook for the manager attendance view.
 * Branches on scope:
 *   - employeeId provided → "single employee" sheet: one row per day,
 *     with daily totals + a footer KPI block.
 *   - employeeId omitted → "all employees" sheet: one row per record,
 *     including the employee column.
 *
 * Returns base64 + filename for the client to download via
 * downloadBase64() (matches lib/utils/reservation-export-client.ts).
 */

import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type { AttendanceRecord } from "@/lib/types/attendance"

const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]
const HEB_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
const ENTRY_TYPE_LABEL: Record<string, string> = {
  regular:  "רגיל",
  vacation: "חופשה",
  sick:     "מחלה",
  holiday:  "חג",
  absence:  "היעדרות",
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isoToHHMM(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(d)
}

function minutesBetween(start: string | Date | null, end: string | Date | null): number {
  if (!start || !end) return 0
  const a = typeof start === "string" ? new Date(start) : start
  const b = typeof end === "string" ? new Date(end) : end
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000))
}

function formatHours(total: number): string {
  if (total <= 0) return "00:00"
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${pad2(h)}:${pad2(m)}`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "attendance"
}

function applyHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003AA0" } }
  row.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
  row.height = 22
}

function applyBodyRow(row: ExcelJS.Row, nonRegular: boolean): void {
  row.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
  if (nonRegular) {
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }
  }
}

/* ── Action ──────────────────────────────────────────────────── */

export async function exportAttendanceToExcel(input: {
  year: number
  month: number
  employeeId?: string
}): Promise<{ success: boolean; base64?: string; filename?: string; error?: string }> {
  try {
    const actor = await requirePermission("attendance", "view")

    const { year, month, employeeId } = input
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, error: "חודש לא תקין" }
    }

    const from = ymd(year, month, 1)
    const to = ymd(year, month, daysInMonth(year, month))

    const records = (await db`
      SELECT
        ar.id, ar.tenant_id, ar.user_id,
        ar.clock_in, ar.clock_out,
        TO_CHAR(ar.work_date, 'YYYY-MM-DD') AS work_date,
        ar.notes, ar.source, ar.entry_type,
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

    let employeeName = ""
    if (employeeId) {
      const [u] = (await db`
        SELECT full_name FROM users
        WHERE id = ${employeeId} AND tenant_id = ${actor.tenantId}
      `) as unknown as [{ full_name: string }?]
      employeeName = u?.full_name || ""
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = tenantName
    wb.created = new Date()
    wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: "visible" }]

    const ws = wb.addWorksheet("נוכחות", { views: [{ rightToLeft: true }] })

    /* Title block — merged across all data columns */
    const isSingle = !!employeeId
    const headers = isSingle
      ? ["תאריך", "יום", "סוג", "שעת הגעה", "שעת יציאה", 'סה"כ שעות', "הערה"]
      : ["תאריך", "יום", "עובד", "סוג", "שעת הגעה", "שעת יציאה", 'סה"כ שעות', "הערה"]

    const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1)

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell("A1")
    titleCell.value = isSingle
      ? `דוח נוכחות — ${employeeName} — ${HEB_MONTHS[month - 1]} ${year}`
      : `דוח נוכחות — כל העובדים — ${HEB_MONTHS[month - 1]} ${year}`
    titleCell.font = { bold: true, size: 14, color: { argb: "FF003AA0" } }
    titleCell.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
    ws.getRow(1).height = 28

    ws.mergeCells(`A2:${lastCol}2`)
    const subCell = ws.getCell("A2")
    subCell.value = tenantName
    subCell.font = { size: 10, color: { argb: "FF6b6280" } }
    subCell.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
    ws.getRow(2).height = 16

    /* Header row */
    ws.addRow([]) // spacer
    const headerRow = ws.addRow(headers)
    applyHeader(headerRow)

    /* Body */
    if (isSingle) {
      const byDate = new Map<string, AttendanceRecord[]>()
      for (const r of records) {
        const arr = byDate.get(r.work_date) ?? []
        arr.push(r)
        byDate.set(r.work_date, arr)
      }
      const total = daysInMonth(year, month)
      let totalMinutes = 0
      const workedDays = new Set<string>()

      for (let d = 1; d <= total; d++) {
        const date = ymd(year, month, d)
        const weekday = HEB_WEEKDAYS[new Date(year, month - 1, d).getDay()]
        const dayRecs = byDate.get(date) ?? []

        if (dayRecs.length === 0) {
          const r = ws.addRow([date, weekday, "—", "", "", "", ""])
          applyBodyRow(r, false)
          continue
        }

        for (let i = 0; i < dayRecs.length; i++) {
          const rec = dayRecs[i]
          const nonRegular = rec.entry_type !== "regular"
          const typeLabel = ENTRY_TYPE_LABEL[rec.entry_type] ?? rec.entry_type
          if (nonRegular) {
            const r = ws.addRow([
              i === 0 ? date : "",
              i === 0 ? weekday : "",
              typeLabel,
              "—", "—", typeLabel,
              rec.notes ?? "",
            ])
            applyBodyRow(r, true)
          } else {
            const minutes = minutesBetween(rec.clock_in, rec.clock_out)
            if (rec.clock_out) totalMinutes += minutes
            workedDays.add(date)
            const r = ws.addRow([
              i === 0 ? date : "",
              i === 0 ? weekday : "",
              typeLabel,
              isoToHHMM(rec.clock_in),
              rec.clock_out ? isoToHHMM(rec.clock_out) : "פתוחה",
              rec.clock_out ? formatHours(minutes) : "",
              rec.notes ?? "",
            ])
            applyBodyRow(r, false)
          }
        }
      }

      /* Footer KPI */
      ws.addRow([])
      const kpiRow = ws.addRow([
        "סיכום חודשי",
        `ימי עבודה: ${workedDays.size}`,
        `סה"כ שעות: ${formatHours(totalMinutes)}`,
        `ממוצע יומי: ${formatHours(workedDays.size === 0 ? 0 : Math.round(totalMinutes / workedDays.size))}`,
        `שעות נוספות: ${formatHours(Math.max(0, totalMinutes - workedDays.size * 9 * 60))}`,
        "", "",
      ])
      kpiRow.font = { bold: true, size: 11 }
      kpiRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FA" } }
      kpiRow.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
    } else {
      for (const rec of records) {
        const date = rec.work_date
        const y = Number(date.slice(0, 4))
        const m = Number(date.slice(5, 7))
        const d = Number(date.slice(8, 10))
        const weekday = HEB_WEEKDAYS[new Date(y, m - 1, d).getDay()]
        const nonRegular = rec.entry_type !== "regular"
        const typeLabel = ENTRY_TYPE_LABEL[rec.entry_type] ?? rec.entry_type

        if (nonRegular) {
          const r = ws.addRow([
            date, weekday, rec.user_name ?? "",
            typeLabel,
            "—", "—", typeLabel,
            rec.notes ?? "",
          ])
          applyBodyRow(r, true)
        } else {
          const minutes = minutesBetween(rec.clock_in, rec.clock_out)
          const r = ws.addRow([
            date, weekday, rec.user_name ?? "",
            typeLabel,
            isoToHHMM(rec.clock_in),
            rec.clock_out ? isoToHHMM(rec.clock_out) : "פתוחה",
            rec.clock_out ? formatHours(minutes) : "",
            rec.notes ?? "",
          ])
          applyBodyRow(r, false)
        }
      }
    }

    /* Column widths */
    const widths = isSingle
      ? [12, 10, 10, 12, 12, 12, 28]
      : [12, 10, 22, 10, 12, 12, 12, 28]
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w
    })

    const buf = await wb.xlsx.writeBuffer()
    const base64 = Buffer.from(buf as ArrayBuffer).toString("base64")
    const scopePart = isSingle ? sanitizeFilename(employeeName) : "כל-העובדים"
    const filename = `נוכחות-${scopePart}-${HEB_MONTHS[month - 1]}-${year}.xlsx`

    return { success: true, base64, filename }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה ביצירת קובץ Excel",
    }
  }
}

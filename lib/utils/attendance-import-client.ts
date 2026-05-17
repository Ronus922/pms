"use client"

import ExcelJS from "exceljs"
import type { ImportRow } from "@/lib/actions/attendance-import"

/* ── Header → field mapping (Hebrew + English, lowercased + trimmed) ── */

const HEADER_MAP: Record<string, keyof ImportRow> = {
  "תאריך":          "workDate",
  "date":            "workDate",
  "work_date":       "workDate",
  "עובד":           "employeeName",
  "employee":        "employeeName",
  "employee_name":   "employeeName",
  "סוג":            "entryTypeLabel",
  "type":            "entryTypeLabel",
  "entry_type":      "entryTypeLabel",
  "שעת הגעה":       "clockInTime",
  "clock_in":        "clockInTime",
  "הגעה":           "clockInTime",
  "שעת יציאה":      "clockOutTime",
  "clock_out":       "clockOutTime",
  "יציאה":          "clockOutTime",
  "הערה":           "notes",
  "notes":           "notes",
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Normalize an ExcelJS cell value to a YYYY-MM-DD string (Asia/Jerusalem). */
function cellToDate(v: unknown): string | null {
  if (v == null || v === "") return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = pad2(v.getMonth() + 1)
    const d = pad2(v.getDate())
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YYYY or DD.MM.YYYY
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`
  return null
}

/** Normalize an ExcelJS cell value to HH:MM (24h). */
function cellToTime(v: unknown): string | null {
  if (v == null || v === "") return null
  if (v instanceof Date) {
    const h = pad2(v.getUTCHours())
    const m = pad2(v.getUTCMinutes())
    return `${h}:${m}`
  }
  if (typeof v === "number") {
    // Excel time fraction of a day
    const totalMinutes = Math.round(v * 24 * 60)
    const h = pad2(Math.floor(totalMinutes / 60) % 24)
    const m = pad2(totalMinutes % 60)
    return `${h}:${m}`
  }
  const s = String(v).trim()
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(":")
    return `${pad2(Number(h))}:${pad2(Number(m))}`
  }
  return null
}

function cellToString(v: unknown): string | null {
  if (v == null || v === "") return null
  // ExcelJS may return objects for rich text / hyperlinks
  if (typeof v === "object" && v && "text" in v) {
    const t = (v as { text?: string }).text
    return t?.trim() || null
  }
  const s = String(v).trim()
  return s || null
}

export interface ParseResult {
  rows: ImportRow[]
  /** Header names that we didn't recognize — informational, not fatal. */
  unknownHeaders: string[]
  /** Hard parse error — empty sheet, missing date column, etc. */
  fatalError?: string
}

export async function parseAttendanceXlsx(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)

  const ws = wb.worksheets[0]
  if (!ws) {
    return { rows: [], unknownHeaders: [], fatalError: "הקובץ ריק" }
  }

  /* Find the header row — first row that contains a column we know how to
   * map. This tolerates a title block above the data (the export writes
   * a 2-line title before the headers). */
  let headerRowIdx = -1
  let headerCols: Record<number, keyof ImportRow> = {}
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const cols: Record<number, keyof ImportRow> = {}
    let matches = 0
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = String(cell.value ?? "").trim().toLowerCase()
      const field = HEADER_MAP[key]
      if (field) {
        cols[colNumber] = field
        matches++
      }
    })
    if (matches >= 2) {
      // Need at least date + one more known column to call it a header.
      headerRowIdx = r
      headerCols = cols
      break
    }
  }

  if (headerRowIdx < 0) {
    return {
      rows: [],
      unknownHeaders: [],
      fatalError: "לא נמצאה שורת כותרת. ודא שהקובץ כולל את העמודות: תאריך, סוג, שעת הגעה.",
    }
  }

  const unknownHeaders: string[] = []
  const headerRow = ws.getRow(headerRowIdx)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (!headerCols[colNumber]) {
      const txt = String(cell.value ?? "").trim()
      if (txt) unknownHeaders.push(txt)
    }
  })

  /* Data rows */
  const rows: ImportRow[] = []
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)

    const row_: Partial<ImportRow> = {}
    let nonEmpty = false
    for (const [colStr, field] of Object.entries(headerCols)) {
      const colNumber = Number(colStr)
      const cell = row.getCell(colNumber)
      const raw = cell.value
      if (raw == null || raw === "") continue
      nonEmpty = true
      switch (field) {
        case "workDate":
          row_.workDate = cellToDate(raw)
          break
        case "clockInTime":
          row_.clockInTime = cellToTime(raw)
          break
        case "clockOutTime":
          row_.clockOutTime = cellToTime(raw)
          break
        default:
          ;(row_ as Record<string, string | null>)[field] = cellToString(raw)
      }
    }
    if (!nonEmpty) continue
    rows.push({
      rowNumber: r,
      workDate: row_.workDate ?? null,
      employeeName: row_.employeeName ?? null,
      entryTypeLabel: row_.entryTypeLabel ?? null,
      clockInTime: row_.clockInTime ?? null,
      clockOutTime: row_.clockOutTime ?? null,
      notes: row_.notes ?? null,
    })
  }

  return { rows, unknownHeaders }
}

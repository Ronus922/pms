"use client"

import { pdf } from "@react-pdf/renderer"
import { createElement } from "react"
import { AttendancePdfDocument } from "@/components/attendance/AttendancePdfDocument"
import { getAttendanceExportData } from "@/lib/actions/attendance-export-data"
import { downloadBlob } from "@/lib/utils/reservation-export-client"

const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "attendance"
}

export async function downloadAttendancePdf(input: {
  year: number
  month: number
  employeeId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await getAttendanceExportData(input)
    if (!res.success) return { success: false, error: res.error }
    const { data } = res

    const doc = createElement(AttendancePdfDocument, {
      tenantName: data.tenantName,
      employeeName: data.employeeName,
      year: data.year,
      month: data.month,
      records: data.records,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob()

    const scope = data.employeeName ? sanitizeFilename(data.employeeName) : "כל-העובדים"
    const filename = `נוכחות-${scope}-${HEB_MONTHS[data.month - 1]}-${data.year}.pdf`
    downloadBlob(blob, filename)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה ביצירת PDF",
    }
  }
}

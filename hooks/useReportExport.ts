"use client"

import { useCallback, useState } from "react"
import type { ExportFormat, ReportColumnDef } from "@/lib/reports/types"

interface ExportOptions {
  title: string
  columns: ReportColumnDef[]
  data: Record<string, unknown>[]
  format: ExportFormat
  filename?: string
}

export function useReportExport() {
  const [exporting, setExporting] = useState(false)

  const exportReport = useCallback(async (options: ExportOptions) => {
    setExporting(true)
    try {
      exportCSV(options)
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportReport, exporting }
}

function exportCSV({ title, columns, data, filename }: ExportOptions) {
  const headers = columns.map((c) => c.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      if (val === null || val === undefined) return ""
      return String(val)
    }),
  )

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n")

  const bom = "\uFEFF"
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename ?? title}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

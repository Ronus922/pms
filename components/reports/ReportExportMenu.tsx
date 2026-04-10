"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { useReportExport } from "@/hooks/useReportExport"
import type { ExportFormat, ReportColumnDef } from "@/lib/reports/types"

interface ReportExportMenuProps {
  title: string
  columns: ReportColumnDef[]
  data: Record<string, unknown>[]
  className?: string
}

const FORMATS: { id: ExportFormat; label: string; icon: string }[] = [
  { id: "excel", label: "Excel", icon: "file_download" },
  { id: "csv", label: "CSV", icon: "file_text" },
  { id: "pdf", label: "PDF", icon: "description" },
]

export function ReportExportMenu({ title, columns, data, className }: ReportExportMenuProps) {
  const [open, setOpen] = useState(false)
  const { exportReport, exporting } = useReportExport()

  const handleExport = async (format: ExportFormat) => {
    setOpen(false)
    await exportReport({ title, columns, data, format })
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={data.length === 0 || exporting}
        className="report-export-btn flex items-center gap-2"
      >
        <Icon name={exporting ? "hourglass_empty" : "file_download"} size="sm" />
        ייצוא
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute start-0 top-full z-50 mt-2 report-export-dropdown">
            {FORMATS.map(({ id, label, icon }) => (
              <button key={id} type="button" onClick={() => handleExport(id)}>
                <Icon name={icon} size="sm" className="text-muted-foreground" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

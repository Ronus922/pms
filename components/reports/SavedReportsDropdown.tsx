"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import type { SavedReport } from "@/lib/reports/types"

interface SavedReportsDropdownProps {
  savedReports: SavedReport[]
  onSelect: (report: SavedReport) => void
  onDelete: (id: string) => void
}

export function SavedReportsDropdown({ savedReports, onSelect, onDelete }: SavedReportsDropdownProps) {
  const [open, setOpen] = useState(false)
  if (savedReports.length === 0) return null

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent min-h-[44px]">
        <Icon name="star" size="sm" />
        דוחות שמורים
        <Icon name={open ? "expand_less" : "expand_more"} size="sm" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute start-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-lg">
            <div className="max-h-72 overflow-y-auto space-y-1">
              {savedReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between rounded-xl hover:bg-accent">
                  <button type="button" onClick={() => { onSelect(report); setOpen(false) }} className="flex-1 px-3 py-2.5 text-start text-sm min-h-[40px]">{report.name}</button>
                  {!report.id.startsWith("preset_") && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(report.id) }} className="px-2 text-muted-foreground hover:text-destructive">
                      <Icon name="delete" size="sm" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { ReportSection } from "./ReportSection"
import type { ReportCategory, ReportFilters } from "@/lib/reports/types"

const ICON_MAP: Record<string, string> = {
  DollarSign: "payments", BedDouble: "bed", CalendarCheck: "calendar_check", Users: "group",
  DoorOpen: "meeting_room", Share2: "hub", Megaphone: "bolt", CreditCard: "credit_card",
  XCircle: "close", Sparkles: "cleaning_services", Wrench: "construction", UserCheck: "badge",
  MessageCircle: "chat", FileText: "description", Activity: "bar_chart",
}

interface ReportCategorySectionProps {
  category: ReportCategory
  filters: ReportFilters
  showComparison: boolean
  defaultOpen?: boolean
}

export function ReportCategorySection({ category, filters, showComparison, defaultOpen = false }: ReportCategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeReportIdx, setActiveReportIdx] = useState(0)
  const iconName = ICON_MAP[category.icon] ?? "bar_chart"
  const activeReport = category.reports[activeReportIdx]

  return (
    <section className={cn("report-category-card", !isOpen && "cursor-pointer")}>
      <button type="button" onClick={() => setIsOpen((p) => !p)} className="flex w-full items-center justify-between gap-4 text-start">
        <div className="flex items-center gap-3">
          <span className="category-icon">
            <Icon name={iconName} size="md" />
          </span>
          <div>
            <h2 className="category-title">{category.label}</h2>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {category.reports.length} דוחות
          <Icon name={isOpen ? "expand_less" : "expand_more"} size="sm" />
        </span>
      </button>

      {isOpen && (
        <div className="mt-6 space-y-6">
          {category.reports.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {category.reports.map((report, idx) => (
                <button key={report.id} type="button" onClick={() => setActiveReportIdx(idx)} className={cn("report-tab", activeReportIdx === idx && "active")}>
                  {report.label}
                </button>
              ))}
            </div>
          )}
          {activeReport && <ReportSection report={activeReport} filters={filters} showComparison={showComparison} />}
        </div>
      )}
    </section>
  )
}

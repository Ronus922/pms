"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { REPORT_CATEGORIES } from "@/lib/reports/categories"
import { useReportFilters } from "@/hooks/useReportFilters"
import { useSavedReports } from "@/hooks/useSavedReports"
import { ReportsFilterBar } from "./ReportsFilterBar"
import { SavedReportsDropdown } from "./SavedReportsDropdown"
import { CreateCustomReportDialog } from "./CreateCustomReportDialog"
import { ReportCategorySection } from "./ReportCategorySection"
import type { ReportCategoryId, SavedReport } from "@/lib/reports/types"

const QUICK_REPORTS: { label: string; categoryId: ReportCategoryId }[] = [
  { label: "הכנסות", categoryId: "revenue" },
  { label: "תפוסה", categoryId: "occupancy" },
  { label: "הזמנות", categoryId: "reservations" },
  { label: "תשלומים", categoryId: "payments" },
  { label: "ביטולים", categoryId: "cancellations" },
  { label: "אורחים", categoryId: "guests" },
]

export function ReportsCenter() {
  const { filters, setDatePreset, setCustomDateRange, setCompare, setFilter, resetFilters, activeFilterCount } = useReportFilters()
  const { savedReports, saveReport, deleteReport } = useSavedReports()
  const searchParams = useSearchParams()
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategoryId, setActiveCategoryId] = useState<ReportCategoryId | null>(null)

  // Read category from URL
  useEffect(() => {
    const cat = searchParams.get("category") as ReportCategoryId | null
    if (cat && REPORT_CATEGORIES.some((c) => c.id === cat)) setActiveCategoryId(cat)
  }, [searchParams])

  const filteredCategories = useMemo(() => {
    let cats = REPORT_CATEGORIES
    if (activeCategoryId) cats = cats.filter((c) => c.id === activeCategoryId)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      cats = cats.filter((c) => c.label.includes(q) || c.description.includes(q) || c.reports.some((r) => r.label.includes(q)))
    }
    return cats
  }, [activeCategoryId, searchQuery])

  const handleSavedReportSelect = useCallback((saved: SavedReport) => { setActiveCategoryId(saved.categoryId) }, [])

  const handleCustomReportSave = useCallback((config: { name: string }) => {
    saveReport({ name: config.name, reportId: "custom", categoryId: "revenue", filters, groupBy: "month", chartType: "bar", columns: [], sort: "highest", exportFormat: "excel" })
  }, [filters, saveReport])

  const showComparison = filters.compare !== "none"

  return (
    <div className="reports-page space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl font-headline">מרכז דוחות</h1>
          <p className="text-sm text-muted-foreground">הפקת דוחות, ניתוח נתונים והשוואות תקופתיות</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SavedReportsDropdown savedReports={savedReports} onSelect={handleSavedReportSelect} onDelete={deleteReport} />
          <button type="button" onClick={() => setShowCustomDialog(true)} className="report-export-btn flex items-center gap-2">
            <Icon name="add" size="sm" />
            דוח מותאם
          </button>
        </div>
      </header>

      {/* Sticky Filters */}
      <div className="report-sticky-filters">
        <ReportsFilterBar filters={filters} activeFilterCount={activeFilterCount} onSetDatePreset={setDatePreset} onSetCustomDateRange={setCustomDateRange} onSetCompare={setCompare} onSetFilter={setFilter} onReset={resetFilters} />
      </div>

      {/* Comparison Banner */}
      {showComparison && (
        <div className="report-compare-banner">
          <Icon name="history" size="sm" className="text-primary" />
          <span className="text-sm font-medium text-primary">השוואה פעילה</span>
          <span className="text-sm text-muted-foreground">({filters.dateRange.from} — {filters.dateRange.to})</span>
        </div>
      )}

      {/* Quick Reports + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setActiveCategoryId(null)} className={cn("report-quick-pill", activeCategoryId === null && "active")}>
          הכל
        </button>
        {QUICK_REPORTS.map(({ label, categoryId }) => (
          <button key={categoryId} type="button" onClick={() => setActiveCategoryId((p) => (p === categoryId ? null : categoryId))} className={cn("report-quick-pill", activeCategoryId === categoryId && "active")}>
            {label}
          </button>
        ))}

        <div className="ms-auto" />

        <label className="relative">
          <Icon name="search" size="sm" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="חיפוש דוח..." className="min-h-[40px] w-48 rounded-xl border border-border bg-card pe-3 ps-9 text-sm md:w-64" />
        </label>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {filteredCategories.length === 0 && (
          <div className="report-empty-state">
            <Icon name="bar_chart" size="xl" className="empty-icon" />
            <p className="text-lg font-medium text-muted-foreground">לא נמצאו דוחות</p>
            <p className="mt-1 text-sm text-muted-foreground">נסה לחפש מונח אחר או להסיר פילטרים</p>
          </div>
        )}
        {filteredCategories.map((category, idx) => (
          <ReportCategorySection key={category.id} category={category} filters={filters} showComparison={showComparison} defaultOpen={idx === 0 || activeCategoryId !== null} />
        ))}
      </div>

      <CreateCustomReportDialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)} onSave={handleCustomReportSave} />
    </div>
  )
}

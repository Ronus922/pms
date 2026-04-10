"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { DATE_PRESET_LABELS, COMPARE_LABELS } from "@/hooks/useReportFilters"
import type { CompareMode, DateRangePreset, ReportFilters } from "@/lib/reports/types"

interface ReportsFilterBarProps {
  filters: ReportFilters
  activeFilterCount: number
  onSetDatePreset: (preset: DateRangePreset) => void
  onSetCustomDateRange: (from: string, to: string) => void
  onSetCompare: (mode: CompareMode) => void
  onSetFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void
  onReset: () => void
}

const DATE_PRESETS: DateRangePreset[] = [
  "today", "yesterday", "this_week", "this_month", "last_month", "last_3_months", "last_12_months", "custom",
]

const BUILDINGS = ["בניין A", "בניין B", "בניין C"]
const FLOORS = ["קומה 1", "קומה 2", "קומה 3", "קומה 4"]
const ROOM_TYPES = ["סטנדרט", "דלוקס", "סוויטה", "משפחתי", "פנטהאוז"]
const CHANNELS = ["Booking.com", "Airbnb", "ישיר", "אתר", "WhatsApp", "טלפון", "Walk-in"]
const STATUSES = ["מאושר", "ממתין", "מבוטל", "צ׳ק-אין", "צ׳ק-אאוט"]
const PAYMENT_STATUSES = ["שולם", "ממתין", "באיחור", "חלקי", "מבוטל"]
const COUNTRIES = ["ישראל", "ארה\"ב", "צרפת", "גרמניה", "בריטניה", "רוסיה"]

export function ReportsFilterBar({
  filters, activeFilterCount, onSetDatePreset, onSetCustomDateRange, onSetCompare, onSetFilter, onReset,
}: ReportsFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCustomDate, setShowCustomDate] = useState(false)

  return (
    <div className="space-y-4">
      {/* Primary Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="calendar_today" size="sm" className="text-muted-foreground" />
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                if (preset === "custom") { setShowCustomDate((p) => !p) }
                else { setShowCustomDate(false); onSetDatePreset(preset) }
              }}
              className={cn("report-filter-btn", filters.dateRange.preset === preset && "active")}
            >
              {DATE_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Compare */}
        <button
          type="button"
          onClick={() => {
            const modes: CompareMode[] = ["none", "previous_period", "same_period_last_year"]
            const idx = modes.indexOf(filters.compare)
            onSetCompare(modes[(idx + 1) % modes.length])
          }}
          className={cn("report-filter-btn flex items-center gap-2", filters.compare !== "none" && "active")}
        >
          <Icon name="history" size="sm" />
          {COMPARE_LABELS[filters.compare]}
        </button>

        <div className="h-6 w-px bg-border" />

        {/* Advanced Filters */}
        <button
          type="button"
          onClick={() => setShowAdvanced((p) => !p)}
          className={cn("report-filter-btn flex items-center gap-2", (showAdvanced || activeFilterCount > 0) && "active")}
        >
          <Icon name="layers" size="sm" />
          פילטרים
          {activeFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button type="button" onClick={onReset} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="close" size="sm" />
            איפוס
          </button>
        )}
      </div>

      {/* Custom Date */}
      {showCustomDate && (
        <div className="report-advanced-filters flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מ:</span>
            <input type="date" value={filters.dateRange.from} onChange={(e) => onSetCustomDateRange(e.target.value, filters.dateRange.to)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[40px]" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">עד:</span>
            <input type="date" value={filters.dateRange.to} onChange={(e) => onSetCustomDateRange(filters.dateRange.from, e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[40px]" />
          </label>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="report-advanced-filters space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <FilterMultiSelect label="בניין" options={BUILDINGS} selected={filters.building} onChange={(v) => onSetFilter("building", v)} />
            <FilterMultiSelect label="קומה" options={FLOORS} selected={filters.floor} onChange={(v) => onSetFilter("floor", v)} />
            <FilterMultiSelect label="סוג חדר" options={ROOM_TYPES} selected={filters.roomType} onChange={(v) => onSetFilter("roomType", v)} />
            <FilterMultiSelect label="ערוץ הזמנה" options={CHANNELS} selected={filters.bookingChannel} onChange={(v) => onSetFilter("bookingChannel", v)} />
            <FilterMultiSelect label="סטטוס הזמנה" options={STATUSES} selected={filters.reservationStatus} onChange={(v) => onSetFilter("reservationStatus", v)} />
            <FilterMultiSelect label="סטטוס תשלום" options={PAYMENT_STATUSES} selected={filters.paymentStatus} onChange={(v) => onSetFilter("paymentStatus", v)} />
            <FilterMultiSelect label="מדינה" options={COUNTRIES} selected={filters.country} onChange={(v) => onSetFilter("country", v)} />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <ToggleChip label="VIP בלבד" active={filters.vipOnly} onClick={() => onSetFilter("vipOnly", !filters.vipOnly)} />
            <ToggleChip label="אורחים חוזרים" active={filters.repeatGuestsOnly} onClick={() => onSetFilter("repeatGuestsOnly", !filters.repeatGuestsOnly)} />
            <ToggleChip label="הזמנות קבוצתיות" active={filters.groupBookingsOnly} onClick={() => onSetFilter("groupBookingsOnly", !filters.groupBookingsOnly)} />
            <ToggleChip label="כולל ביטולים" active={filters.includeCancelled} onClick={() => onSetFilter("includeCancelled", !filters.includeCancelled)} />
            <ToggleChip label="כולל No-Show" active={filters.includeNoShows} onClick={() => onSetFilter("includeNoShows", !filters.includeNoShows)} />
          </div>
        </div>
      )}
    </div>
  )
}

function FilterMultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <button type="button" onClick={() => setOpen((p) => !p)} className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
          <span className={selected.length > 0 ? "text-foreground" : "text-muted-foreground"}>{selected.length > 0 ? `${selected.length} נבחרו` : "הכל"}</span>
          <Icon name={open ? "expand_less" : "expand_more"} size="sm" className="text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute top-full z-50 mt-1 w-full rounded-2xl border border-border bg-card p-2 shadow-lg">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {options.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent min-h-[36px]">
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt])} className="size-3.5 accent-primary" />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="mt-1 w-full text-center text-xs text-primary hover:underline">נקה בחירה</button>
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((val) => (
            <span key={val} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {val}
              <button type="button" onClick={() => onChange(selected.filter((v) => v !== val))}><Icon name="close" size="sm" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]",
      active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-accent text-muted-foreground hover:bg-accent/80",
    )}>
      {label}
    </button>
  )
}

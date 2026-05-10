"use client"

import { Search, X, RotateCcw } from "lucide-react"
import { Icon } from "@/components/shared/Icon"
import {
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
  MAINTENANCE_CATEGORY_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceFilters as Filters, MaintenanceWorkerSummary } from "@/lib/types/maintenance"

interface MaintenanceFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  workers: MaintenanceWorkerSummary[]
  resultCount?: number
}

const inputClass =
  "w-full bg-accent border border-border/40 rounded-xl px-3 py-2.5 text-sm text-right focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[44px]"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`

function hasActive(filters: Filters): boolean {
  return !!(
    filters.search ||
    filters.status ||
    filters.priority ||
    filters.urgency ||
    filters.category ||
    filters.assignedTo ||
    filters.targetType ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.onlyMine ||
    filters.onlyUnassigned ||
    filters.onlyWithPhotos ||
    filters.onlyUrgent
  )
}

export function MaintenanceFiltersBar({ filters, onChange, workers, resultCount }: MaintenanceFiltersProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const clear = () => onChange({})

  return (
    <div className="space-y-3" dir="rtl">
      {/* Row 1: Main filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters.search ?? ""}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="חיפוש לפי כותרת, מספר משימה..."
            className={`${inputClass} pr-9`}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => update({ search: "" })}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Worker */}
        <select
          value={filters.assignedTo ?? ""}
          onChange={(e) => update({ assignedTo: e.target.value || undefined })}
          className={`${selectClass} max-w-[180px]`}
        >
          <option value="">כל העובדים</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.full_name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={Array.isArray(filters.status) ? "" : filters.status ?? ""}
          onChange={(e) => update({ status: e.target.value ? e.target.value as Filters["status"] : undefined })}
          className={`${selectClass} max-w-[160px]`}
        >
          <option value="">כל הסטטוסים</option>
          {Object.entries(MAINTENANCE_STATUS_MAP).map(([key, vis]) => (
            <option key={key} value={key}>{vis.label}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filters.priority ?? ""}
          onChange={(e) => update({ priority: e.target.value ? e.target.value as Filters["priority"] : undefined })}
          className={`${selectClass} max-w-[140px]`}
        >
          <option value="">כל העדיפויות</option>
          {Object.entries(MAINTENANCE_PRIORITY_MAP).map(([key, vis]) => (
            <option key={key} value={key}>{vis.label}</option>
          ))}
        </select>

        {/* Urgency */}
        <select
          value={filters.urgency ?? ""}
          onChange={(e) => update({ urgency: e.target.value ? e.target.value as Filters["urgency"] : undefined })}
          className={`${selectClass} max-w-[140px]`}
        >
          <option value="">כל הדחיפויות</option>
          {Object.entries(MAINTENANCE_URGENCY_MAP).map(([key, vis]) => (
            <option key={key} value={key}>{vis.label}</option>
          ))}
        </select>

        {/* Category */}
        <select
          value={filters.category ?? ""}
          onChange={(e) => update({ category: e.target.value ? e.target.value as Filters["category"] : undefined })}
          className={`${selectClass} max-w-[160px]`}
        >
          <option value="">כל הקטגוריות</option>
          {Object.entries(MAINTENANCE_CATEGORY_MAP).map(([key, vis]) => (
            <option key={key} value={key}>{vis.label}</option>
          ))}
        </select>

        {/* Reset */}
        {hasActive(filters) && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            <RotateCcw size={14} />
            נקה הכל
          </button>
        )}
      </div>

      {/* Row 2: Toggle pills */}
      <div className="flex flex-wrap items-center gap-2">
        <TogglePill
          label="רק שלי"
          icon="person"
          active={filters.onlyMine ?? false}
          onClick={() => update({ onlyMine: !filters.onlyMine })}
        />
        <TogglePill
          label="לא משויכות"
          icon="person_off"
          active={filters.onlyUnassigned ?? false}
          onClick={() => update({ onlyUnassigned: !filters.onlyUnassigned })}
        />
        <TogglePill
          label="עם תמונות"
          icon="photo_camera"
          active={filters.onlyWithPhotos ?? false}
          onClick={() => update({ onlyWithPhotos: !filters.onlyWithPhotos })}
        />
        <TogglePill
          label="דחופות בלבד"
          icon="priority_high"
          active={filters.onlyUrgent ?? false}
          onClick={() => update({ onlyUrgent: !filters.onlyUrgent })}
        />
        {resultCount != null && (
          <span className="text-sm text-muted-foreground ms-auto tabular-nums">
            {resultCount} תוצאות
          </span>
        )}
      </div>
    </div>
  )
}

function TogglePill({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all min-h-[36px] ${
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-accent text-muted-foreground border-border/40 hover:border-border/60"
      }`}
    >
      <Icon name={icon} size="sm" />
      {label}
    </button>
  )
}

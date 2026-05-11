"use client"

import { Icon } from "@/components/shared/Icon"
import { SUPPLIER_STATUS_MAP } from "@/lib/constants/suppliers"
import type { SupplierStatus, SupplierFilters as SupplierFiltersType } from "@/lib/types/suppliers"

/* ── Props ─────────────────────────────────────────────────── */

interface SupplierFiltersProps {
  filters: SupplierFiltersType
  onSearchChange: (search: string) => void
  onStatusChange: (status: SupplierStatus | "all") => void
}

/* ── Status Options ───────────────────────────────────────── */

const STATUS_OPTIONS: { value: SupplierStatus | "all"; label: string }[] = [
  { value: "all", label: "הכל" },
  ...Object.entries(SUPPLIER_STATUS_MAP).map(([value, cfg]) => ({
    value: value as SupplierStatus | "all",
    label: cfg.label,
  })),
]

/* ── Component ─────────────────────────────────────────────── */

export function SupplierFilters({
  filters,
  onSearchChange,
  onStatusChange,
}: SupplierFiltersProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-lg">
        <Icon
          name="search"
          size="sm"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={filters.search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-accent border border-border/40 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          placeholder="חיפוש לפי שם, חברה, טלפון או אימייל..."
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`pill-filter ${(filters.status ?? "all") === opt.value ? "pill-filter-active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

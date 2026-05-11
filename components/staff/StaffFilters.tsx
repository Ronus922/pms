"use client"

import { Icon } from "@/components/shared/Icon"
import { ROLES, type Role } from "@/lib/permissions/constants"
import { useStaffStore } from "@/lib/stores/staff-store"

/* ── Status Options ────────────────────────────────────────── */

const STATUS_OPTIONS: { value: "all" | "active" | "inactive"; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "active", label: "פעיל" },
  { value: "inactive", label: "מושבת" },
]

/* ── Component ─────────────────────────────────────────────── */

export function StaffFilters() {
  const { filters, setSearch, setRoleFilter, setStatusFilter } = useStaffStore()

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-lg">
        <Icon
          name="search"
          size="sm"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-accent border border-border/40 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          placeholder="חיפוש לפי שם, אימייל או טלפון..."
        />
      </div>

      {/* Filter Pills — Azure Ethos Subtle Card */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#474747]">תפקיד:</span>
          <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
            <button
              onClick={() => setRoleFilter("all")}
              aria-pressed={filters.role === "all"}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                filters.role === "all"
                  ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                  : "text-[#474747] hover:text-[#1e40af] font-medium"
              }`}
            >
              הכל
            </button>
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRoleFilter(r.value)}
                aria-pressed={filters.role === r.value}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  filters.role === r.value
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#474747] hover:text-[#1e40af] font-medium"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <span className="text-[#dad9e3] max-sm:hidden">|</span>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#474747]">סטטוס:</span>
          <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                aria-pressed={filters.status === opt.value}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  filters.status === opt.value
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#474747] hover:text-[#1e40af] font-medium"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

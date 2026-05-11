"use client"

import { Icon } from "@/components/shared/Icon"
import { getRoleLabel, ROLE_STYLES } from "@/lib/permissions/constants"
import type { EmployeeWithStats } from "@/lib/types/staff"

/* ── Props ─────────────────────────────────────────────────── */

interface EmployeeCardProps {
  employee: EmployeeWithStats
  onClick: () => void
}

/* ── Component ─────────────────────────────────────────────── */

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  const style = ROLE_STYLES[employee.role]

  function getInitials(name: string): string {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].charAt(0)
    return parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  }

  function formatLastLogin(dateStr: string | null): string {
    if (!dateStr) return "לא התחבר"
    const d = new Date(dateStr)
    return d.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-right bg-card rounded-[20px] shadow-sm border border-border/20 border-r-4 ${style?.border || "border-gray-300"} p-5 hover:shadow-md transition-all cursor-pointer group`}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
          {getInitials(employee.full_name)}
        </div>

        {/* Name + Contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground truncate">
              {employee.full_name}
            </p>
            {employee.job_title && (
              <span className="text-[10px] text-muted-foreground truncate max-sm:hidden">
                · {employee.job_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {employee.email && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1" dir="ltr">
                <Icon name="email" size="sm" className="text-muted-foreground/60" />
                {employee.email}
              </span>
            )}
            {employee.phone && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 max-sm:hidden" dir="ltr">
                <Icon name="phone" size="sm" className="text-muted-foreground/60" />
                {employee.phone}
              </span>
            )}
          </div>
        </div>

        {/* Task Badge (cleaners only) */}
        {employee.role === "cleaner" && employee.active_tasks_count > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold leading-none tabular-nums shrink-0 max-sm:hidden">
            {employee.active_tasks_count}
          </span>
        )}

        {/* Role Badge */}
        <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${style?.badge || "bg-slate-100 text-slate-600"}`}>
          {getRoleLabel(employee.role)}
        </span>

        {/* Status + Last Login */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground max-sm:hidden">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              employee.is_active ? "bg-emerald-500" : "bg-gray-300"
            }`}
          />
          <span>{employee.is_active ? "פעיל" : "מושבת"}</span>
          <span className="text-border">|</span>
          <span>{formatLastLogin(employee.last_login)}</span>
        </div>

        {/* Chevron */}
        <Icon
          name="chevron_left"
          size="sm"
          className="text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
        />
      </div>
    </button>
  )
}

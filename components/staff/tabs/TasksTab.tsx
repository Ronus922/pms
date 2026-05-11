"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { getEmployeeTaskSummary } from "@/lib/actions/staff"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { EmployeeTaskSummary } from "@/lib/types/staff"
import type { Role } from "@/lib/permissions/constants"

/* ── Props ─────────────────────────────────────────────────── */

interface TasksTabProps {
  employeeId: string
  employeeRole: Role
}

/* ── Component ─────────────────────────────────────────────── */

export function TasksTab({ employeeId, employeeRole }: TasksTabProps) {
  const { tenantId } = useTenant()
  const [summary, setSummary] = useState<EmployeeTaskSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const isCleaningRole = employeeRole === "cleaner"

  useEffect(() => {
    if (!isCleaningRole) {
      setLoading(false)
      return
    }
    setLoading(true)
    getEmployeeTaskSummary(employeeId, tenantId).then((data) => {
      setSummary(data)
      setLoading(false)
    })
  }, [employeeId, tenantId, isCleaningRole])

  if (!isCleaningRole) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="assignment" size="xl" className="opacity-30" />
        <p className="text-lg font-medium">אין משימות</p>
        <p className="text-sm">משימות ניקיון רלוונטיות רק לעובדי ניקיון ומשק בית</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
        <p className="text-sm font-medium">טוען סיכום משימות...</p>
      </div>
    )
  }

  if (!summary) return null

  const stats = [
    { label: "היום", value: summary.today, icon: "today", color: "text-primary" },
    { label: "השבוע", value: summary.this_week, icon: "date_range", color: "text-indigo-600" },
    { label: "החודש", value: summary.this_month, icon: "calendar_month", color: "text-violet-600" },
    { label: "ממתינות", value: summary.pending, icon: "pending_actions", color: "text-amber-600" },
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-foreground">סיכום משימות ניקיון</h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <Icon name={stat.icon} size="md" className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground font-bold">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

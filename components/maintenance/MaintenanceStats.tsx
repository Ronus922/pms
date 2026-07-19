"use client"

import { Icon } from "@/components/shared/Icon"
import type { MaintenanceStats as Stats, MaintenanceFilters } from "@/lib/types/maintenance"

interface MaintenanceStatsProps {
  stats: Stats
  onFilter: (filters: Partial<MaintenanceFilters>) => void
}

interface KpiDef {
  key: keyof Stats
  label: string
  icon: string
  iconBg: string
  iconColor: string
  filterPatch: Partial<MaintenanceFilters>
}

const KPI_DEFS: KpiDef[] = [
  {
    key: "open",
    label: "פתוחות",
    icon: "inbox",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    filterPatch: { status: "open" },
  },
  {
    key: "unassigned",
    label: "לא משויכות",
    icon: "person_off",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-800 dark:text-amber-300",
    filterPatch: { onlyUnassigned: true },
  },
  {
    key: "urgent",
    label: "דחופות",
    icon: "warning",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    filterPatch: { onlyUrgent: true },
  },
  {
    key: "inProgress",
    label: "בטיפול",
    icon: "build",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    filterPatch: { status: "in_progress" },
  },
  {
    key: "waitingParts",
    label: "ממתינות",
    icon: "schedule",
    iconBg: "bg-accent",
    iconColor: "text-violet-600 dark:text-violet-400",
    filterPatch: { status: ["waiting_parts", "waiting_external_vendor"] },
  },
  {
    key: "completedToday",
    label: "הושלמו היום",
    icon: "task_alt",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-700 dark:text-emerald-400",
    filterPatch: { status: "resolved" },
  },
]

export function MaintenanceStatsBar({ stats, onFilter }: MaintenanceStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {KPI_DEFS.map((kpi) => {
        const value = stats[kpi.key]
        return (
          <button
            key={kpi.key}
            type="button"
            onClick={() => onFilter(kpi.filterPatch)}
            className="flex items-start justify-between gap-3 bg-white border border-border rounded-xl p-5 min-h-[120px] text-right transition-all hover:border-primary hover:shadow-sm active:scale-[0.98]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="text-sm font-medium text-muted-foreground">{kpi.label}</div>
              <div className="text-[2rem] font-bold tabular-nums text-foreground leading-tight">{value}</div>
            </div>
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${kpi.iconBg} ${kpi.iconColor}`}>
              <Icon name={kpi.icon} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

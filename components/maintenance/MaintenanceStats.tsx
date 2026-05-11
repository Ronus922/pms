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
    iconBg: "bg-[#eff6ff]",
    iconColor: "text-[#1e40af]",
    filterPatch: { status: "open" },
  },
  {
    key: "unassigned",
    label: "לא משויכות",
    icon: "person_off",
    iconBg: "bg-[#fef3c7]",
    iconColor: "text-[#854d0e]",
    filterPatch: { onlyUnassigned: true },
  },
  {
    key: "urgent",
    label: "דחופות",
    icon: "warning",
    iconBg: "bg-[#fee2e2]",
    iconColor: "text-[#b91c1c]",
    filterPatch: { onlyUrgent: true },
  },
  {
    key: "inProgress",
    label: "בטיפול",
    icon: "build",
    iconBg: "bg-[#dbeafe]",
    iconColor: "text-[#1e40af]",
    filterPatch: { status: "in_progress" },
  },
  {
    key: "waitingParts",
    label: "ממתינות",
    icon: "schedule",
    iconBg: "bg-[#f4f2fc]",
    iconColor: "text-[#7c3aed]",
    filterPatch: { status: ["waiting_parts", "waiting_external_vendor"] },
  },
  {
    key: "completedToday",
    label: "הושלמו היום",
    icon: "task_alt",
    iconBg: "bg-[#dcfce7]",
    iconColor: "text-[#15803d]",
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
            className="flex items-start justify-between gap-3 bg-white border border-[#dad9e3] rounded-xl p-5 min-h-[120px] text-right transition-all hover:border-[#1e40af] hover:shadow-sm active:scale-[0.98]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="text-sm font-medium text-[#474747]">{kpi.label}</div>
              <div className="text-[2rem] font-bold tabular-nums text-[#1c1b1f] leading-tight">{value}</div>
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

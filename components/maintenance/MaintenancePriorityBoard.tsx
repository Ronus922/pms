"use client"

import { Icon } from "@/components/shared/Icon"
import { MaintenanceTaskCard } from "./MaintenanceTaskCard"
import {
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceTask } from "@/lib/types/maintenance"

interface MaintenancePriorityBoardProps {
  tasks: MaintenanceTask[]
  onTaskClick: (task: MaintenanceTask) => void
}

interface Column {
  key: string
  title: string
  icon: string
  bg: string
  text: string
  border: string
  filter: (t: MaintenanceTask) => boolean
}

const COLUMNS: Column[] = [
  {
    key: "immediate",
    title: "דחוף מיידי",
    icon: "local_fire_department",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    filter: (t) => t.urgency_level === "immediate" && t.status !== "resolved" && t.status !== "cancelled",
  },
  {
    key: "urgent",
    title: "דחוף",
    icon: "warning",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    filter: (t) => t.urgency_level === "urgent" && t.status !== "resolved" && t.status !== "cancelled",
  },
  {
    key: "normal",
    title: "רגיל",
    icon: "schedule",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    filter: (t) => t.urgency_level === "normal" && t.status !== "resolved" && t.status !== "cancelled",
  },
  {
    key: "done_today",
    title: "בוצע היום",
    icon: "check_circle",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    filter: (t) => {
      if (t.status !== "resolved") return false
      if (!t.completed_at) return false
      const today = new Date().toISOString().slice(0, 10)
      return t.completed_at.slice(0, 10) === today
    },
  },
]

export function MaintenancePriorityBoard({ tasks, onTaskClick }: MaintenancePriorityBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" dir="rtl">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter(col.filter).sort((a, b) => {
          // Sort by priority within each column
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          const pA = priorityOrder[a.priority] ?? 9
          const pB = priorityOrder[b.priority] ?? 9
          if (pA !== pB) return pA - pB
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        return (
          <div key={col.key} className="flex-shrink-0 w-[300px]">
            {/* Column header */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-t-[16px] border ${col.border} ${col.bg}`}>
              <Icon name={col.icon} size="sm" className={col.text} />
              <span className={`text-sm font-bold ${col.text}`}>{col.title}</span>
              <span className={`ms-auto px-2 py-0.5 text-[11px] font-bold rounded-full ${col.bg} ${col.text} border ${col.border}`}>
                {colTasks.length}
              </span>
            </div>

            {/* Column body */}
            <div className={`border border-t-0 ${col.border} rounded-b-[16px] bg-accent/30 p-2 space-y-2 min-h-[200px]`}>
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1">
                  <Icon name={col.icon} size="md" className="opacity-20" />
                  <p className="text-[11px]">אין תקלות</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <MaintenanceTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

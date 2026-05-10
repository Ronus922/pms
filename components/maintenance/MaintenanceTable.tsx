"use client"

import { Icon } from "@/components/shared/Icon"
import {
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_CATEGORY_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceTask } from "@/lib/types/maintenance"

interface MaintenanceTableProps {
  tasks: MaintenanceTask[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onTaskClick: (task: MaintenanceTask) => void
  loading?: boolean
}

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmtTime(v: string | null): string {
  if (!v) return ""
  const d = new Date(v)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function MaintenanceTable({
  tasks,
  total,
  page,
  pageSize,
  onPageChange,
  onTaskClick,
  loading,
}: MaintenanceTableProps) {
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden" dir="rtl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#e1e7fa]">
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 w-[60px]">#</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">כותרת</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">יעד</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">קטגוריה</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">עובד</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תאריך</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">דחיפות</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">סטטוס</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-lg:hidden">עודכן</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10 animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-accent rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : tasks.map((task, idx) => {
                  const statusVis = MAINTENANCE_STATUS_MAP[task.status]
                  const priorityVis = MAINTENANCE_PRIORITY_MAP[task.priority]
                  const categoryVis = MAINTENANCE_CATEGORY_MAP[task.issue_category]
                  const isEven = idx % 2 === 1

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${isEven ? "bg-accent/40" : ""}`}
                    >
                      {/* # */}
                      <td className="px-5 py-4 font-bold text-primary tabular-nums">#{task.task_number}</td>

                      {/* Title */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon name={categoryVis.icon} size="sm" className="text-primary" />
                          </div>
                          <span className="font-bold text-foreground">{task.title}</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="px-5 py-4 text-foreground">
                        {task.room_number ? `חדר ${task.room_number}` : task.target_label || "—"}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                          {categoryVis.label}
                        </span>
                      </td>

                      {/* Worker */}
                      <td className="px-5 py-4 text-foreground">{task.assigned_to_name ?? "—"}</td>

                      {/* Date */}
                      <td className="px-5 py-4 text-foreground tabular-nums">{fmtDate(task.scheduled_date)}</td>

                      {/* Priority */}
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${priorityVis.bg} ${priorityVis.text}`}>
                          {priorityVis.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${statusVis.text}`}>{statusVis.label}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${statusVis.bg.includes("emerald") ? "bg-emerald-500" : statusVis.bg.includes("amber") ? "bg-amber-500" : statusVis.bg.includes("blue") ? "bg-blue-500" : statusVis.bg.includes("indigo") ? "bg-indigo-500" : statusVis.bg.includes("red") ? "bg-red-500" : statusVis.bg.includes("orange") ? "bg-orange-500" : statusVis.bg.includes("purple") ? "bg-purple-500" : "bg-slate-400"}`} />
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="px-5 py-4 text-muted-foreground tabular-nums text-[12px] max-lg:hidden">
                        {fmtDate(task.updated_at)} {fmtTime(task.updated_at)}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/15 bg-accent/30">
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {total} תוצאות &middot; עמוד {page} מתוך {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 min-h-[44px]"
            >
              <Icon name="chevron_right" size="sm" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 min-h-[44px]"
            >
              <Icon name="chevron_left" size="sm" />
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="construction" size="xl" className="opacity-20" />
          <p className="text-sm font-medium">אין תקלות</p>
        </div>
      )}
    </div>
  )
}

"use client"

import { Icon } from "@/components/shared/Icon"
import { MAINTENANCE_CATEGORY_MAP } from "@/lib/constants/maintenance"
import type { MaintenanceTask, MaintenanceBoard } from "@/lib/types/maintenance"

interface MaintenanceDailyViewProps {
  board: MaintenanceBoard
  onTaskClick: (task: MaintenanceTask) => void
}

interface TaskGroupProps {
  title: string
  subtitle: string
  tasks: MaintenanceTask[]
  onTaskClick: (task: MaintenanceTask) => void
  avatar?: "person" | "alert"
}

function TaskGroup({ title, subtitle, tasks, onTaskClick, avatar = "person" }: TaskGroupProps) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Group header */}
      <div className="bg-primary/10 px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="text-right">
          <h3 className="text-base font-extrabold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground shrink-0">
          <Icon name={avatar === "alert" ? "priority_high" : "person"} size="md" />
        </div>
      </div>

      {/* Task rows */}
      <div>
        {tasks.map((task, idx) => {
          const categoryVis = MAINTENANCE_CATEGORY_MAP[task.issue_category]
          const subParts = [
            categoryVis?.label,
            task.room_number ? `חדר ${task.room_number}` : task.target_label,
          ].filter(Boolean)

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick(task)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-card border-b border-accent last:border-0 hover:bg-accent/50 cursor-pointer transition-colors text-right"
            >
              {/* Right: title + subtitle */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-foreground truncate">{task.title}</div>
                <div className="text-[13px] text-muted-foreground truncate mt-0.5">
                  {subParts.join(" • ")}
                </div>
              </div>

              {/* Left: room number + ID circle */}
              <div className="flex items-center gap-3 shrink-0 mr-3">
                {task.room_number && (
                  <span className="text-[15px] font-extrabold text-foreground tabular-nums" dir="ltr">
                    {task.room_number}
                  </span>
                )}
                <div className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-sm font-bold text-foreground tabular-nums">
                  {idx + 1}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MaintenanceDailyView({ board, onTaskClick }: MaintenanceDailyViewProps) {
  const hasAny =
    board.workers.some((w) => (board.byWorker[w.id] ?? []).length > 0) ||
    board.unassigned.length > 0

  return (
    <div className="space-y-5" dir="rtl">
      {/* Per-worker groups */}
      {board.workers.map((worker) => {
        const tasks = board.byWorker[worker.id] ?? []
        if (tasks.length === 0) return null

        const urgentCount = tasks.filter((t) => t.urgency_level !== "normal").length
        const subtitle = urgentCount > 0
          ? `${tasks.length} משימות • ${urgentCount} דחוף`
          : `${tasks.length} משימות`

        return (
          <TaskGroup
            key={worker.id}
            title={worker.full_name}
            subtitle={subtitle}
            tasks={tasks}
            onTaskClick={onTaskClick}
          />
        )
      })}

      {/* Unassigned group */}
      {board.unassigned.length > 0 && (
        <TaskGroup
          title="לא משויך"
          subtitle={`${board.unassigned.length} משימות`}
          tasks={board.unassigned}
          onTaskClick={onTaskClick}
          avatar="alert"
        />
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="event_available" size="xl" className="opacity-20" />
          <p className="text-sm font-medium">אין משימות ליום זה</p>
        </div>
      )}
    </div>
  )
}

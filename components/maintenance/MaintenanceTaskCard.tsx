"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Icon } from "@/components/shared/Icon"
import {
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
  MAINTENANCE_CATEGORY_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceTask } from "@/lib/types/maintenance"

interface MaintenanceTaskCardProps {
  task: MaintenanceTask
  onClick: () => void
  isUnassigned?: boolean
  orderIndex?: number
}

export function MaintenanceTaskCard({ task, onClick, isUnassigned, orderIndex }: MaintenanceTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const statusVis = MAINTENANCE_STATUS_MAP[task.status]
  const priorityVis = MAINTENANCE_PRIORITY_MAP[task.priority]
  const urgencyVis = MAINTENANCE_URGENCY_MAP[task.urgency_level]
  const categoryVis = MAINTENANCE_CATEGORY_MAP[task.issue_category]

  const isUrgent = task.urgency_level !== "normal"
  const isCritical = task.priority === "critical"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) onClick()
        e.stopPropagation()
      }}
      className={`relative bg-card rounded-[14px] p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 transition-all select-none ${
        isUnassigned
          ? "border-amber-300 dark:border-amber-800"
          : isCritical
            ? "border-red-300 dark:border-red-800"
            : isUrgent
              ? "border-orange-300 dark:border-orange-800"
              : "border-border"
      }`}
    >
      {/* Keyboard escape hatch: Enter on the card starts a drag (dnd-kit preventDefaults it),
          so keyboard users open the detail panel through this focusable-only button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="sr-only focus:not-sr-only focus:absolute focus:top-1 focus:start-1 focus:z-10 focus:bg-card focus:border focus:border-primary focus:rounded-lg focus:px-2 focus:py-1 focus:text-xs focus:font-bold focus:text-primary"
      >
        פתח פרטים
      </button>
      {/* Top row: order + category icon + title */}
      <div className="flex items-start gap-2 mb-2">
        {orderIndex != null && (
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-extrabold text-[11px] tabular-nums shrink-0">
            {orderIndex}
          </div>
        )}
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <Icon name={categoryVis.icon} size="sm" className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-foreground truncate">{task.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            #{task.task_number} &middot; {categoryVis.label}
          </div>
        </div>
        {task.is_recurring && (
          <div className="flex items-center text-[11px] text-primary shrink-0" title="משימה חוזרת">
            <Icon name="repeat" size="sm" />
          </div>
        )}
        {(task.media_count ?? 0) > 0 && (
          <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0">
            <Icon name="photo_camera" size="sm" />
            <span>{task.media_count}</span>
          </div>
        )}
      </div>

      {/* Target / Room */}
      {(task.room_number || task.target_label) && (
        <div className="flex items-center gap-1.5 mb-2 text-[12px] text-muted-foreground">
          <Icon name="location_on" size="sm" className="opacity-50" />
          <span className="truncate">
            {task.room_number ? `חדר ${task.room_number}` : task.target_label}
          </span>
          {task.room_status_context && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              task.room_status_context === "occupied"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {task.room_status_context === "occupied" ? "תפוס" : "פנוי"}
            </span>
          )}
        </div>
      )}

      {/* Scheduled time */}
      {task.scheduled_time_from && (
        <div className="flex items-center gap-1.5 mb-2 text-[12px] text-muted-foreground">
          <Icon name="schedule" size="sm" className="opacity-50" />
          <span dir="ltr" className="tabular-nums">
            {task.scheduled_time_from?.slice(0, 5)}
            {task.scheduled_time_to && ` - ${task.scheduled_time_to.slice(0, 5)}`}
          </span>
        </div>
      )}

      {/* Access note indicator */}
      {task.access_notes && (
        <div className="flex items-center gap-1 mb-2 text-[11px] text-amber-600 dark:text-amber-400">
          <Icon name="key" size="sm" />
          <span className="truncate">{task.access_notes}</span>
        </div>
      )}

      {/* Created by */}
      {task.reported_by_name && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
          <Icon name="person" size="sm" className="opacity-50" />
          <span>נוצר ע״י: {task.reported_by_name}</span>
        </div>
      )}

      {/* Bottom row: status + priority + urgency badges */}
      <div className="flex items-center flex-wrap gap-1.5">
        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${statusVis.bg} ${statusVis.text} ${statusVis.border}`}>
          {statusVis.label}
        </span>
        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${priorityVis.bg} ${priorityVis.text} ${priorityVis.border}`}>
          {priorityVis.label}
        </span>
        {task.urgency_level !== "normal" && (
          <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${urgencyVis.bg} ${urgencyVis.text} ${urgencyVis.border}`}>
            {urgencyVis.label}
          </span>
        )}
        {isUnassigned && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 ms-auto">
            <Icon name="warning" size="sm" />
            לא משויך
          </span>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getMyMaintenanceTasks, changeMaintenanceStatus } from "@/lib/actions/maintenance"
import {
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
  MAINTENANCE_CATEGORY_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceTask, MaintenanceStatus } from "@/lib/types/maintenance"
import { toast } from "sonner"

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function todayLabel(): string {
  const d = new Date()
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]
  return `יום ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function MaintenanceWorkerView() {
  const { tenantId, userId } = useTenant()
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const userName = "" // Will be filled from tenant context

  const reload = useCallback(async () => {
    const data = await getMyMaintenanceTasks(tenantId, userId)
    setTasks(data)
    setLoading(false)
  }, [tenantId, userId])

  useEffect(() => {
    reload()
    const interval = setInterval(reload, 5000)
    return () => clearInterval(interval)
  }, [reload])

  const handleStatus = async (taskId: string, newStatus: MaintenanceStatus) => {
    setBusyId(taskId)
    const result = await changeMaintenanceStatus(tenantId, taskId, newStatus, userId, userName)
    setBusyId(null)
    if (result.success) {
      toast.success(MAINTENANCE_STATUS_MAP[newStatus].label)
      await reload()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== "resolved")
  const completedTasks = tasks.filter((t) => t.status === "resolved")

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1e40af] text-white px-3 py-2.5 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold">המשימות שלי</h1>
            <p className="text-[11px] text-white opacity-85">{todayLabel()}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="construction" size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">
              {activeTasks.length}
            </span>
            פעילות
          </span>
          <span className="flex items-center gap-1 text-white/70">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold">
              {completedTasks.length}
            </span>
            הושלמו
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Active tasks */}
      {!loading && (
        <div className="px-4 py-4 space-y-3">
          {activeTasks.length === 0 && completedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Icon name="check_circle" size="xl" className="opacity-20" />
              <p className="text-base font-bold">אין משימות</p>
              <p className="text-sm">כל המשימות הושלמו</p>
            </div>
          )}

          {activeTasks.map((task, idx) => (
            <WorkerTaskCard
              key={task.id}
              task={task}
              index={idx + 1}
              total={activeTasks.length}
              busy={busyId === task.id}
              expanded={expandedId === task.id}
              onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
              onStatusChange={handleStatus}
            />
          ))}

          {/* Completed section */}
          {completedTasks.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[12px] text-muted-foreground font-bold px-2">
                  הושלמו ({completedTasks.length})
                </span>
                <div className="flex-1 h-px bg-border/30" />
              </div>
              {completedTasks.map((task) => (
                <WorkerTaskCard
                  key={task.id}
                  task={task}
                  index={0}
                  total={0}
                  busy={busyId === task.id}
                  expanded={expandedId === task.id}
                  onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
                  onStatusChange={handleStatus}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface WorkerTaskCardProps {
  task: MaintenanceTask
  index: number
  total: number
  busy: boolean
  expanded: boolean
  onToggle: () => void
  onStatusChange: (taskId: string, status: MaintenanceStatus) => void
}

function WorkerTaskCard({ task, index, total, busy, expanded, onToggle, onStatusChange }: WorkerTaskCardProps) {
  const isResolved = task.status === "resolved"
  const isInProgress = task.status === "in_progress"
  const isWaiting = task.status === "waiting_parts" || task.status === "waiting_external_vendor"

  const statusVis = MAINTENANCE_STATUS_MAP[task.status]
  const priorityVis = MAINTENANCE_PRIORITY_MAP[task.priority]
  const urgencyVis = MAINTENANCE_URGENCY_MAP[task.urgency_level]
  const categoryVis = MAINTENANCE_CATEGORY_MAP[task.issue_category]

  const borderColor = isResolved
    ? "border-emerald-500"
    : isInProgress
      ? "border-blue-500"
      : isWaiting
        ? "border-purple-500"
        : task.priority === "critical"
          ? "border-red-500"
          : "border-amber-500"

  return (
    <div className={`bg-card rounded-[22px] shadow-sm border-r-4 transition-all ${borderColor} ${isResolved ? "opacity-70" : ""}`}>
      {/* Main area — always visible */}
      <div className="p-5" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {!isResolved && index > 0 && (
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-lg tabular-nums">
                {index}
              </div>
            )}
            <div>
              <div className="text-[11px] text-muted-foreground">#{task.task_number} &middot; {categoryVis.label}</div>
              <div className="text-base font-extrabold text-foreground">{task.title}</div>
            </div>
          </div>
          {!isResolved && index > 0 && (
            <div className="text-[12px] text-muted-foreground tabular-nums">{index}/{total}</div>
          )}
        </div>

        {/* Target */}
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <Icon name="location_on" size="sm" />
          <span>{task.room_number ? `חדר ${task.room_number}` : task.target_label}</span>
        </div>

        {/* Badges */}
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
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
          {task.scheduled_time_from && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground ms-auto tabular-nums" dir="ltr">
              <Icon name="schedule" size="sm" className="opacity-50" />
              {task.scheduled_time_from.slice(0, 5)}
            </span>
          )}
        </div>

        {/* Access note */}
        {task.access_notes && (
          <div className="flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/10 rounded-lg px-3 py-2">
            <Icon name="key" size="sm" />
            {task.access_notes}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-3 border-t border-border/15 pt-3">
          {task.description && (
            <div className="mb-3">
              <div className="text-[11px] text-muted-foreground mb-1">תיאור</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          {task.room_status_context && (
            <div className="text-[12px] text-muted-foreground mb-1">
              מצב חדר: {task.room_status_context === "occupied" ? "תפוס" : "פנוי"}
            </div>
          )}
          {task.requires_guest_coordination && (
            <div className="text-[12px] text-amber-600 font-bold mb-1">דורש תיאום עם אורח</div>
          )}
        </div>
      )}

      {/* Action buttons — always visible for non-resolved */}
      {!isResolved && (
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          {(task.status === "open" || task.status === "assigned") && (
            <ActionButton
              label="התחל טיפול"
              icon="play_arrow"
              color="bg-blue-600 text-white"
              busy={busy}
              onClick={() => onStatusChange(task.id, "in_progress")}
            />
          )}
          {isInProgress && (
            <>
              <ActionButton
                label="ממתין לחלקים"
                icon="inventory_2"
                color="bg-orange-500 text-white"
                busy={busy}
                onClick={() => onStatusChange(task.id, "waiting_parts")}
              />
              <ActionButton
                label="ממתין לספק"
                icon="local_shipping"
                color="bg-purple-500 text-white"
                busy={busy}
                onClick={() => onStatusChange(task.id, "waiting_external_vendor")}
              />
              <ActionButton
                label="הושלם"
                icon="check_circle"
                color="bg-emerald-600 text-white"
                busy={busy}
                onClick={() => onStatusChange(task.id, "resolved")}
              />
            </>
          )}
          {isWaiting && (
            <>
              <ActionButton
                label="חזרה לטיפול"
                icon="replay"
                color="bg-blue-600 text-white"
                busy={busy}
                onClick={() => onStatusChange(task.id, "in_progress")}
              />
              <ActionButton
                label="הושלם"
                icon="check_circle"
                color="bg-emerald-600 text-white"
                busy={busy}
                onClick={() => onStatusChange(task.id, "resolved")}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label,
  icon,
  color,
  busy,
  onClick,
}: {
  label: string
  icon: string
  color: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all min-h-[48px] ${color} ${
        busy ? "opacity-50" : "active:scale-95"
      }`}
    >
      {busy ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon name={icon} size="sm" />
      )}
      {label}
    </button>
  )
}

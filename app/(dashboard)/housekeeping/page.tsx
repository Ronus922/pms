"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import {
  getCleaningBoard,
  reorderCleaningTasks,
  setCleaningTaskStatus,
  assignCleaner,
  deleteCleaningTask,
  updateCleaningTaskNotes,
} from "@/lib/actions/cleaning"
import type {
  CleaningTask,
  CleaningBoard,
  CleaningStatus,
} from "@/lib/types/cleaning"
import { SidePanel } from "@/components/shared/SidePanel"
import { CreateCleaningTaskPanel } from "@/components/housekeeping/CreateCleaningTaskPanel"

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(v: string): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmtTime(t: string | null): string {
  if (!t) return "—"
  return t.slice(0, 5)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_VISUAL: Record<CleaningStatus, { label: string; bg: string; text: string; border: string }> = {
  pending:     { label: "ממתין",    bg: "bg-amber-50 dark:bg-amber-950/20",     text: "text-amber-700 dark:text-amber-400",    border: "border-amber-200" },
  in_progress: { label: "בעבודה",   bg: "bg-blue-50 dark:bg-blue-950/20",       text: "text-blue-700 dark:text-blue-400",      border: "border-blue-200" },
  done:        { label: "הושלם",    bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200" },
  skipped:     { label: "דולג",     bg: "bg-slate-100 dark:bg-slate-900/40",    text: "text-slate-600 dark:text-slate-400",    border: "border-slate-200" },
}

/** Natural sort: earliest checkout date → time → room number */
function compareBySort(a: CleaningTask, b: CleaningTask): number {
  const ad = a.checkout_date || "9999-12-31"
  const bd = b.checkout_date || "9999-12-31"
  if (ad !== bd) return ad.localeCompare(bd)
  const at = a.checkout_time || "99:99:99"
  const bt = b.checkout_time || "99:99:99"
  if (at !== bt) return at.localeCompare(bt)
  return (a.room_number ?? a.target_label ?? "").localeCompare(b.room_number ?? b.target_label ?? "", undefined, { numeric: true })
}

/** Classify a task for priority badge color */
type Urgency = "past" | "today" | "tomorrow" | "future" | "in_progress"
function urgency(task: CleaningTask): Urgency {
  if (task.status === "in_progress") return "in_progress"
  const today = todayStr()
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const tomorrow = d.toISOString().slice(0, 10)
  if (task.checkout_date < today) return "past"
  if (task.checkout_date === today) return "today"
  if (task.checkout_date === tomorrow) return "tomorrow"
  return "future"
}

const URGENCY_VISUAL: Record<Urgency, { label: string; dot: string }> = {
  past:        { label: "דחוף",       dot: "bg-red-500" },
  today:       { label: "יציאה היום", dot: "bg-amber-500" },
  tomorrow:    { label: "מחר",        dot: "bg-blue-500" },
  future:      { label: "עתידי",      dot: "bg-slate-400" },
  in_progress: { label: "בעבודה",     dot: "bg-emerald-500" },
}

/* ── Sortable Task Card ─────────────────────────────────── */

interface TaskCardProps {
  task: CleaningTask
  onClick: () => void
  isUnassigned?: boolean
}

function SortableTaskCard({ task, onClick, isUnassigned }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const statusVisual = STATUS_VISUAL[task.status]
  const urg = urgency(task)
  const urgVisual = URGENCY_VISUAL[urg]

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
      className={`bg-card rounded-[14px] p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[#1e40af]/40 transition-all select-none ${
        isUnassigned
          ? "border-amber-300 dark:border-amber-800"
          : "border-[#dad9e3]"
      }`}
    >
      {/* Priority dot + room number + checkout time */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${urgVisual.dot}`}
          title={urgVisual.label}
        />
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm tabular-nums shrink-0 ${
          task.target_type === "area" ? "bg-violet-500/10 text-violet-600" : "bg-primary/10 text-primary"
        }`}>
          {task.target_type === "area" ? "🏢" : task.room_number}
        </div>
        <div className="flex-1 min-w-0">
          {task.target_type === "area" ? (
            <div className="text-xs font-bold text-violet-600 truncate">{task.target_label}</div>
          ) : task.guest_name ? (
            <div className="text-xs font-bold text-foreground truncate">{task.guest_name}</div>
          ) : task.source_trigger === "manager_manual" ? (
            <div className="text-xs font-bold text-foreground truncate">
              הוקצא ע&quot;י: {task.creator_name ?? "—"}
            </div>
          ) : null}
          {task.target_type === "room" && task.checkin_date && (
            <div className="text-[12px] text-muted-foreground tabular-nums">
              {fmtDate(task.checkin_date)} → {fmtDate(task.checkout_date)}
            </div>
          )}
          {task.target_type === "room" && !task.checkin_date && (
            <div className="text-[12px] text-muted-foreground tabular-nums">
              {fmtDate(task.checkout_date)}
            </div>
          )}
          {task.target_type === "area" && (
            <div className="text-[12px] text-muted-foreground">{fmtDate(task.checkout_date)}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px] text-muted-foreground">יציאה</div>
          <div className="text-sm font-extrabold text-primary tabular-nums" dir="ltr">
            {fmtTime(task.checkout_time)}
          </div>
        </div>
      </div>

      {/* Bottom row: status pill + unassigned badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`px-2 py-0.5 text-[12px] font-bold rounded-full border ${statusVisual.bg} ${statusVisual.text} ${statusVisual.border}`}
        >
          {statusVisual.label}
        </span>
        {isUnassigned ? (
          <span className="flex items-center gap-1 text-[12px] font-bold text-amber-700 dark:text-amber-400">
            <Icon name="warning" size="sm" />
            לא משויך
          </span>
        ) : task.source_trigger === "manager_manual" ? (
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Icon name="push_pin" size="sm" className="opacity-50" />
            מראש
          </span>
        ) : null}
      </div>
    </div>
  )
}

/* ── Column (droppable + sortable) ──────────────────────── */

interface ColumnStats {
  urgentCount: number
  nextCheckoutTime: string | null
  inProgressCount: number
}

interface ColumnProps {
  id: string
  title: string
  subtitle?: string
  icon: string
  tasks: CleaningTask[]
  onTaskClick: (task: CleaningTask) => void
  variant?: "unassigned" | "cleaner"
  stats?: ColumnStats
}

function Column({ id, title, subtitle, icon, tasks, onTaskClick, variant = "cleaner", stats }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const isUnassigned = variant === "unassigned"
  const headerClass = isUnassigned
    ? "bg-gradient-to-l from-amber-500/15 to-orange-500/10 border-amber-300 dark:border-amber-800"
    : "bg-[#1e40af]/5 border-[#dad9e3]"
  const bodyClass = isUnassigned
    ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800"
    : "bg-accent/30 border-[#dad9e3]"
  const iconBg = isUnassigned
    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
    : "bg-white/50 dark:bg-black/20 text-primary"
  const overloaded = !isUnassigned && tasks.length >= 8
  const columnWidth = isUnassigned ? "min-w-[300px] w-[300px]" : "min-w-[280px] w-[280px]"

  return (
    <div className={`flex flex-col ${columnWidth} shrink-0`}>
      {/* Header */}
      <div className={`rounded-t-[18px] border-2 border-b-0 px-4 py-3 ${headerClass}`}>
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon name={icon} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
            {subtitle && <p className="text-[12px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-lg font-extrabold text-foreground tabular-nums leading-none">
              {tasks.length}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground">חדרים</span>
          </div>
        </div>

        {/* Stats row */}
        {stats && !isUnassigned && (
          <div className="flex items-center gap-2 mt-2 text-[12px]">
            {stats.urgentCount > 0 && (
              <span className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {stats.urgentCount} דחוף
              </span>
            )}
            {stats.inProgressCount > 0 && (
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats.inProgressCount} בעבודה
              </span>
            )}
            {stats.nextCheckoutTime && (
              <span className="flex items-center gap-1 font-bold text-muted-foreground ms-auto tabular-nums" dir="ltr">
                <Icon name="schedule" size="sm" className="opacity-50" />
                {stats.nextCheckoutTime}
              </span>
            )}
            {overloaded && (
              <span className="font-bold text-amber-600 dark:text-amber-400">
                עמוס
              </span>
            )}
          </div>
        )}

        {isUnassigned && tasks.length > 0 && (
          <div className="mt-2 text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Icon name="drag_indicator" size="sm" />
            גרור לעובד לשיבוץ
          </div>
        )}
      </div>

      {/* Body (droppable) */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[140px] rounded-b-[18px] border-2 border-t-0 p-2.5 flex flex-col gap-2 transition-all ${bodyClass} ${
          isOver ? "ring-2 ring-primary/40 bg-primary/5" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy} id={id}>
          {tasks.length === 0 ? (
            <div className={`flex-1 flex flex-col items-center justify-center py-6 text-[11px] rounded-lg border-2 border-dashed ${
              isOver
                ? "border-primary text-primary bg-primary/5"
                : "border-[#dad9e3] text-muted-foreground/50"
            }`}>
              <Icon name="drag_indicator" size="md" className="mb-1 opacity-40" />
              {isOver ? "שחרר כאן" : isUnassigned ? "אין חדרים לשיבוץ" : "גרור חדר לכאן"}
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                isUnassigned={isUnassigned}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

/* ── Unassigned Banner (full-width, responsive grid) ────── */

interface UnassignedBannerProps {
  id: string
  tasks: CleaningTask[]
  onTaskClick: (task: CleaningTask) => void
}

function UnassignedBanner({ id, tasks, onTaskClick }: UnassignedBannerProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className={`w-full transition-all ${isOver ? "ring-4 ring-primary/50 rounded-[18px]" : ""}`}>
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500/15 to-orange-500/10 border-2 border-amber-300 dark:border-amber-800 border-b-0 rounded-t-[18px] px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="inbox" size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-foreground">ממתינים לשיבוץ</h3>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
              <Icon name="drag_indicator" size="sm" />
              גרור חדר לעובד למטה לשיבוץ
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums leading-none">
              {tasks.length}
            </span>
            <span className="text-[12px] font-bold text-muted-foreground">חדרים</span>
          </div>
        </div>
      </div>

      {/* Body (sortable grid) — large drop area so drag-back from
          a cleaner column is always an easy target, even when empty */}
      <div
        className={`rounded-b-[18px] border-2 border-t-0 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 p-3 min-h-[160px] transition-all ${
          isOver ? "bg-primary/10 border-primary" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={rectSortingStrategy} id={id}>
          {tasks.length === 0 ? (
            <div
              className={`h-full min-h-[140px] flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed transition-all ${
                isOver
                  ? "border-primary text-primary bg-primary/10 scale-[1.01]"
                  : "border-amber-400/60 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/20"
              }`}
            >
              <Icon
                name={isOver ? "move_to_inbox" : "inbox"}
                size="xl"
                className={`mb-2 ${isOver ? "" : "opacity-50"}`}
              />
              <p className="text-sm font-extrabold">
                {isOver ? "שחרר כאן להחזרה לשיבוץ" : "אין חדרים ממתינים לשיבוץ"}
              </p>
              <p className="text-[11px] mt-1 opacity-70">
                גרור חדר מעובד לכאן כדי להחזיר לרשימת השיבוץ
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {tasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    isUnassigned
                  />
                ))}
              </div>
              {/* Extra drop strip so you can always drop at the end of the grid */}
              <div
                className={`mt-2 py-3 text-center text-[12px] font-bold rounded-lg border-2 border-dashed transition-colors ${
                  isOver
                    ? "border-primary text-primary bg-primary/5"
                    : "border-amber-300/40 dark:border-amber-800/40 text-amber-700/60 dark:text-amber-400/60"
                }`}
              >
                <Icon name="drag_indicator" size="sm" className="inline opacity-50 me-1" />
                גרור לכאן להחזרת חדר לשיבוץ
              </div>
            </>
          )}
        </SortableContext>
      </div>
    </div>
  )
}

/* ── Edit SidePanel ─────────────────────────────────────── */

interface EditPanelProps {
  task: CleaningTask | null
  cleaners: CleaningBoard["cleaners"]
  tenantId: string
  onClose: () => void
  onSaved: () => void
}

function TaskEditPanel({ task, cleaners, tenantId, onClose, onSaved }: EditPanelProps) {
  const [status, setStatus] = useState<CleaningStatus>("pending")
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setStatus(task.status)
      setAssignedTo(task.assigned_to ?? "")
      setNotes(task.notes ?? "")
    }
  }, [task])

  const handleSave = async () => {
    if (!task) return
    setSaving(true)

    if (status !== task.status) {
      await setCleaningTaskStatus(tenantId, task.id, status)
    }
    if (assignedTo !== (task.assigned_to ?? "")) {
      await assignCleaner(tenantId, task.id, assignedTo || null)
    }
    if (notes !== (task.notes ?? "")) {
      await updateCleaningTaskNotes(tenantId, task.id, notes)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm("למחוק את המשימה?")) return
    setSaving(true)
    await deleteCleaningTask(tenantId, task.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <SidePanel
      isOpen={task !== null}
      onClose={onClose}
      title={task ? (task.target_type === "area" ? `משימה — ${task.target_label}` : `משימה — חדר ${task.room_number}`) : ""}
      subtitle={task ? `יציאה ${fmtTime(task.checkout_time)}` : undefined}
      footer={
        task ? (
          <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="min-h-[44px] px-4 py-3 text-destructive text-sm hover:bg-destructive/5 rounded-xl transition-colors flex items-center gap-2"
            >
              <Icon name="delete" size="sm" />
              מחק
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                <Icon name={saving ? "hourglass_empty" : "save"} size="sm" className={saving ? "animate-spin" : ""} />
                שמור
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {task && (
        <div className="space-y-5">
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
            <h4 className="text-base font-bold text-foreground mb-3">פרטי שהות</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground">כניסה</div>
                <div className="text-sm font-bold tabular-nums">{fmtDate(task.checkin_date ?? "")}</div>
              </div>
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground">יציאה</div>
                <div className="text-sm font-bold tabular-nums">{fmtDate(task.checkout_date)}</div>
              </div>
              <div className="bg-accent rounded-xl p-3 col-span-2">
                <div className="text-[11px] text-muted-foreground">שעת יציאה</div>
                <div className="text-lg font-extrabold tabular-nums text-primary" dir="ltr">
                  {fmtTime(task.checkout_time)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <h4 className="text-base font-bold text-foreground mb-1">שיבוץ</h4>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-2 block">עובד ניקיון</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[48px] appearance-none cursor-pointer"
              >
                <option value="">לא משויך</option>
                {cleaners.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <h4 className="text-base font-bold text-foreground mb-1">סטטוס</h4>
            <div className="grid grid-cols-3 gap-2">
              {(["pending", "in_progress", "done"] as CleaningStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-3 rounded-full text-xs font-bold transition-all min-h-[44px] ${
                    status === s
                      ? "bg-primary text-white shadow-md"
                      : "bg-accent text-muted-foreground hover:bg-accent/80"
                  }`}
                >
                  {STATUS_VISUAL[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <h4 className="text-base font-bold text-foreground mb-1">הערות</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות לעובד הניקיון..."
              rows={3}
              className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
            />
          </div>
        </div>
      )}
    </SidePanel>
  )
}

/* ── Main Page Component ────────────────────────────────── */

const UNASSIGNED_ID = "__unassigned__"

export default function HousekeepingPage() {
  const { tenantId } = useTenant()
  const { can } = usePermissions()
  const [date, setDate] = useState<string>(todayStr())
  const [board, setBoard] = useState<CleaningBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<CleaningTask | null>(null)
  const [editTask, setEditTask] = useState<CleaningTask | null>(null)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [quickFilter, setQuickFilter] = useState<"today" | "dirty" | "unassigned" | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canEdit = can("housekeeping", "edit")

  const loadBoard = useCallback(async () => {
    const data = await getCleaningBoard(tenantId, date)
    setBoard(data)
    setLoading(false)
  }, [tenantId, date])

  // Pause polling while a drag is in flight so the server doesn't
  // overwrite optimistic state mid-drag.
  const dragInFlight = useRef(false)

  // Source container captured at drag start. Using a ref bypasses the
  // closure/staleness problem: by the time handleDragEnd runs, React may
  // not have committed the optimistic setBoard from handleDragOver, so
  // findContainer(activeId) can return the WRONG (old) container. The ref
  // is the only stable way to know where the drag started.
  const dragSourceRef = useRef<string | null>(null)
  const dragDestRef = useRef<string | null>(null)

  const loadBoardSafe = useCallback(async () => {
    if (dragInFlight.current) return
    await loadBoard()
  }, [loadBoard])

  useEffect(() => {
    loadBoard()
    pollRef.current = setInterval(loadBoardSafe, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadBoard, loadBoardSafe])

  // 8px activation prevents accidental drags on tap/click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Custom collision detection: pointerWithin checks if pointer is physically
  // INSIDE a droppable rect (no corner-distance ambiguity). closestCenter as
  // fallback when pointer is in gaps between containers.
  const stableCollision: CollisionDetection = useCallback((args) => {
    const within = pointerWithin(args)
    if (within.length > 0) return within
    return closestCenter(args)
  }, [])

  const findContainer = useCallback(
    (id: string): string | null => {
      if (!board) return null
      if (id === UNASSIGNED_ID || board.byCleaner[id] !== undefined) return id
      if (board.unassigned.some((t) => t.id === id)) return UNASSIGNED_ID
      for (const [cleanerId, tasks] of Object.entries(board.byCleaner)) {
        if (tasks.some((t) => t.id === id)) return cleanerId
      }
      return null
    },
    [board]
  )

  const getContainerList = useCallback(
    (containerId: string): CleaningTask[] => {
      if (!board) return []
      if (containerId === UNASSIGNED_ID) return board.unassigned
      return board.byCleaner[containerId] ?? []
    },
    [board]
  )

  const setContainerList = (
    prev: CleaningBoard,
    containerId: string,
    list: CleaningTask[]
  ): CleaningBoard => {
    if (containerId === UNASSIGNED_ID) return { ...prev, unassigned: list }
    return { ...prev, byCleaner: { ...prev.byCleaner, [containerId]: list } }
  }

  const handleDragStart = (e: DragStartEvent) => {
    if (!board) return
    dragInFlight.current = true
    dragDestRef.current = null
    const id = e.active.id as string
    const containerId = findContainer(id)
    console.warn("[DND] dragStart", { activeId: id, containerId })
    if (!containerId) return
    dragSourceRef.current = containerId
    const list = getContainerList(containerId)
    const task = list.find((t) => t.id === id)
    if (task) setActiveTask(task)
  }

  // Canonical @dnd-kit multi-container sortable pattern: move optimistically
  // on hover. The drop animation slides instead of jumping because cards
  // are already repositioned in state by the time the drop fires.
  const handleDragOver = (e: DragOverEvent) => {
    if (!board || !e.over) {
      console.warn("[DND] dragOver — no board or no e.over", { board: !!board, over: !!e.over })
      return
    }
    const activeId = e.active.id as string
    const overId = e.over.id as string

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)
    console.warn("[DND] dragOver", {
      activeId,
      overId,
      activeContainer,
      overContainer,
      overData: e.over.data?.current,
      sameContainer: activeContainer === overContainer,
    })
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    if (overContainer === dragSourceRef.current && activeContainer !== dragSourceRef.current) {
      console.warn("[DND] dragOver — BLOCKED anti-bounce")
      return
    }

    console.warn("[DND] dragOver — CROSS-CONTAINER MOVE", { from: activeContainer, to: overContainer })

    setBoard((prev) => {
      if (!prev) return prev
      const sourceList =
        activeContainer === UNASSIGNED_ID ? prev.unassigned : prev.byCleaner[activeContainer] ?? []
      const destList =
        overContainer === UNASSIGNED_ID ? prev.unassigned : prev.byCleaner[overContainer] ?? []

      const activeIdx = sourceList.findIndex((t) => t.id === activeId)
      if (activeIdx === -1) return prev
      const task = sourceList[activeIdx]

      // If hovering over a specific card, insert above it; otherwise append
      const overIdx = destList.findIndex((t) => t.id === overId)
      const insertAt = overIdx === -1 ? destList.length : overIdx

      const newSource = sourceList.filter((_, i) => i !== activeIdx)
      const newDest = [...destList.slice(0, insertAt), task, ...destList.slice(insertAt)]

      const withSource = setContainerList(prev, activeContainer, newSource)
      return setContainerList(withSource, overContainer, newDest)
    })

    dragDestRef.current = overContainer
    console.warn("[DND] dragDestRef SET to:", overContainer)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const sourceContainer = dragSourceRef.current
    const lastDest = dragDestRef.current
    dragSourceRef.current = null
    dragDestRef.current = null

    console.warn("[DND] dragEnd", {
      sourceContainer,
      lastDest,
      hasOver: !!e.over,
      overId: e.over?.id,
      overData: e.over?.data?.current,
      activeId: e.active.id,
    })

    try {
      if (!board || !sourceContainer) {
        console.warn("[DND] dragEnd — EARLY RETURN (no board or source)")
        await loadBoard()
        return
      }

      const activeId = e.active.id as string

      if (lastDest && lastDest !== sourceContainer) {
        console.warn("[DND] dragEnd — CROSS-CONTAINER COMMIT", {
          activeId,
          from: sourceContainer,
          to: lastDest,
          cleanerUserId: lastDest === UNASSIGNED_ID ? null : lastDest,
        })
        await assignCleaner(
          tenantId,
          activeId,
          lastDest === UNASSIGNED_ID ? null : lastDest
        )
        await loadBoard()
        return
      }

      // ── Same-container reorder (dragDestRef was never set, so the
      //    task never left its original container — board state for
      //    this container is accurate)
      if (e.over) {
        const overId = e.over.id as string
        const list = getContainerList(sourceContainer)
        const oldIndex = list.findIndex((t) => t.id === activeId)
        const overIndex = list.findIndex((t) => t.id === overId)
        if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
          const newList = arrayMove(list, oldIndex, overIndex)
          setBoard((prev) => (prev ? setContainerList(prev, sourceContainer, newList) : prev))
          const result = await reorderCleaningTasks(
            tenantId,
            sourceContainer === UNASSIGNED_ID ? null : sourceContainer,
            newList.map((t) => t.id)
          )
          if (!result.success) {
            console.warn("reorderCleaningTasks failed:", result.error)
          }
        }
      }

      await loadBoard()
    } finally {
      dragInFlight.current = false
    }
  }

  const handleDragCancel = () => {
    setActiveTask(null)
    dragInFlight.current = false
    dragSourceRef.current = null
    dragDestRef.current = null
    loadBoard() // Restore ground-truth
  }

  // Flat list for dispatch board (all tasks, assigned + unassigned)
  const allTasks = board
    ? [...board.unassigned, ...Object.values(board.byCleaner).flat()]
    : []

  const todayIso = new Date().toISOString().slice(0, 10)
  const kpis = board
    ? {
        total: allTasks.filter(
          (t) => t.status === "pending" || t.status === "in_progress"
        ).length,
        unassigned: allTasks.filter(
          (t) => !t.assigned_to && (t.status === "pending" || t.status === "in_progress")
        ).length,
        dueToday: allTasks.filter(
          (t) =>
            t.checkout_date === todayIso &&
            (t.status === "pending" || t.status === "in_progress")
        ).length,
        dirty: allTasks.filter(
          (t) =>
            t.checkout_date < todayIso &&
            (t.status === "pending" || t.status === "in_progress")
        ).length,
      }
    : { total: 0, unassigned: 0, dueToday: 0, dirty: 0 }

  function passesQuickFilter(t: CleaningTask): boolean {
    if (!quickFilter) return true
    const isOpen = t.status === "pending" || t.status === "in_progress"
    if (quickFilter === "unassigned") return !t.assigned_to && isOpen
    if (quickFilter === "today") return t.checkout_date === todayIso && isOpen
    if (quickFilter === "dirty") return t.checkout_date < todayIso && isOpen
    return true
  }

  const filteredUnassigned = board ? board.unassigned.filter(passesQuickFilter) : []
  const filteredByCleaner: Record<string, CleaningTask[]> = board
    ? Object.fromEntries(
        Object.entries(board.byCleaner).map(([id, tasks]) => [id, tasks.filter(passesQuickFilter)])
      )
    : {}

  function toggleFilter(f: "today" | "dirty" | "unassigned") {
    setQuickFilter((prev) => (prev === f ? null : f))
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
        <Icon name="lock" size="xl" className="opacity-30" />
        <p className="text-lg font-medium">אין הרשאה</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#1e40af]/5 rounded-xl p-6 border border-[#dad9e3]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1e40af] flex items-center justify-center">
              <Icon name="cleaning_services" size="md" className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold font-headline text-foreground">לוח ניקיון</h1>
              <p className="text-sm text-muted-foreground">ניהול משימות, שיבוץ עובדים וסדרי עדיפויות</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DateInput
              value={date}
              onChange={(v) => setDate(v)}
            />
            <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
              <button
                type="button"
                onClick={() => setQuickFilter(null)}
                aria-pressed={quickFilter === null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  quickFilter === null
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#474747] font-medium hover:text-[#1e40af]"
                }`}
              >
                <Icon name="checklist" size="sm" /> {kpis.total} הכל
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("unassigned")}
                aria-pressed={quickFilter === "unassigned"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  quickFilter === "unassigned"
                    ? "bg-white text-[#854d0e] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#854d0e] font-medium hover:text-[#1e40af]"
                }`}
              >
                <Icon name="warning" size="sm" /> {kpis.unassigned} לא משויכים
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("today")}
                aria-pressed={quickFilter === "today"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  quickFilter === "today"
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#1e40af] font-medium hover:text-[#1e40af]"
                }`}
              >
                <Icon name="logout" size="sm" /> {kpis.dueToday} יציאות היום
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("dirty")}
                aria-pressed={quickFilter === "dirty"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  quickFilter === "dirty"
                    ? "bg-white text-[#b91c1c] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#b91c1c] font-medium hover:text-[#1e40af]"
                }`}
              >
                <Icon name="priority_high" size="sm" /> {kpis.dirty} דחופים
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreateTaskOpen(true)}
              className="btn btn-primary"
            >
              <Icon name="add" size="sm" />
              <span className="max-sm:hidden">משימת ניקיון חדשה</span>
            </button>
          </div>
        </div>
      </div>

      <CreateCleaningTaskPanel
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        tenantId={tenantId}
        scheduledDate={date}
        onCreated={loadBoard}
      />

      {loading || !board ? (
        <div className="flex items-center justify-center py-24">
          <Icon name="hourglass_empty" size="xl" className="animate-spin text-muted-foreground opacity-30" />
        </div>
      ) : (
        <>
          {board.cleaners.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-[20px] p-5 flex items-center gap-3">
              <Icon name="info" size="md" className="text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  אין עובדי ניקיון מוגדרים
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  הוסף משתמש עם תפקיד &quot;עובד ניקיון&quot; במסך עובדים כדי להתחיל לשבץ משימות.
                </p>
              </div>
            </div>
          )}

          {/* ── Primary: Dispatch Board ─────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 flex-wrap">
              <Icon name="dashboard" size="sm" className="text-primary" />
              <h2 className="text-sm font-extrabold text-foreground">
                לוח שיבוץ
              </h2>
              <span className="text-[11px] text-muted-foreground">
                חדרים לא משויכים למעלה • גרור לעובד לשיבוץ
              </span>
              <span className="text-[12px] text-muted-foreground/60 mr-auto flex items-center gap-1">
                <Icon name="info" size="sm" className="opacity-50" />
                גרור בתוך עמודה לשינוי סדר • ברירת מחדל: לפי שעת יציאה
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={stableCollision}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {/* Unassigned banner — full width, responsive grid */}
              <UnassignedBanner
                id={UNASSIGNED_ID}
                tasks={filteredUnassigned}
                onTaskClick={setEditTask}
              />

              {/* Cleaner columns row — horizontal scroll */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {board.cleaners.map((cleaner) => {
                  const tasks = filteredByCleaner[cleaner.id] ?? []
                  const urgentCount = tasks.filter(
                    (t) => t.status === "pending" && t.checkout_date < todayIso
                  ).length
                  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length
                  const todayTasks = tasks.filter(
                    (t) =>
                      (t.checkout_date === todayIso || t.checkout_date < todayIso) &&
                      t.status === "pending"
                  )
                  const nextCheckoutTime = todayTasks
                    .map((t) => t.checkout_time)
                    .filter((v): v is string => !!v)
                    .sort()[0]
                    ?.slice(0, 5) ?? null

                  return (
                    <Column
                      key={cleaner.id}
                      id={cleaner.id}
                      title={cleaner.full_name}
                      subtitle={cleaner.email}
                      icon="person"
                      tasks={tasks}
                      onTaskClick={setEditTask}
                      variant="cleaner"
                      stats={{ urgentCount, inProgressCount, nextCheckoutTime }}
                    />
                  )
                })}
              </div>

              <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                {activeTask ? (
                  <div className="bg-card rounded-[14px] p-3 shadow-2xl border-2 border-primary rotate-2 w-[260px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm tabular-nums ${
                        activeTask.target_type === "area" ? "bg-violet-500/10 text-violet-600" : "bg-primary/10 text-primary"
                      }`}>
                        {activeTask.target_type === "area" ? "🏢" : activeTask.room_number}
                      </div>
                      <div>
                        {activeTask.target_type === "area" ? (
                          <div className="text-xs font-bold text-violet-600 truncate max-w-[140px]">
                            {activeTask.target_label}
                          </div>
                        ) : activeTask.guest_name ? (
                          <div className="text-xs font-bold text-foreground truncate max-w-[140px]">
                            {activeTask.guest_name}
                          </div>
                        ) : activeTask.source_trigger === "manager_manual" ? (
                          <div className="text-xs font-bold text-foreground truncate max-w-[140px]">
                            הוקצא ע&quot;י: {activeTask.creator_name ?? "—"}
                          </div>
                        ) : null}
                        <div className="text-sm font-bold tabular-nums" dir="ltr">
                          {activeTask.target_type === "room" ? fmtTime(activeTask.checkout_time) : fmtDate(activeTask.checkout_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </>
      )}

      {board && (
        <TaskEditPanel
          task={editTask}
          cleaners={board.cleaners}
          tenantId={tenantId}
          onClose={() => setEditTask(null)}
          onSaved={loadBoard}
        />
      )}
    </div>
  )
}

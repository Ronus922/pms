"use client"

import { useState, useCallback, useRef } from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { Icon } from "@/components/shared/Icon"
import { MaintenanceTaskCard } from "./MaintenanceTaskCard"
import { reorderMaintenanceTasks } from "@/lib/actions/maintenance"
import type {
  MaintenanceTask,
  MaintenanceBoard as BoardData,
  MaintenanceWorkerSummary,
} from "@/lib/types/maintenance"
import { toast } from "sonner"

interface MaintenanceBoardProps {
  board: BoardData
  tenantId: string
  userId: string
  userName: string
  onTaskClick: (task: MaintenanceTask) => void
  onRefresh: () => void
  isPaused: React.MutableRefObject<boolean>
}

const UNASSIGNED_ID = "__unassigned__"

export function MaintenanceBoard({
  board: boardProp,
  tenantId,
  userId,
  userName,
  onTaskClick,
  onRefresh,
  isPaused,
}: MaintenanceBoardProps) {
  const [board, setBoard] = useState(boardProp)
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null)

  // Sync when prop changes and no drag in flight
  const dragInFlight = useRef(false)
  const dragSourceRef = useRef<string | null>(null)
  const dragDestRef = useRef<string | null>(null)

  if (boardProp !== board && !dragInFlight.current) {
    setBoard(boardProp)
  }

  // Mouse: 8px activation prevents accidental drags on click.
  // Touch: long-press (250ms) so vertical swipes scroll instead of dragging.
  // Keyboard: full a11y drag via arrow keys.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Screen-reader labels for drag announcements
  const srTaskLabel = (id: string | number): string => {
    const all = [...board.unassigned, ...Object.values(board.byWorker).flat()]
    return all.find((t) => t.id === id)?.title ?? "משימה"
  }
  const srContainerLabel = (id: string | number | undefined): string => {
    if (!id || id === UNASSIGNED_ID) return "ממתינים לשיבוץ"
    const worker = board.workers.find((w) => w.id === id)
    if (worker) return worker.full_name
    const containerId = findContainer(id as string)
    if (!containerId || containerId === UNASSIGNED_ID) return "ממתינים לשיבוץ"
    return board.workers.find((w) => w.id === containerId)?.full_name ?? "עמודה"
  }

  // Custom collision: pointerWithin first (precise), closestCenter fallback
  const stableCollision: CollisionDetection = useCallback((args) => {
    const within = pointerWithin(args)
    if (within.length > 0) return within
    return closestCenter(args)
  }, [])

  const findContainer = useCallback(
    (id: string): string | null => {
      if (id === UNASSIGNED_ID || board.byWorker[id] !== undefined) return id
      if (board.unassigned.some((t) => t.id === id)) return UNASSIGNED_ID
      for (const [workerId, tasks] of Object.entries(board.byWorker)) {
        if (tasks.some((t) => t.id === id)) return workerId
      }
      return null
    },
    [board],
  )

  const getContainerList = useCallback(
    (containerId: string): MaintenanceTask[] => {
      if (containerId === UNASSIGNED_ID) return board.unassigned
      return board.byWorker[containerId] ?? []
    },
    [board],
  )

  const setContainerList = (
    prev: BoardData,
    containerId: string,
    list: MaintenanceTask[],
  ): BoardData => {
    if (containerId === UNASSIGNED_ID) return { ...prev, unassigned: list }
    return { ...prev, byWorker: { ...prev.byWorker, [containerId]: list } }
  }

  /* ── Drag Start ───────────────────────────────────────── */

  const handleDragStart = (e: DragStartEvent) => {
    dragInFlight.current = true
    isPaused.current = true
    dragDestRef.current = null
    const id = e.active.id as string
    const containerId = findContainer(id)
    if (!containerId) return
    dragSourceRef.current = containerId
    const list = getContainerList(containerId)
    const task = list.find((t) => t.id === id)
    if (task) setActiveTask(task)
  }

  /* ── Drag Over (optimistic cross-container move) ──────── */

  const handleDragOver = (e: DragOverEvent) => {
    if (!e.over) return
    const activeId = e.active.id as string
    const overId = e.over.id as string

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    // Anti-bounce: block immediate return to source
    if (overContainer === dragSourceRef.current && activeContainer !== dragSourceRef.current) return

    setBoard((prev) => {
      const sourceList =
        activeContainer === UNASSIGNED_ID ? prev.unassigned : prev.byWorker[activeContainer] ?? []
      const destList =
        overContainer === UNASSIGNED_ID ? prev.unassigned : prev.byWorker[overContainer] ?? []

      const activeIdx = sourceList.findIndex((t) => t.id === activeId)
      if (activeIdx === -1) return prev
      const task = sourceList[activeIdx]

      const overIdx = destList.findIndex((t) => t.id === overId)
      const insertAt = overIdx === -1 ? destList.length : overIdx

      const newSource = sourceList.filter((_, i) => i !== activeIdx)
      const newDest = [...destList.slice(0, insertAt), task, ...destList.slice(insertAt)]

      const withSource = setContainerList(prev, activeContainer, newSource)
      return setContainerList(withSource, overContainer, newDest)
    })

    dragDestRef.current = overContainer
  }

  /* ── Drag End ─────────────────────────────────────────── */

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const sourceContainer = dragSourceRef.current
    const lastDest = dragDestRef.current
    dragSourceRef.current = null
    dragDestRef.current = null
    dragInFlight.current = false
    isPaused.current = false

    if (!sourceContainer) {
      onRefresh()
      return
    }

    const activeId = e.active.id as string

    // Where the card actually was at drop time wins over the hover-ref:
    // the anti-bounce guard freezes dragDestRef when returning to the source
    // column (keyboard drags hit this deterministically), so trust e.over
    // unless it resolves to the dragged card itself (stale mid-optimistic).
    const dropContainer =
      e.over && e.over.id !== activeId ? findContainer(e.over.id as string) : null
    const dest = dropContainer ?? lastDest

    // Cross-container commit
    if (dest && dest !== sourceContainer) {
      const toWorkerId = dest === UNASSIGNED_ID ? null : dest
      const destList = getContainerList(dest)
      try {
        const result = await reorderMaintenanceTasks(tenantId, toWorkerId, destList.map((t) => t.id))
        if (!result.success) toast.error("שגיאה בהעברה")
      } catch {
        toast.error("ההעברה לא נשמרה — בעיית תקשורת. נסה שוב.")
      }
      onRefresh()
      return
    }

    // Same-container reorder
    if (e.over) {
      const overId = e.over.id as string
      const list = getContainerList(sourceContainer)
      const oldIndex = list.findIndex((t) => t.id === activeId)
      const overIndex = list.findIndex((t) => t.id === overId)
      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        const newList = arrayMove(list, oldIndex, overIndex)
        setBoard((prev) => setContainerList(prev, sourceContainer, newList))
        const workerId = sourceContainer === UNASSIGNED_ID ? null : sourceContainer
        try {
          const result = await reorderMaintenanceTasks(tenantId, workerId, newList.map((t) => t.id))
          if (!result.success) {
            toast.error("שגיאה בסידור")
            onRefresh()
          }
        } catch {
          toast.error("הסדר לא נשמר — בעיית תקשורת. נסה שוב.")
          onRefresh()
        }
      }
    }
  }

  /* ── Drag Cancel ──────────────────────────────────────── */

  const handleDragCancel = () => {
    setActiveTask(null)
    dragSourceRef.current = null
    dragDestRef.current = null
    dragInFlight.current = false
    isPaused.current = false
    onRefresh()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={stableCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "לחץ רווח או Enter כדי להרים משימה, חצים כדי להזיז בין עמודות, רווח שוב כדי לשחרר, Escape לביטול.",
        },
        announcements: {
          onDragStart: ({ active }) => `הרמת את ${srTaskLabel(active.id)}`,
          onDragOver: ({ active, over }) =>
            over ? `${srTaskLabel(active.id)} מעל ${srContainerLabel(over.id)}` : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? `${srTaskLabel(active.id)} שובץ אל ${srContainerLabel(over.id)}`
              : `${srTaskLabel(active.id)} שוחרר`,
          onDragCancel: ({ active }) => `הגרירה של ${srTaskLabel(active.id)} בוטלה`,
        },
      }}
    >
      <div className="space-y-4" dir="rtl">
        {/* ── Unassigned Banner (full-width, top) ────────── */}
        <UnassignedBanner
          id={UNASSIGNED_ID}
          tasks={board.unassigned}
          onTaskClick={onTaskClick}
        />

        {/* ── Worker Columns (horizontal scroll) ─────────── */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.workers.map((worker) => {
            const tasks = board.byWorker[worker.id] ?? []
            const urgentCount = tasks.filter((t) => t.urgency_level !== "normal").length
            const inProgressCount = tasks.filter((t) => t.status === "in_progress").length
            const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_duration_minutes ?? 0), 0)

            return (
              <WorkerColumn
                key={worker.id}
                id={worker.id}
                worker={worker}
                tasks={tasks}
                onTaskClick={onTaskClick}
                stats={{ urgentCount, inProgressCount, totalMinutes }}
              />
            )
          })}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay
        dropAnimation={
          prefersReducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        }
      >
        {activeTask && (
          <div className={prefersReducedMotion ? "opacity-90" : "opacity-90 rotate-2 scale-105"}>
            <MaintenanceTaskCard task={activeTask} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/* ── Unassigned Banner (full-width responsive grid) ──────── */

interface UnassignedBannerProps {
  id: string
  tasks: MaintenanceTask[]
  onTaskClick: (task: MaintenanceTask) => void
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
              גרור משימה לעובד למטה לשיבוץ
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums leading-none">
              {tasks.length}
            </span>
            <span className="text-[12px] font-bold text-muted-foreground">משימות</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        className={`rounded-b-[18px] border-2 border-t-0 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 p-3 min-h-[120px] transition-all ${
          isOver ? "bg-primary/10 border-primary" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={rectSortingStrategy} id={id}>
          {tasks.length === 0 ? (
            <div
              className={`h-full min-h-[100px] flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed transition-all ${
                isOver
                  ? "border-primary text-primary bg-primary/10"
                  : "border-amber-400/60 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/20"
              }`}
            >
              <Icon name={isOver ? "move_to_inbox" : "inbox"} size="xl" className={`mb-2 ${isOver ? "" : "opacity-50"}`} />
              <p className="text-sm font-extrabold">
                {isOver ? "שחרר כאן להחזרה לשיבוץ" : "אין משימות ממתינות לשיבוץ"}
              </p>
              <p className="text-[11px] mt-1 opacity-70">
                גרור משימה מעובד לכאן כדי להחזיר לרשימת השיבוץ
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {tasks.map((task, idx) => (
                  <MaintenanceTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    isUnassigned
                    orderIndex={idx + 1}
                  />
                ))}
              </div>
              {/* Extra drop strip for easy drag-back */}
              <div className={`mt-2 h-12 rounded-xl border-2 border-dashed flex items-center justify-center text-[11px] transition-all ${
                isOver
                  ? "border-primary text-primary bg-primary/10"
                  : "border-amber-300/50 text-amber-600/50 dark:border-amber-700/50 dark:text-amber-500/50"
              }`}>
                {isOver ? "שחרר כאן" : "שחרר כאן להוספה"}
              </div>
            </>
          )}
        </SortableContext>
      </div>
    </div>
  )
}

/* ── Worker Column ───────────────────────────────────────── */

interface WorkerColumnStats {
  urgentCount: number
  inProgressCount: number
  totalMinutes: number
}

interface WorkerColumnProps {
  id: string
  worker: MaintenanceWorkerSummary
  tasks: MaintenanceTask[]
  onTaskClick: (task: MaintenanceTask) => void
  stats: WorkerColumnStats
}

function WorkerColumn({ id, worker, tasks, onTaskClick, stats }: WorkerColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const overloaded = tasks.length >= 8

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      {/* Header */}
      <div className="rounded-t-[18px] border-2 border-b-0 border-border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/50 dark:bg-black/20 text-primary flex items-center justify-center shrink-0">
            <Icon name="engineering" size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{worker.full_name}</h3>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-lg font-extrabold text-foreground tabular-nums leading-none">
              {tasks.length}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground">משימות</span>
          </div>
        </div>

        {/* Stats row */}
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
              {stats.inProgressCount} בטיפול
            </span>
          )}
          {stats.totalMinutes > 0 && (
            <span className="flex items-center gap-1 font-bold text-muted-foreground ms-auto tabular-nums">
              <Icon name="schedule" size="sm" className="opacity-50" />
              {stats.totalMinutes} דק׳
            </span>
          )}
          {overloaded && (
            <span className="font-bold text-amber-600 dark:text-amber-400">עמוס</span>
          )}
        </div>
      </div>

      {/* Body (droppable) */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[140px] rounded-b-[18px] border-2 border-t-0 border-border bg-accent/30 p-2.5 flex flex-col gap-2 transition-all ${
          isOver ? "ring-2 ring-primary/40 bg-primary/5" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy} id={id}>
          {tasks.length === 0 ? (
            <div className={`flex-1 flex flex-col items-center justify-center py-6 text-[11px] rounded-lg border-2 border-dashed ${
              isOver
                ? "border-primary text-primary bg-primary/5"
                : "border-border text-muted-foreground/50"
            }`}>
              <Icon name="drag_indicator" size="md" className="mb-1 opacity-40" />
              {isOver ? "שחרר כאן" : "גרור משימה לכאן"}
            </div>
          ) : (
            tasks.map((task, idx) => (
              <MaintenanceTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                orderIndex={idx + 1}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

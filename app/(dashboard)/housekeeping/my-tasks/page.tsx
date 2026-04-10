"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getMyCleaningQueue, setCleaningTaskStatus } from "@/lib/actions/cleaning"
import type { CleaningTask, CleaningStatus } from "@/lib/types/cleaning"

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function fmtTime(t: string | null): string {
  if (!t) return "—"
  return t.slice(0, 5)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ── Task Card ──────────────────────────────────────────── */

interface TaskCardProps {
  task: CleaningTask
  index: number
  total: number
  busy: boolean
  onStart: () => void
  onDone: () => void
}

function TaskCard({ task, index, total, busy, onStart, onDone }: TaskCardProps) {
  const isPending = task.status === "pending"
  const isInProgress = task.status === "in_progress"
  const isDone = task.status === "done"

  return (
    <div
      className={`bg-card rounded-[22px] p-5 shadow-sm border-r-4 transition-all ${
        isDone
          ? "border-emerald-500 opacity-70"
          : isInProgress
            ? "border-blue-500"
            : "border-amber-500"
      }`}
    >
      {/* Top row: room + position */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl tabular-nums">
            {task.room_number}
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">חדר</div>
            <div className="text-lg font-extrabold">מס׳ {task.room_number}</div>
          </div>
        </div>
        <div className="text-[11px] font-bold text-muted-foreground bg-accent px-3 py-1.5 rounded-full tabular-nums">
          {index + 1} / {total}
        </div>
      </div>

      {/* Checkout time — BIG */}
      <div className="bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 rounded-xl p-4 mb-4 text-center">
        <div className="text-[11px] font-bold text-muted-foreground mb-1">שעת יציאה</div>
        <div className="text-4xl font-extrabold tabular-nums text-primary" dir="ltr">
          {fmtTime(task.checkout_time)}
        </div>
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-center">
        <div className="bg-accent/40 rounded-xl p-3">
          <div className="text-[12px] text-muted-foreground">כניסה</div>
          <div className="text-xs font-bold tabular-nums">{fmtDate(task.checkin_date)}</div>
        </div>
        <div className="bg-accent/40 rounded-xl p-3">
          <div className="text-[12px] text-muted-foreground">יציאה</div>
          <div className="text-xs font-bold tabular-nums">{fmtDate(task.checkout_date)}</div>
        </div>
      </div>

      {/* Notes */}
      {task.notes && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3 mb-4">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
            <Icon name="sticky_note_2" size="sm" />
            הערות
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200">{task.notes}</p>
        </div>
      )}

      {/* Actions */}
      {!isDone && (
        <div className="grid grid-cols-2 gap-3">
          {isPending ? (
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="min-h-[56px] px-4 py-3 bg-blue-500 text-white font-bold text-base rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 col-span-2"
            >
              <Icon name="play_arrow" size="md" />
              התחל ניקיון
            </button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              disabled={busy}
              className="min-h-[56px] px-4 py-3 bg-emerald-500 text-white font-bold text-base rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 col-span-2"
            >
              <Icon name="check_circle" size="md" />
              סיימתי
            </button>
          )}
        </div>
      )}

      {isDone && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm py-2">
          <Icon name="check_circle" size="md" />
          הושלם
        </div>
      )}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */

export default function MyTasksPage() {
  const { tenantId, userId } = useTenant()
  const [tasks, setTasks] = useState<CleaningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [date] = useState<string>(todayStr())

  const loadTasks = useCallback(async () => {
    const data = await getMyCleaningQueue(tenantId, userId, date)
    setTasks(data)
    setLoading(false)
  }, [tenantId, userId, date])

  useEffect(() => {
    loadTasks()
    // Poll every 3s for live updates from manager
    pollRef.current = setInterval(loadTasks, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadTasks])

  const handleStatusChange = async (taskId: string, status: CleaningStatus) => {
    setBusy(taskId)
    await setCleaningTaskStatus(tenantId, taskId, status)
    await loadTasks()
    setBusy(null)
  }

  const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "skipped")
  const doneTasks = tasks.filter((t) => t.status === "done")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-4 py-4 shadow-md">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="cleaning_services" size="md" className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-extrabold text-white font-headline">המשימות שלי</h1>
              <p className="text-xs text-blue-100 tabular-nums">{fmtDate(date)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadTasks}
                className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                aria-label="רענן"
              >
                <Icon name="refresh" size="sm" className="text-white" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-blue-100">
            <span className="bg-white/15 px-2.5 py-1 rounded-full font-bold">
              {activeTasks.length} לביצוע
            </span>
            {doneTasks.length > 0 && (
              <span className="bg-white/15 px-2.5 py-1 rounded-full font-bold">
                {doneTasks.length} הושלמו
              </span>
            )}
            <span className="mr-auto opacity-70">מתעדכן אוטומטית</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Icon name="hourglass_empty" size="xl" className="animate-spin text-muted-foreground opacity-30" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mx-auto">
              <Icon name="check_circle" size="xl" className="text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">אין משימות להיום</p>
              <p className="text-sm text-muted-foreground mt-1">נהדר! אין חדרים לניקיון כרגע</p>
            </div>
          </div>
        ) : (
          <>
            {/* Active tasks */}
            {activeTasks.map((task, idx) => (
              <TaskCard
                key={task.id}
                task={task}
                index={idx}
                total={activeTasks.length}
                busy={busy === task.id}
                onStart={() => handleStatusChange(task.id, "in_progress")}
                onDone={() => handleStatusChange(task.id, "done")}
              />
            ))}

            {/* Done section */}
            {doneTasks.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4 pb-2">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[11px] font-bold text-muted-foreground">
                    הושלמו ({doneTasks.length})
                  </span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>
                {doneTasks.map((task, idx) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={idx}
                    total={doneTasks.length}
                    busy={busy === task.id}
                    onStart={() => handleStatusChange(task.id, "in_progress")}
                    onDone={() => handleStatusChange(task.id, "done")}
                  />
                ))}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import {
  getMaintenanceBoard,
  getMaintenanceList,
  getMaintenanceStats,
  getUserFullName,
} from "@/lib/actions/maintenance"
import { MaintenanceStatsBar } from "./MaintenanceStats"
import { MaintenanceFiltersBar } from "./MaintenanceFilters"
import { MaintenanceBoard } from "./MaintenanceBoard"
import { MaintenanceTable } from "./MaintenanceTable"
import { MaintenanceDailyView } from "./MaintenanceDailyView"
import { MaintenancePriorityBoard } from "./MaintenancePriorityBoard"
import { CreateMaintenancePanel } from "./CreateMaintenancePanel"
import { MaintenanceDetailPanel } from "./MaintenanceDetailPanel"
import type {
  MaintenanceBoard as BoardData,
  MaintenanceTask,
  MaintenanceStats as StatsData,
  MaintenanceFilters,
  MaintenanceWorkerSummary,
} from "@/lib/types/maintenance"

type ViewMode = "board" | "table" | "daily" | "priority"

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MaintenancePage() {
  const { tenantId, userId, role } = useTenant()
  const { can } = usePermissions()
  const canEdit = can("maintenance", "edit")
  const canDelete = can("maintenance", "delete")
  const isManager = role === "super_admin" || role === "admin"

  // View state
  const [view, setView] = useState<ViewMode>("board")
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [filters, setFilters] = useState<MaintenanceFilters>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  // Data state
  const [board, setBoard] = useState<BoardData | null>(null)
  const [tableTasks, setTableTasks] = useState<MaintenanceTask[]>([])
  const [tableTotal, setTableTotal] = useState(0)
  const [tablePage, setTablePage] = useState(1)
  const [stats, setStats] = useState<StatsData>({ open: 0, unassigned: 0, urgent: 0, inProgress: 0, waitingParts: 0, completedToday: 0 })
  const [loading, setLoading] = useState(true)

  // Polling pause ref for DnD
  const isPaused = useRef(false)

  // Get user name (for audit)
  const [userName, setUserName] = useState("")
  useEffect(() => {
    getUserFullName(tenantId, userId).then(setUserName)
  }, [tenantId, userId])

  const loadStats = useCallback(async () => {
    const s = await getMaintenanceStats(tenantId)
    setStats(s)
  }, [tenantId])

  const loadBoard = useCallback(async () => {
    if (isPaused.current) return
    try {
      const b = await getMaintenanceBoard(tenantId, selectedDate, filters)
      setBoard(b)
    } catch {
      // silent — board stays as-is
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedDate, filters])

  const loadTable = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getMaintenanceList(tenantId, filters, undefined, undefined, tablePage, 50)
      setTableTasks(result.tasks)
      setTableTotal(result.total)
    } catch {
      setTableTasks([])
      setTableTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tenantId, filters, tablePage])

  // Load on mount and view change
  useEffect(() => {
    loadStats()
    if (view === "board" || view === "daily" || view === "priority") {
      loadBoard()
    } else {
      loadTable()
    }
  }, [view, loadStats, loadBoard, loadTable])

  // Polling for board view (5s)
  useEffect(() => {
    if (view !== "board" && view !== "daily" && view !== "priority") return
    const interval = setInterval(() => {
      if (!isPaused.current) {
        loadBoard()
        loadStats()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [view, loadBoard, loadStats])

  const handleRefresh = useCallback(() => {
    loadStats()
    if (view === "board" || view === "daily" || view === "priority") loadBoard()
    else loadTable()
  }, [view, loadStats, loadBoard, loadTable])

  const handleTaskClick = (task: MaintenanceTask) => {
    setDetailTaskId(task.id)
  }

  const handleFilterFromStats = (patch: Partial<MaintenanceFilters>) => {
    setFilters(patch)
    setView("table")
    setTablePage(1)
  }

  const workers: MaintenanceWorkerSummary[] = board?.workers ?? []

  const views: Array<{ key: ViewMode; label: string; icon: string }> = [
    { key: "board", label: "לוח עובדים", icon: "view_column" },
    { key: "priority", label: "לפי דחיפות", icon: "priority_high" },
    { key: "table", label: "טבלה", icon: "table_rows" },
    { key: "daily", label: "סדר עבודה יומי", icon: "view_agenda" },
  ]

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] max-sm:text-[22px] font-extrabold text-foreground">תחזוקה</h1>
          <p className="text-sm text-muted-foreground">ניהול תקלות, שיבוץ עובדים, סדר עבודה ומעקב ביצוע</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Segmented bar: date + view switcher in one rounded container */}
          <div className="inline-flex items-center gap-1 bg-white border-[1.5px] border-border rounded-full px-2 py-1 min-h-[48px]">
            <DateInput
              value={selectedDate}
              onChange={setSelectedDate}
              className="!bg-transparent !border-0 !rounded-full !px-3 !py-1.5 !min-h-[40px] !w-[130px] !text-sm"
            />
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors min-h-[40px] ${
                  view === v.key
                    ? "bg-secondary/20 text-violet-700 dark:text-violet-400 font-bold"
                    : "text-muted-foreground hover:text-violet-700 dark:text-violet-400 font-semibold"
                }`}
              >
                <Icon name={v.icon} size="sm" />
                <span className="max-sm:hidden">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Create button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn btn-primary"
            >
              <Icon name="add" size="sm" />
              <span className="max-sm:hidden">פתיחת תקלה</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <MaintenanceStatsBar stats={stats} onFilter={handleFilterFromStats} />

      {/* Filters */}
      <MaintenanceFiltersBar
        filters={filters}
        onChange={(f) => { setFilters(f); setTablePage(1) }}
        workers={workers}
        resultCount={view === "table" ? tableTotal : undefined}
      />

      {/* View content */}
      {view === "board" && board && (
        <MaintenanceBoard
          board={board}
          tenantId={tenantId}
          userId={userId}
          userName={userName}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
          isPaused={isPaused}
        />
      )}

      {view === "table" && (
        <MaintenanceTable
          tasks={tableTasks}
          total={tableTotal}
          page={tablePage}
          pageSize={50}
          onPageChange={setTablePage}
          onTaskClick={handleTaskClick}
          loading={loading}
        />
      )}

      {view === "priority" && board && (
        <MaintenancePriorityBoard
          tasks={[...board.unassigned, ...Object.values(board.byWorker).flat()]}
          onTaskClick={handleTaskClick}
        />
      )}

      {view === "daily" && board && (
        <MaintenanceDailyView
          board={board}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Loading state for board/daily/priority */}
      {(view === "board" || view === "daily" || view === "priority") && !board && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Create panel */}
      <CreateMaintenancePanel
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        userId={userId}
        userName={userName}
        onCreated={handleRefresh}
      />

      {/* Detail panel */}
      <MaintenanceDetailPanel
        isOpen={!!detailTaskId}
        onClose={() => setDetailTaskId(null)}
        taskId={detailTaskId}
        tenantId={tenantId}
        userId={userId}
        userName={userName}
        canEdit={canEdit}
        isManager={isManager}
        onUpdated={handleRefresh}
      />
    </div>
  )
}

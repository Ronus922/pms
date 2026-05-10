"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { DateRangePicker } from "@/components/shared/DateRangePicker"
import { BulkRoomUpdateDialog } from "@/components/yield/BulkRoomUpdateDialog"
import {
  getRateGridData,
  updateRateGridCell,
  type RateGridData,
  type RateGridField,
} from "@/lib/actions/rate-grid"
import {
  flushPendingChannelJobs,
  runChannexWorkerOnce,
} from "@/lib/actions/channex"
import type { BulkApplyResult } from "@/lib/hooks/use-bulk-room-update"
import { RoomBlock } from "./RoomBlock"

const DATE_COL_WIDTH = 56
const LABEL_COL_WIDTH = 120

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const HEB_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
]
const HEB_WEEKDAYS_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]

interface DateCol {
  iso: string
  day: number
  weekdayShort: string
  month: number
  year: number
  isWeekend: boolean
  isToday: boolean
}

function buildDateCols(dates: string[]): DateCol[] {
  const today = todayIso()
  return dates.map((iso) => {
    const d = new Date(iso + "T00:00:00Z")
    const dow = d.getUTCDay()
    return {
      iso,
      day: d.getUTCDate(),
      weekdayShort: HEB_WEEKDAYS_SHORT[dow],
      month: d.getUTCMonth(),
      year: d.getUTCFullYear(),
      isWeekend: dow === 5 || dow === 6,
      isToday: iso === today,
    }
  })
}

export function RateGrid() {
  const [from, setFrom] = useState<string>(() => todayIso())
  const [to, setTo] = useState<string>(() => shiftDate(todayIso(), 29))

  const [data, setData] = useState<RateGridData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPreselectedRoomIds, setBulkPreselectedRoomIds] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)

  const openBulk = useCallback((roomIds: string[] = []) => {
    setBulkPreselectedRoomIds(roomIds)
    setBulkOpen(true)
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getRateGridData(from, to)
    if (res.success) {
      setData(res.data)
    } else {
      setError(res.error)
      setData(null)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const handleCellCommit = useCallback(
    async (
      roomId: string,
      date: string,
      field: RateGridField,
      value: number | boolean | null,
    ) => {
      const savingKey = `${roomId}::${date}::${field}`
      setSavingCells((prev) => new Set(prev).add(savingKey))

      // Optimistic patch
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          rooms: prev.rooms.map((r) => {
            if (r.room.id !== roomId) return r
            return {
              ...r,
              cells: r.cells.map((c) =>
                c.date === date
                  ? { ...c, [field]: value, is_override: true }
                  : c,
              ),
            }
          }),
        }
      })

      const res = await updateRateGridCell(roomId, date, field, value)

      setSavingCells((prev) => {
        const next = new Set(prev)
        next.delete(savingKey)
        return next
      })

      if (!res.success) {
        toast.error(res.error)
        // Revert by reloading
        load()
        return
      }
      // Refresh sync count only (silent)
      setData((prev) =>
        prev
          ? { ...prev, pendingSyncCount: prev.pendingSyncCount + 1 }
          : prev,
      )
    },
    [load],
  )

  /**
   * Bulk Update flow — runs AFTER a successful DB save.
   *
   * Two distinct user-facing statuses:
   *   1. Local DB save — always "העדכון נשמר בהצלחה במערכת" here, because
   *      this handler is only called by onApplied which fires on success.
   *      DB save failures are handled inside the hook with their own toast
   *      and onApplied is NOT called in that path.
   *   2. Channel sync — auto-triggered here. Four sub-cases:
   *      a. No Channex connection / nothing queued → no second toast
   *      b. Worker drained the queue with no failures → success toast
   *      c. Worker hit validation/retry failures → warning toast
   *      d. Worker threw → error toast, queue stays for manual retry
   */
  const handleBulkApplied = useCallback(
    async (result: BulkApplyResult) => {
      setBulkOpen(false)

      // ── Phase 1: local DB save confirmation ────────────────────
      toast.success("העדכון נשמר בהצלחה במערכת", {
        description: `${result.affectedRecords} רשומות עודכנו${
          result.skippedRecords > 0 ? ` · דילוגים: ${result.skippedRecords}` : ""
        }`,
      })

      // ── Phase 2: auto channel sync ────────────────────────────
      const syncRes = await flushPendingChannelJobs()
      // Refresh the grid either way so pending count updates
      load()

      if (!syncRes.success) {
        // The action itself crashed — rare
        toast.error("הסנכרון לערוצים נכשל", {
          description: syncRes.error,
        })
        return
      }

      if (!syncRes.channelConnected) {
        // No Channex connection configured — nothing to sync to.
        // Stay silent on the channel side so the user isn't confused.
        return
      }

      if (syncRes.queuedBefore === 0) {
        // DB save succeeded but the trigger didn't enqueue anything —
        // nothing to push (e.g. the bulk update touched no ARI fields).
        return
      }

      const fullySynced =
        syncRes.done === syncRes.queuedBefore &&
        syncRes.failed === 0 &&
        syncRes.retried === 0 &&
        syncRes.pendingAfter === 0

      if (fullySynced) {
        toast.success("הסנכרון לערוצים הושלם בהצלחה", {
          description: `${syncRes.done} שינויים סונכרנו לערוצים`,
        })
      } else if (syncRes.done > 0 && syncRes.pendingAfter > 0) {
        toast.warning("הסנכרון לערוצים חלקי", {
          description: `${syncRes.done} סונכרנו · ${syncRes.pendingAfter} ממתינים בתור`,
        })
      } else {
        // Nothing got through — channel-side failure
        toast.error("הסנכרון לערוצים נכשל", {
          description: `${syncRes.pendingAfter} שינויים ממתינים בתור`,
        })
      }
    },
    [load],
  )

  /**
   * Manual Sync button (toolbar) — used after inline cell edits.
   * Bulk updates auto-sync via handleBulkApplied above, so this path
   * is only for the user-driven manual flush flow.
   */
  const handleManualSync = useCallback(async () => {
    if (syncing) return
    if (!data || data.pendingSyncCount === 0) return
    setSyncing(true)
    const res = await runChannexWorkerOnce(500)
    setSyncing(false)
    if (!res.success) {
      toast.error("הסנכרון נכשל", { description: res.error })
      return
    }
    const pendingBefore = res.pendingBefore
    const pendingAfter = res.pendingAfter
    if (res.done === pendingBefore && pendingAfter === 0 && res.failed === 0) {
      toast.success("הסנכרון לערוצים הושלם בהצלחה", {
        description: `${res.done} שינויים סונכרנו`,
      })
    } else if (res.done > 0 && pendingAfter > 0) {
      toast.warning("הסנכרון לערוצים חלקי", {
        description: `${res.done} סונכרנו · ${pendingAfter} ממתינים · ${res.failed} נכשלו`,
      })
    } else if (res.failed > 0 && res.done === 0) {
      toast.error("הסנכרון לערוצים נכשל", {
        description: `${res.failed} נכשלו · ${pendingAfter} ממתינים`,
      })
    } else {
      toast.info("אין שינויים לסנכרן")
    }
    load()
  }, [syncing, data, load])

  const shiftRange = (deltaDays: number) => {
    setFrom((f) => shiftDate(f, deltaDays))
    setTo((t) => shiftDate(t, deltaDays))
  }

  const dateCols = data ? buildDateCols(data.dates) : []
  // Group columns by month for the top header band
  const monthGroups: Array<{ label: string; count: number }> = []
  for (const col of dateCols) {
    const label = `${HEB_MONTHS[col.month]} ${col.year}`
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === label) {
      last.count++
    } else {
      monthGroups.push({ label, count: 1 })
    }
  }

  const totalWidth = LABEL_COL_WIDTH + dateCols.length * DATE_COL_WIDTH

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-card rounded-[20px] p-4 shadow-sm border border-border/20 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftRange(-7)}
            className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl bg-accent/60 hover:bg-accent text-foreground flex items-center justify-center"
            title="שבוע אחורה"
          >
            <Icon name="chevron_right" size="sm" />
          </button>
          <div className="min-w-[220px]">
            <DateRangePicker
              from={from}
              to={to}
              onChange={(f, t) => {
                setFrom(f)
                setTo(t)
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => shiftRange(7)}
            className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl bg-accent/60 hover:bg-accent text-foreground flex items-center justify-center"
            title="שבוע קדימה"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom(todayIso())
              setTo(shiftDate(todayIso(), 29))
            }}
            className="text-xs font-bold text-primary hover:underline px-2 py-1"
          >
            היום
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={
              syncing || !data || data.pendingSyncCount === 0
            }
            title={
              data && data.pendingSyncCount > 0
                ? `שגר ${data.pendingSyncCount} שינויים ממתינים לערוצים`
                : "אין שינויים ממתינים לסנכרון"
            }
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] transition-all border ${
              data && data.pendingSyncCount > 0 && !syncing
                ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 active:scale-95"
                : "bg-accent/60 border-border/20 text-muted-foreground cursor-not-allowed opacity-60"
            }`}
          >
            <Icon
              name={syncing ? "hourglass_empty" : "cloud_sync"}
              size="sm"
              className={syncing ? "animate-spin" : ""}
            />
            {syncing
              ? "מסנכרן..."
              : data && data.pendingSyncCount > 0
              ? `סנכרן ${data.pendingSyncCount}`
              : "סנכרון ערוצים"}
          </button>
          <button
            type="button"
            onClick={() => openBulk([])}
            className="btn btn-primary"
          >
            <Icon name="edit_calendar" size="sm" />
            עדכון קבוצתי
          </button>
        </div>
      </div>

      {/* Error / loading / empty states */}
      {loading && !data && (
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">טוען רשת תעריפים...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-card rounded-[20px] p-8 shadow-sm border border-destructive/30 flex items-center justify-center gap-3 text-destructive">
          <Icon name="error" size="md" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {data && !error && data.rooms.length === 0 && (
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center text-muted-foreground text-sm">
          אין חדרים פעילים להצגה
        </div>
      )}

      {/* Grid */}
      {data && data.rooms.length > 0 && (
        <div
          ref={scrollRef}
          className="overflow-x-auto rounded-[20px] border border-border/20 bg-accent/20"
          dir="rtl"
        >
          <div className="flex flex-col gap-3 p-3" style={{ width: totalWidth }}>
            {/* Sticky top date header */}
            <div className="sticky top-0 z-20 bg-accent/95 backdrop-blur-sm rounded-xl border border-border/20 overflow-hidden">
              {/* Month band */}
              <div className="flex">
                <div
                  className="shrink-0 bg-card/60 border-l border-border/20"
                  style={{ width: LABEL_COL_WIDTH }}
                />
                {monthGroups.map((g, i) => (
                  <div
                    key={`${g.label}-${i}`}
                    className="text-[11px] font-bold text-muted-foreground text-center py-1.5 border-r border-border/20"
                    style={{ width: g.count * DATE_COL_WIDTH }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Day band */}
              <div className="flex border-t border-border/20">
                <div
                  className="shrink-0 bg-card/60 border-l border-border/20"
                  style={{ width: LABEL_COL_WIDTH }}
                />
                {dateCols.map((c) => (
                  <div
                    key={c.iso}
                    className={`shrink-0 flex flex-col items-center justify-center py-1 border-r border-border/10 ${
                      c.isToday
                        ? "bg-primary/15 text-primary"
                        : c.isWeekend
                        ? "bg-amber-50/60"
                        : ""
                    }`}
                    style={{ width: DATE_COL_WIDTH }}
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {c.weekdayShort}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        c.isToday ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {c.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Room blocks */}
            {data.rooms.map((r) => (
              <RoomBlock
                key={r.room.id}
                room={r.room}
                cells={r.cells}
                dates={data.dates}
                dateColWidth={DATE_COL_WIDTH}
                labelColWidth={LABEL_COL_WIDTH}
                savingCells={
                  new Set(
                    Array.from(savingCells)
                      .filter((k) => k.startsWith(`${r.room.id}::`))
                      .map((k) => k.slice(r.room.id.length + 2)),
                  )
                }
                onCellCommit={(date, field, value) =>
                  handleCellCommit(r.room.id, date, field, value)
                }
                onOpenBulkForRoom={(roomId) => openBulk([roomId])}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk dialog */}
      <BulkRoomUpdateDialog
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onApplied={handleBulkApplied}
        preselectedRoomIds={bulkPreselectedRoomIds}
      />
    </div>
  )
}

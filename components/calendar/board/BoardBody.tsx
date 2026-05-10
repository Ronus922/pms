"use client"

import { forwardRef, useMemo } from "react"
import { DayCell } from "./DayCell"
import { ReservationBlock } from "./ReservationBlock"
import { PreviewLayer } from "./PreviewLayer"
import { ROW_HEIGHT } from "./board-constants"
import type {
  BoardBlock,
  BoardDailyPricing,
  BoardRatePlan,
  BoardRateOverride,
  BoardReservation,
  BoardRoom,
  DragState,
  OperationalTimes,
} from "./board-types"
import {
  addDays,
  diffDays,
  getCellPricing,
  resolveCheckInTime,
  resolveCheckOutTime,
  todayIso,
} from "./board-rules"

interface BoardBodyProps {
  rooms: BoardRoom[]
  reservations: BoardReservation[]
  blocks: BoardBlock[]
  dailyPricing: BoardDailyPricing[]
  rateOverrides: BoardRateOverride[]
  ratePlans: BoardRatePlan[]
  currency: string
  operationalTimes: OperationalTimes
  /** lookup_items color (hex) keyed by reservations.payment_status — sole source of bar colour. */
  paymentStatusColors: Record<string, string>
  /** lookup_items label keyed by payment_status — shown in tooltip. */
  paymentStatusLabels: Record<string, string>
  startDateIso: string
  totalDays: number
  drag: DragState
  selectedSegmentId: string | null
  onOpenReservation: (reservationId: string) => void
  onStartCreate: (roomId: string, col: number) => void
  onStartMove: (segmentId: string) => void
  onStartResize: (segmentId: string, edge: "start" | "end") => void
  onFocusSegment: (segmentId: string | null) => void
}

function isWeekendIso(iso: string): boolean {
  const d = new Date(iso + "T00:00:00Z").getUTCDay()
  // Israel: Friday (5) and Saturday (6) are weekend
  return d === 5 || d === 6
}

function formatHeaderDay(iso: string): { weekday: string; dom: string; month: string } {
  const d = new Date(iso + "T00:00:00Z")
  const wdHeb = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]
  const monthNames = [
    "ינו",
    "פבר",
    "מרץ",
    "אפר",
    "מאי",
    "יונ",
    "יול",
    "אוג",
    "ספט",
    "אוק",
    "נוב",
    "דצמ",
  ]
  return {
    weekday: wdHeb[d.getUTCDay()],
    dom: String(d.getUTCDate()),
    month: monthNames[d.getUTCMonth()],
  }
}

export const BoardBody = forwardRef<HTMLDivElement, BoardBodyProps>(function BoardBody(
  {
    rooms,
    reservations,
    blocks,
    dailyPricing,
    rateOverrides,
    ratePlans,
    currency,
    operationalTimes,
    paymentStatusColors,
    paymentStatusLabels,
    startDateIso,
    totalDays,
    drag,
    selectedSegmentId,
    onOpenReservation,
    onStartCreate,
    onStartMove,
    onStartResize,
    onFocusSegment,
  },
  ref,
) {
  const today = todayIso()

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(startDateIso, i)),
    [startDateIso, totalDays],
  )

  const roomIdxByRoomId = useMemo(() => {
    const m: Record<string, number> = {}
    rooms.forEach((r, i) => (m[r.id] = i))
    return m
  }, [rooms])

  const reservationsByRoom = useMemo(() => {
    const m = new Map<string, BoardReservation[]>()
    for (const r of reservations) {
      const list = m.get(r.room_id) ?? []
      list.push(r)
      m.set(r.room_id, list)
    }
    return m
  }, [reservations])

  const blocksByRoomDate = useMemo(() => {
    const m = new Set<string>()
    for (const b of blocks) m.add(`${b.room_id}_${b.block_date.slice(0, 10)}`)
    return m
  }, [blocks])

  const handleEmptyPointerDown = (roomId: string, col: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // Ignore if the user hit a reservation block
    if (target.closest("[data-reservation]")) return
    onStartCreate(roomId, col)
  }

  return (
    <div
      ref={ref}
      className="relative flex-1 overflow-auto bg-card rounded-2xl border border-border/30"
      style={
        {
          "--row-h": `${ROW_HEIGHT}px`,
        } as React.CSSProperties
      }
    >
      {/* Day header — today rendered in the same style as every other day;
          Friday/Saturday get a stronger amber tint and a small שבת/שבת tag. */}
      <div
        className="sticky top-0 z-20 flex w-full bg-card/95 backdrop-blur-sm border-b border-border/25"
        style={{ height: 64 }}
      >
        {days.map((iso) => {
          const info = formatHeaderDay(iso)
          const isToday = iso === today
          const weekend = isWeekendIso(iso)
          return (
            <div
              key={iso}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 border-s border-border/10 text-center transition-colors ${
                weekend ? "bg-amber-50/70 dark:bg-amber-950/20" : ""
              }`}
            >
              <span
                className={`text-[11px] leading-none ${
                  weekend ? "text-amber-700 font-bold" : "text-muted-foreground/80"
                }`}
              >
                {info.weekday}
              </span>
              <span
                className={`text-[15px] leading-none tabular-nums mt-1 font-semibold ${
                  weekend ? "text-amber-800" : "text-foreground"
                } ${isToday ? "underline decoration-primary decoration-2 underline-offset-4" : ""}`}
              >
                {info.dom}
              </span>
              <span
                className={`text-[9.5px] leading-none mt-1 ${
                  isToday
                    ? "text-primary font-bold"
                    : weekend
                      ? "text-amber-600"
                      : "text-muted-foreground/70"
                }`}
              >
                {isToday ? "היום" : weekend ? "שבת" : info.month}
              </span>
            </div>
          )
        })}
      </div>

      {/* Grid body */}
      <div className="relative w-full">
        {rooms.map((room) => {
          const roomReservations = reservationsByRoom.get(room.id) ?? []
          return (
            <div
              key={room.id}
              className="relative w-full border-b border-border/25"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Day cells — flex row with RTL handled by parent dir */}
              <div className="absolute inset-0 flex">
                {days.map((iso, col) => {
                  const pricing = getCellPricing(
                    room.id,
                    room.room_type_id,
                    Number(room.base_price) || 0,
                    iso,
                    dailyPricing,
                    rateOverrides,
                    ratePlans,
                  )
                  const blocked = blocksByRoomDate.has(`${room.id}_${iso}`)
                  return (
                    <div
                      key={iso}
                      data-cell
                      data-col={col}
                      data-room={room.id}
                      onPointerDown={handleEmptyPointerDown(room.id, col)}
                      className="h-full flex-1 min-w-0"
                    >
                      <DayCell
                        dateIso={iso}
                        price={pricing.price}
                        currency={currency}
                        minNights={pricing.minNights}
                        maxNights={pricing.maxNights}
                        closed={pricing.closed}
                        closedOnArrival={pricing.closedOnArrival}
                        closedOnDeparture={pricing.closedOnDeparture}
                        blocked={blocked}
                        isWeekend={isWeekendIso(iso)}
                        isToday={iso === today}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Reservation bars — one per SEGMENT, rendered with fractional
                  start/end offsets based on resolved check-in/out times. */}
              {roomReservations.map((r) => {
                const resStart = r.segment_check_in
                const resEnd = r.segment_check_out
                const startCol = diffDays(startDateIso, resStart)
                const nights = diffDays(resStart, resEnd)
                const endCol = startCol + nights

                if (endCol <= 0 || startCol >= totalDays) return null

                // Fractional offsets within the check-in / check-out day cells.
                const checkInHours = resolveCheckInTime(r, resStart, operationalTimes)
                const checkOutHours = resolveCheckOutTime(r, resEnd, operationalTimes)
                const startFrac = checkInHours / 24
                const endFrac = checkOutHours / 24
                const formatClock = (h: number) => {
                  const hh = Math.floor(h)
                  const mm = Math.round((h - hh) * 60)
                  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
                }
                const roomLabel = `${room.room_number} · ${room.room_type_name}`

                // Position in column-units from the start of the window.
                // Left edge (physical) = check-in day col + startFrac.
                // Right edge (physical) = check-out day col + endFrac.
                let leftEdgeCols = startCol + startFrac
                let rightEdgeCols = endCol + endFrac

                // Clip to visible window — clamp at whole-cell boundaries.
                if (leftEdgeCols < 0) leftEdgeCols = 0
                if (rightEdgeCols > totalDays) rightEdgeCols = totalDays
                if (rightEdgeCols <= leftEdgeCols) return null

                // Only a MOVE drag dims the original bar (because the move
                // preview is rendered at a different position). A RESIZE drag
                // keeps the original bar locked at full opacity — the
                // resize preview is a delta-only layer rendered alongside
                // the existing bar, so the committed pill never stretches
                // or reflows while the user drags the edge handle.
                const isDragged =
                  drag.type === "move" && drag.segmentId === r.segment_id
                // Suppress the tooltip during ANY drag targeting this segment
                // (move OR resize) so the hover card never hangs over an
                // active preview overlay.
                const isInteracting =
                  (drag.type === "move" || drag.type === "resize") &&
                  drag.segmentId === r.segment_id

                return (
                  <ReservationBlock
                    key={r.segment_id}
                    reservation={r}
                    startOffsetCols={leftEdgeCols}
                    endOffsetCols={rightEdgeCols}
                    totalDays={totalDays}
                    currency={currency}
                    paymentColor={paymentStatusColors[r.payment_status] ?? null}
                    paymentLabel={paymentStatusLabels[r.payment_status] ?? r.payment_status}
                    roomLabel={roomLabel}
                    checkInTimeLabel={formatClock(checkInHours)}
                    checkOutTimeLabel={formatClock(checkOutHours)}
                    isDragged={isDragged}
                    isInteracting={isInteracting}
                    isSelected={selectedSegmentId === r.segment_id}
                    onOpen={onOpenReservation}
                    onStartMove={onStartMove}
                    onStartResize={onStartResize}
                    onFocusChange={onFocusSegment}
                  />
                )
              })}
            </div>
          )
        })}

        {/* Preview layer — floats over the whole grid */}
        <PreviewLayer drag={drag} totalDays={totalDays} roomIdxByRoomId={roomIdxByRoomId} />
      </div>
    </div>
  )
})

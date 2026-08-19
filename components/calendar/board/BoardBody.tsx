"use client"

import { forwardRef, useMemo } from "react"
import { DayCell } from "./DayCell"
import { ReservationBlock } from "./ReservationBlock"
import { PreviewLayer } from "./PreviewLayer"
import { RailCorner, RoomCell } from "./RoomRail"
import { HEADER_HEIGHT, ROW_HEIGHT } from "./board-constants"
import type {
  BoardBlock,
  BoardDailyPricing,
  BoardRatePlan,
  BoardRateOverride,
  BoardReservation,
  BoardRoom,
  DerivedRoomStatus,
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
  statusByRoomId: Record<string, DerivedRoomStatus>
  /** lookup_items color (hex) keyed by reservations.payment_status — sole source of bar colour. */
  paymentStatusColors: Record<string, string>
  /** lookup_items label keyed by payment_status — shown in tooltip. */
  paymentStatusLabels: Record<string, string>
  startDateIso: string
  totalDays: number
  /** Fixed day-column width (px) for the active view. */
  colWidth: number
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
  const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"]
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
    statusByRoomId,
    paymentStatusColors,
    paymentStatusLabels,
    startDateIso,
    totalDays,
    colWidth,
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

  const floorCount = useMemo(
    () => new Set(rooms.map((r) => r.floor_id).filter(Boolean)).size,
    [rooms],
  )

  return (
    <div
      className="cal-board tl"
      style={
        {
          "--row-h": `${ROW_HEIGHT}px`,
          // Mobile fallback column width; on desktop CSS flex-fills columns to
          // the available width (see calendar.css @media ≥1024px) so the board
          // never overflows horizontally.
          "--col": `${colWidth}px`,
        } as React.CSSProperties
      }
    >
      <div ref={ref} className="tl-scroll">
        <div className="tl-inner">
          {/* Sticky day header */}
          <div className="tl-head" style={{ height: HEADER_HEIGHT }}>
            <RailCorner unitsCount={rooms.length} floorCount={floorCount} />
            <div className="tl-days">
              {days.map((iso) => {
                const info = formatHeaderDay(iso)
                const cls = [
                  "tl-day",
                  isWeekendIso(iso) ? "wknd" : "",
                  iso === today ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
                return (
                  <div key={iso} className={cls}>
                    <span className="dl">{info.weekday}</span>
                    <span className="dn">{info.dom}</span>
                    <span className="dm">{iso === today ? "היום" : info.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rows */}
          {rooms.map((room) => {
            const roomReservations = reservationsByRoom.get(room.id) ?? []
            const status = statusByRoomId[room.id] ?? "vacant_clean"
            return (
              <div key={room.id} className="tl-row" style={{ height: ROW_HEIGHT }}>
                <RoomCell room={room} status={status} />

                <div className="tl-track" style={{ height: ROW_HEIGHT }}>
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
                    return (
                      <DayCell
                        key={iso}
                        dateIso={iso}
                        col={col}
                        roomId={room.id}
                        price={pricing.price}
                        currency={currency}
                        minNights={pricing.minNights}
                        maxNights={pricing.maxNights}
                        closed={pricing.closed}
                        closedOnArrival={pricing.closedOnArrival}
                        closedOnDeparture={pricing.closedOnDeparture}
                        blocked={blocksByRoomDate.has(`${room.id}_${iso}`)}
                        isWeekend={isWeekendIso(iso)}
                        isToday={iso === today}
                        onStartCreate={onStartCreate}
                      />
                    )
                  })}

                  {/* Reservation bars + drag preview — pointer overlay above cells. */}
                  <div className="tl-bars">
                    {roomReservations.map((r) => {
                      const resStart = r.segment_check_in
                      const resEnd = r.segment_check_out
                      const startCol = diffDays(startDateIso, resStart)
                      const nights = diffDays(resStart, resEnd)
                      const endCol = startCol + nights
                      if (endCol <= 0 || startCol >= totalDays) return null

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

                      let leftEdgeCols = startCol + startFrac
                      let rightEdgeCols = endCol + endFrac
                      if (leftEdgeCols < 0) leftEdgeCols = 0
                      if (rightEdgeCols > totalDays) rightEdgeCols = totalDays
                      if (rightEdgeCols <= leftEdgeCols) return null

                      const isDragged = drag.type === "move" && drag.segmentId === r.segment_id
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

                    <PreviewLayer drag={drag} totalDays={totalDays} roomId={room.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

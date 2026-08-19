"use client"

import { memo } from "react"
import { Icon } from "@/components/shared/Icon"

interface DayCellProps {
  dateIso: string
  col: number
  roomId: string
  price: number
  currency: string
  minNights: number
  /** Max nights allowed starting from this date. null = no cap. */
  maxNights: number | null
  closed: boolean
  closedOnArrival: boolean
  closedOnDeparture: boolean
  blocked: boolean
  isWeekend: boolean
  isToday: boolean
  /** Begin a create-drag from this empty cell. */
  onStartCreate: (roomId: string, col: number) => void
}

function fmtPrice(n: number, currency: string): string {
  const symbol = currency === "ILS" ? "₪" : currency === "USD" ? "$" : currency === "EUR" ? "€" : ""
  return `${symbol}${Math.round(n).toLocaleString()}`
}

function DayCellInner({
  dateIso,
  col,
  roomId,
  price,
  currency,
  minNights,
  closed,
  closedOnArrival,
  closedOnDeparture,
  blocked,
  isWeekend,
  isToday,
  onStartCreate,
}: DayCellProps) {
  const unavailable = blocked || closed

  const cls = [
    "tl-cell",
    isWeekend ? "wknd" : "",
    isToday ? "today" : "",
    unavailable ? "unavail" : "",
  ]
    .filter(Boolean)
    .join(" ")

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Bars live in a pointer-events overlay above the cells; an empty-cell
    // pointerdown never originates from a reservation. Guard anyway.
    if ((e.target as HTMLElement).closest("[data-reservation]")) return
    onStartCreate(roomId, col)
  }

  return (
    <div
      data-cell
      data-col={col}
      data-room={roomId}
      data-date={dateIso}
      data-today={isToday || undefined}
      className={cls}
      onPointerDown={handlePointerDown}
    >
      <span className="pr">{price > 0 ? fmtPrice(price, currency) : "—"}</span>
      {minNights > 1 && !unavailable && (
        <span className="ms" title={`מינימום ${minNights} לילות`}>
          {minNights}
          <Icon name="dark_mode" className="cb-moon" />
        </span>
      )}

      {(closedOnArrival || closedOnDeparture) && (
        <div className="cell-flags">
          {closedOnArrival && <Icon name="block" size="sm" className="text-rose-400" />}
          {closedOnDeparture && <Icon name="block" size="sm" className="text-amber-400" />}
        </div>
      )}
    </div>
  )
}

export const DayCell = memo(DayCellInner)

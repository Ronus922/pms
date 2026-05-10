"use client"

import { memo } from "react"
import { Icon } from "@/components/shared/Icon"

interface DayCellProps {
  dateIso: string
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
}

function fmtPrice(n: number, currency: string): string {
  const symbol = currency === "ILS" ? "₪" : currency === "USD" ? "$" : currency === "EUR" ? "€" : ""
  return `${symbol}${Math.round(n).toLocaleString()}`
}

function DayCellInner({
  price,
  currency,
  minNights,
  maxNights,
  closed,
  closedOnArrival,
  closedOnDeparture,
  blocked,
  isWeekend,
  isToday,
}: DayCellProps) {
  const unavailable = blocked || closed
  // Today renders as any other day (no special bg tint). Friday/Saturday get a
  // slightly stronger amber tint so the weekend stands out across the board.
  const bgClass = unavailable
    ? "bg-rose-50/60 dark:bg-rose-950/15"
    : isWeekend
      ? "bg-amber-50/50 dark:bg-amber-950/15"
      : "bg-card"

  return (
    <div
      data-today={isToday || undefined}
      className={`relative h-full w-full border-s border-border/15 ${bgClass} select-none`}
    >
      {/* Price — centered, soft green, scannable. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`text-[12.5px] font-bold tabular-nums ${
            unavailable
              ? "text-rose-400 line-through"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {price > 0 ? fmtPrice(price, currency) : "—"}
        </span>
      </div>

      {/* LOS + closure markers — sit below the price so they never occlude it.
          Min-nights is shown ONLY for 2+ (never for 1-night stays) as a subtle
          "{N} 🌙" pair in slate-500 — no word "לילות", no accent badge.
          Max-nights badge is intentionally hidden from the cell for now —
          it's enforced on save, but cells stay visually clean. Closure
          markers are kept for the arrival/departure hint icons.
          See project memory `project_calendar_los_rules.md`. */}
      {/* Min-stay indicator pinned to the inline-start edge (visual right
          in RTL). Slightly smaller than before so it tucks into the corner
          without crowding the price. */}
      {minNights > 1 && (
        <span
          title={`מינימום ${minNights} לילות`}
          className="absolute bottom-0.5 start-1 flex items-center gap-0.5 text-[9.5px] font-medium leading-none text-slate-500 dark:text-slate-400 tabular-nums pointer-events-none"
        >
          {minNights}
          <Icon name="dark_mode" className="h-2.5 w-2.5 opacity-90" />
        </span>
      )}

      {(closedOnArrival || closedOnDeparture) && (
        <div className="absolute bottom-1 inset-x-0 flex items-center justify-center gap-1 pointer-events-none">
          {closedOnArrival && (
            <Icon name="do_not_disturb_on" size="sm" className="text-rose-400/80 text-[10px]" />
          )}
          {closedOnDeparture && (
            <Icon name="do_not_disturb_off" size="sm" className="text-amber-400/80 text-[10px]" />
          )}
        </div>
      )}

    </div>
  )
}

export const DayCell = memo(DayCellInner)

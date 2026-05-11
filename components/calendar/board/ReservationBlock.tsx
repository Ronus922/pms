"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { Icon } from "@/components/shared/Icon"
import {
  BAR_HEIGHT,
  BAR_V_PADDING,
  EDGE_HANDLE,
} from "./board-constants"
import type { BoardReservation } from "./board-types"
import { diffDays } from "./board-rules"
import { SOURCE_LABELS } from "@/lib/constants/reservation"

interface ReservationBlockProps {
  reservation: BoardReservation
  /** Distance from the window's start (in column units, can be fractional) to the bar's LEFT edge in logical flow. */
  startOffsetCols: number
  /** Distance from the window's start to the bar's RIGHT edge in logical flow (exclusive). */
  endOffsetCols: number
  totalDays: number
  currency: string
  /** Hex color for the payment status, sourced from Settings → Payment Status.
   *  Sole colour source for the bar. Null only if the status has no color set. */
  paymentColor: string | null
  paymentLabel: string
  /** "101 · Standard" — resolved by BoardBody from the room row. */
  roomLabel: string
  /** Resolved check-in / check-out clock times (HH:mm) for this reservation. */
  checkInTimeLabel: string
  checkOutTimeLabel: string
  isDragged: boolean
  /** True when ANY drag (move or resize) targets this segment. Controls
   *  tooltip suppression so the hover card never hangs over an active
   *  preview overlay. Unlike `isDragged`, does not dim the committed bar. */
  isInteracting: boolean
  isSelected: boolean
  /** Open the full-screen edit panel for the parent reservation. */
  onOpen: (reservationId: string) => void
  /** Start a move drag on THIS segment. */
  onStartMove: (segmentId: string) => void
  /** Start a resize drag on THIS segment. */
  onStartResize: (segmentId: string, edge: "start" | "end") => void
  onFocusChange: (segmentId: string | null) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export function ReservationBlock({
  reservation,
  startOffsetCols,
  endOffsetCols,
  totalDays,
  currency,
  paymentColor,
  paymentLabel,
  roomLabel,
  checkInTimeLabel,
  checkOutTimeLabel,
  isDragged,
  isInteracting,
  isSelected,
  onOpen,
  onStartMove,
  onStartResize,
  onFocusChange,
}: ReservationBlockProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  /** Portaled tooltip position (viewport-fixed coords). Recomputed on
   *  hover/focus + scroll/resize so it stays anchored to the bar while
   *  rendering outside every overflow/sticky parent. */
  const [tooltipPos, setTooltipPos] = useState<{
    placement: "top" | "bottom"
    /** distance from viewport top (bottom placement only) */
    top: number
    /** distance from viewport bottom (top placement only) */
    bottom: number
    /** distance from viewport right — RTL-first anchor */
    right: number
  } | null>(null)
  const downStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  // Colour is sourced SOLELY from the Payment Status settings lookup.
  // Fallback to a neutral slate only when no color is configured.
  // `color-mix` produces an OPAQUE pastel so the cell's price behind the pill
  // is fully hidden (earlier `${color}22` was too translucent — ₪ prices bled
  // through and covered the guest name).
  const baseColor = paymentColor ?? "#64748b"
  const pillStyle: React.CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${baseColor} 18%, white)`,
    borderColor: `color-mix(in srgb, ${baseColor} 55%, white)`,
    color: baseColor,
  }

  // Logical positioning — works for both RTL and LTR:
  //   inset-inline-start = 0 is the START of the window (earliest visible date)
  //   dir=rtl: maps to CSS `right`; dir=ltr: maps to CSS `left`.
  const startPct = (startOffsetCols / totalDays) * 100
  const widthPct = ((endOffsetCols - startOffsetCols) / totalDays) * 100

  const guestName =
    reservation.full_name ||
    [reservation.first_name, reservation.last_name].filter(Boolean).join(" ") ||
    "אורח"
  const totalGuests = (reservation.adults || 0) + (reservation.children || 0)
  const segmentId = reservation.segment_id

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      downStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!downStart.current) return
      const dx = e.clientX - downStart.current.x
      const dy = e.clientY - downStart.current.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        onStartMove(segmentId)
        downStart.current = null
      }
    },
    [onStartMove, segmentId],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = downStart.current
      downStart.current = null
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const elapsed = Date.now() - start.t
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && elapsed < 400) {
        onOpen(reservation.id)
      }
    },
    [onOpen, reservation.id],
  )

  const onEdgePointerDown = (edge: "start" | "end") => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onStartResize(segmentId, edge)
  }

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onOpen(reservation.id)
    }
  }

  const showCard = hovered || focused

  // Compute the portaled tooltip's viewport position anchored to the bar.
  // Using `right` + `top|bottom` because the UI is RTL-first and the tooltip's
  // start edge (right side) should align with the bar's start edge.
  const resolvePosition = useCallback(() => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const spaceAbove = rect.top
    const needed = 180 // approx card height incl. arrow + gap
    const placement: "top" | "bottom" = spaceAbove < needed ? "bottom" : "top"
    const GAP = 8
    setTooltipPos({
      placement,
      top: placement === "bottom" ? rect.bottom + GAP : 0,
      bottom: placement === "top" ? window.innerHeight - rect.top + GAP : 0,
      right: window.innerWidth - rect.right,
    })
  }, [])

  // While the tooltip is visible, keep its position synced with the bar if
  // the user scrolls the board or resizes the window. `capture: true` catches
  // scroll events on the BoardBody's inner overflow container — those don't
  // bubble up to window otherwise.
  useEffect(() => {
    if (!showCard) return
    const update = () => resolvePosition()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showCard, resolvePosition])

  return (
    <div
      ref={barRef}
      role="button"
      tabIndex={0}
      aria-label={`הזמנה ${reservation.reservation_number} של ${guestName}`}
      data-reservation={reservation.id}
      data-segment={segmentId}
      className={`absolute rounded-full border shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-visible cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragged ? "opacity-40" : "opacity-100"
      } ${isSelected ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-card" : ""} focus:outline-none focus:ring-2 focus:ring-primary/40`}
      style={{
        ...pillStyle,
        insetInlineStart: `${startPct}%`,
        width: `${widthPct}%`,
        top: BAR_V_PADDING,
        height: BAR_HEIGHT,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={() => {
        resolvePosition()
        setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        resolvePosition()
        setFocused(true)
        onFocusChange(segmentId)
      }}
      onBlur={() => {
        setFocused(false)
        onFocusChange(null)
      }}
      onKeyDown={onKey}
    >
      {/* Start (check-in) edge — LOCKED. No handle, no pointer events here.
          Direction-agnostic: inline-start is visual right in RTL, visual left in LTR. */}

      {/* Content — clean pastel pill: guest name + optional VIP star.
          Guests count, nights, and dates live on the hover/focus card. */}
      <div className="h-full flex items-center justify-center gap-1.5 px-4 pointer-events-none">
        {reservation.is_vip && (
          <Icon name="star" filled size="sm" className="text-amber-500 shrink-0" />
        )}
        <span className="text-[12.5px] font-bold truncate leading-tight">
          {guestName}
        </span>
      </div>

      {/* End (check-out) edge handle — the ONLY resizable edge.
          Logical inline-end: visual left in RTL, visual right in LTR.
          Width is deliberately generous so the resize cursor always catches. */}
      <button
        type="button"
        onPointerDown={onEdgePointerDown("end")}
        aria-label="שנה תאריך יציאה"
        className="absolute top-0 h-full touch-none flex items-center justify-center group"
        style={{ width: EDGE_HANDLE + 14, insetInlineEnd: 0, cursor: "ew-resize" }}
      >
        <span className="w-[3px] h-5 rounded-full bg-current opacity-50 group-hover:opacity-90 transition-opacity" />
      </button>

      {/* Modern floating hover card. Portaled to document.body so the card
          escapes every overflow/sticky/transformed ancestor on the board
          (the BoardBody scroll container was previously clipping it under
          the sticky date header). Fixed positioning is anchored to the bar's
          viewport rect and refreshed on scroll + resize. */}
      {showCard && !isInteracting && tooltipPos && typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            dir="rtl"
            className="fixed z-[120] pointer-events-none transition-opacity duration-150"
            style={{
              ...(tooltipPos.placement === "top"
                ? { bottom: tooltipPos.bottom }
                : { top: tooltipPos.top }),
              right: tooltipPos.right,
              minWidth: 260,
              maxWidth: 320,
            }}
          >
            <div className="relative rounded-2xl bg-card/90 dark:bg-card/85 backdrop-blur-md shadow-[0_10px_30px_-8px_rgba(15,23,42,0.25)] ring-1 ring-black/5 px-4 py-3 text-right">
              {/* Guest row */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  {reservation.is_vip && (
                    <Icon name="star" filled size="sm" className="text-amber-500 shrink-0" />
                  )}
                  <span className="text-[13px] font-bold text-foreground truncate">
                    {guestName}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: paymentColor ?? "#64748b",
                    backgroundColor: `color-mix(in srgb, ${paymentColor ?? "#64748b"} 18%, white)`,
                  }}
                >
                  {paymentLabel}
                </span>
              </div>

              {/* Room */}
              <div className="text-[11px] text-muted-foreground mb-2 truncate">
                <Icon name="bed" size="sm" className="inline-block me-1 -translate-y-0.5 opacity-70" />
                {roomLabel}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">כניסה</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {formatDate(reservation.segment_check_in)} · {checkInTimeLabel}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">יציאה</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {formatDate(reservation.segment_check_out)} · {checkOutTimeLabel}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">לילות</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {diffDays(reservation.segment_check_in, reservation.segment_check_out)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">אורחים</span>
                  <span className="text-foreground font-semibold tabular-nums">{totalGuests}</span>
                </div>

                {(() => {
                  // Show the Hebrew label from SOURCE_LABELS. Skip the row
                  // entirely if the stored value has no label — raw enum
                  // strings like "direct" are never shown to end users.
                  const sourceLabel = reservation.source
                    ? SOURCE_LABELS[reservation.source]
                    : ""
                  if (!sourceLabel) return null
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">מקור</span>
                      <span className="text-foreground font-semibold truncate">
                        {sourceLabel}
                      </span>
                    </div>
                  )
                })()}
                {(() => {
                  // For unpaid / partially-paid reservations show the
                  // outstanding balance INSTEAD of the total — the tooltip
                  // grid is tight and "how much is left to collect" is the
                  // actionable number for front-desk staff. Fully-paid and
                  // zero-balance reservations fall back to the total.
                  const total = reservation.total_price != null ? Number(reservation.total_price) : null
                  const rawBalance = reservation.balance_due != null ? Number(reservation.balance_due) : null
                  const balance = rawBalance != null && rawBalance > 0 ? rawBalance : 0
                  const isUnsettled =
                    reservation.payment_status === "unpaid" ||
                    reservation.payment_status === "partially_paid"
                  const showBalance = isUnsettled && balance > 0
                  const sym = currency === "ILS" ? "₪" : ""
                  if (showBalance) {
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">יתרה לתשלום</span>
                        <span className="text-foreground font-semibold tabular-nums">
                          {sym}{balance.toLocaleString()}
                        </span>
                      </div>
                    )
                  }
                  if (total == null) return null
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">סך הכל</span>
                      <span className="text-foreground font-semibold tabular-nums">
                        {sym}{total.toLocaleString()}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Smooth speech-bubble tail.
                  • 28×16 div clipped with a curved-triangle path so the arrow
                    has soft shoulders instead of a sharp rotated square.
                  • Re-uses the tooltip's own glass classes (bg-card/90 +
                    backdrop-blur-md) so the arrow inherits the exact
                    background, opacity, and blur — no visible seam.
                  • Centered under the tooltip via left-1/2 / -translate-x-1/2.
                  • Vertically: -14px places 2px of the arrow inside the
                    tooltip body (overlap hides the top edge).
                  • For bottom placement, rotate 180° and pin to top-[-14px]. */}
              <span
                aria-hidden
                className="absolute left-1/2 bg-card/90 dark:bg-card/85 backdrop-blur-md"
                style={{
                  width: 28,
                  height: 16,
                  [tooltipPos.placement === "top" ? "bottom" : "top"]: -14,
                  transform:
                    tooltipPos.placement === "top"
                      ? "translateX(-50%)"
                      : "translateX(-50%) rotate(180deg)",
                  clipPath:
                    "path('M 0 0 C 6 2, 10 12, 14 14 C 18 12, 22 2, 28 0 Z')",
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

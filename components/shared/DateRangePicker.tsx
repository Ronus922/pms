"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { he } from "date-fns/locale"
import { Icon } from "./Icon"

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  placeholder?: string
  className?: string
}

const WEEKDAY_LABELS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]

function parseIso(s: string): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function formatIL(d: Date | null): string {
  return d ? format(d, "dd/MM/yyyy") : ""
}

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "בחר תאריכים",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false)
  const [anchorMonth, setAnchorMonth] = useState<Date>(
    () => parseIso(from) ?? new Date(),
  )
  const [pendingStart, setPendingStart] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<Date | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const fromDate = parseIso(from)
  const toDate = parseIso(to)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Re-anchor when external `from` changes
  useEffect(() => {
    const d = parseIso(from)
    if (d) setAnchorMonth(startOfMonth(d))
  }, [from])

  // Position popover below trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const popoverWidth = 620
      // Anchor to the right edge of trigger (RTL-friendly)
      let right = vw - rect.right
      // If popover would overflow left edge, nudge right
      if (rect.right - popoverWidth < 8) {
        right = Math.max(8, vw - rect.left - popoverWidth)
      }
      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right,
        zIndex: 9999,
      })
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open])

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
      setPendingStart(null)
      setHovered(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setPendingStart(null)
        setHovered(null)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const handleDayClick = (day: Date) => {
    if (!pendingStart) {
      setPendingStart(day)
      setHovered(day)
      return
    }
    let start = pendingStart
    let end = day
    if (end < start) {
      const tmp = start
      start = end
      end = tmp
    }
    onChange(toIso(start), toIso(end))
    setPendingStart(null)
    setHovered(null)
    setOpen(false)
  }

  const earlyMonth = anchorMonth
  const laterMonth = addMonths(anchorMonth, 1)

  const displayText =
    fromDate && toDate ? `${formatIL(fromDate)} - ${formatIL(toDate)}` : ""

  // Range for highlighting (either finalized or pending + hover)
  const rangeStart = pendingStart ?? fromDate
  const rangeEnd = pendingStart ? hovered : toDate
  const normalizedRange =
    rangeStart && rangeEnd
      ? rangeStart < rangeEnd
        ? { start: rangeStart, end: rangeEnd }
        : { start: rangeEnd, end: rangeStart }
      : null

  const popover = open && mounted && (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-card rounded-2xl shadow-2xl border border-border/20 overflow-hidden"
      dir="rtl"
    >
      <div className="flex">
        <MonthGrid
          month={earlyMonth}
          normalizedRange={normalizedRange}
          pendingStart={pendingStart}
          fromDate={fromDate}
          toDate={toDate}
          onDayClick={handleDayClick}
          onHover={(d) => pendingStart && setHovered(d)}
          onPrevMonth={() => setAnchorMonth((m) => subMonths(m, 1))}
          showPrev
          showNext={false}
        />
        <div className="w-px bg-border/20" />
        <MonthGrid
          month={laterMonth}
          normalizedRange={normalizedRange}
          pendingStart={pendingStart}
          fromDate={fromDate}
          toDate={toDate}
          onDayClick={handleDayClick}
          onHover={(d) => pendingStart && setHovered(d)}
          onNextMonth={() => setAnchorMonth((m) => addMonths(m, 1))}
          showPrev={false}
          showNext
        />
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-card rounded-xl border border-border/30 flex items-center gap-3 px-4 min-h-[48px] hover:border-primary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 outline-none transition-colors ${className}`}
      >
        <span className="flex-1 text-sm font-bold text-right">
          {displayText || (
            <span className="text-muted-foreground font-normal">
              {placeholder}
            </span>
          )}
        </span>
        <Icon
          name="calendar_month"
          size="sm"
          className="text-muted-foreground shrink-0"
        />
      </button>
      {popover && createPortal(popover, document.body)}
    </>
  )
}

/* ── Month grid ─────────────────────────────────────────────── */

interface MonthGridProps {
  month: Date
  normalizedRange: { start: Date; end: Date } | null
  pendingStart: Date | null
  fromDate: Date | null
  toDate: Date | null
  onDayClick: (d: Date) => void
  onHover: (d: Date) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  showPrev: boolean
  showNext: boolean
}

function MonthGrid({
  month,
  normalizedRange,
  pendingStart,
  fromDate,
  toDate,
  onDayClick,
  onHover,
  onPrevMonth,
  onNextMonth,
  showPrev,
  showNext,
}: MonthGridProps) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today = new Date()

  return (
    <div className="p-4 min-w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 flex items-center justify-center">
          {showPrev && onPrevMonth && (
            <button
              type="button"
              onClick={onPrevMonth}
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"
              aria-label="חודש קודם"
            >
              <Icon name="chevron_right" size="sm" />
            </button>
          )}
        </div>
        <div className="text-sm font-bold text-foreground text-center">
          {format(month, "MMMM yyyy", { locale: he })}
        </div>
        <div className="w-9 h-9 flex items-center justify-center">
          {showNext && onNextMonth && (
            <button
              type="button"
              onClick={onNextMonth}
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"
              aria-label="חודש הבא"
            >
              <Icon name="chevron_left" size="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS_HE.map((w) => (
          <div
            key={w}
            className="h-8 flex items-center justify-center text-[11px] font-bold text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const outside = !isSameMonth(day, month)
          const isStart =
            (fromDate && isSameDay(day, fromDate)) ||
            (pendingStart && isSameDay(day, pendingStart))
          const isEnd = toDate && isSameDay(day, toDate) && !pendingStart
          const inRange =
            normalizedRange &&
            isWithinInterval(day, {
              start: normalizedRange.start,
              end: normalizedRange.end,
            })
          const isRangeEdge = isStart || isEnd
          const isToday = isSameDay(day, today)

          let base =
            "h-9 w-full text-xs font-medium flex items-center justify-center transition-colors"
          let state = ""
          if (outside) {
            state = "text-muted-foreground/40 hover:bg-accent/50 rounded-lg"
          } else if (isRangeEdge) {
            state = "bg-primary text-white font-bold rounded-lg shadow-sm"
          } else if (inRange) {
            state = "bg-primary/15 text-primary font-bold"
          } else if (isToday) {
            state =
              "text-primary font-bold ring-1 ring-primary/40 rounded-lg hover:bg-accent"
          } else {
            state = "text-foreground hover:bg-accent rounded-lg"
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onHover(day)}
              className={`${base} ${state}`}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { VIEW_DAYS, VIEW_LABEL } from "./board-constants"
import type { BoardView } from "./board-types"
import { addDays, todayIso } from "./board-rules"
import { useCalendarStore } from "@/lib/stores/calendar-store"

interface LegendItem {
  value: string
  label: string
  color: string | null
}

interface BoardHeaderProps {
  startDateIso: string
  view: BoardView
  onViewChange: (view: BoardView) => void
  onJumpToToday: () => void
  onPrev: () => void
  onNext: () => void
  currency: string
  visibleRoomCount: number
  occupiedCount: number
  /** Payment status legend — same source of truth as the reservation bar colours. */
  legend: LegendItem[]
}

function formatHebrewDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export function BoardHeader({
  startDateIso,
  view,
  onViewChange,
  onJumpToToday,
  onPrev,
  onNext,
  legend,
}: BoardHeaderProps) {
  const days = VIEW_DAYS[view]
  const endIso = addDays(startDateIso, days - 1)
  const isToday = startDateIso === todayIso()
  const setStartDate = useCalendarStore((s) => s.setStartDate)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  function handleDatePick(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (!value) return
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return
    setStartDate(new Date(y, m - 1, d))
  }

  function openPicker() {
    const input = dateInputRef.current
    if (!input) return
    // showPicker() is the only reliable way to open a native date picker
    // when the <input> is visually hidden (opacity-0). Without it, some
    // browsers focus the input but never reveal the calendar.
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker()
        return
      } catch {
        // Fall through to focus() if showPicker is unsupported in context.
      }
    }
    input.focus()
    input.click()
  }

  return (
    // Explicit dir="rtl" so source order deterministically maps to visual
    // right→left. Visual layout (right to left):
    //   [ title · ← next-date · date · → prev-date · היום ]   ←┐
    //                              ┌──────────────────────────┘
    //   [ week | two-weeks | month ]                centered
    //                              ┌──────────────────────────┐
    //   [ payment-status legend · VIP ]            far left   │
    <div
      dir="rtl"
      className="flex items-center justify-between gap-3 rounded-2xl bg-card border border-border/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-3 flex-wrap"
    >
      {/* 1 · Date + navigation + today (visual right) */}
      <div className="flex items-center gap-2">
        <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">יומן חדרים</h1>

        <div className="flex items-center gap-0.5 rounded-full bg-accent/40 px-1 py-0.5">
          {/* RTL row, source order 1 renders visually on the RIGHT.
              Right side = backward (older dates). In RTL, a right-pointing
              chevron (→) reads as "go back" (against reading flow). */}
          <button
            onClick={onPrev}
            className="w-8 h-8 rounded-full hover:bg-card flex items-center justify-center"
            aria-label="תקופה קודמת"
            title="תקופה קודמת"
          >
            <Icon name="chevron_right" size="sm" />
          </button>

          {/* Clickable date range — a button visually shows the date and an
              invisible <input type="date"> sits behind it. The button calls
              showPicker() so the native calendar opens reliably across
              Chromium/Firefox/Safari, even when the input is opacity-0. */}
          <button
            type="button"
            onClick={openPicker}
            className="relative inline-flex items-center min-h-[44px] px-3 py-1 cursor-pointer rounded-full hover:bg-card/60 transition-colors"
            title="לחץ לבחירת תאריך"
            aria-label="בחר תאריך התחלה"
          >
            <span
              dir="ltr"
              className="text-[12.5px] font-bold text-foreground tabular-nums whitespace-nowrap pointer-events-none"
            >
              {formatHebrewDate(startDateIso)} - {formatHebrewDate(endIso)}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={startDateIso}
              onChange={handleDatePick}
              tabIndex={-1}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            />
          </button>

          {/* Left side = forward (upcoming). Left-pointing chevron (←) reads
              as "go forward" in RTL (same direction as the reading flow). */}
          <button
            onClick={onNext}
            className="w-8 h-8 rounded-full hover:bg-card flex items-center justify-center"
            aria-label="תקופה הבאה"
            title="תקופה הבאה"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        </div>

        <button
          onClick={onJumpToToday}
          disabled={isToday}
          className={`min-h-[36px] px-5 py-1.5 rounded-full text-[12.5px] font-bold transition-colors ${
            isToday
              ? "bg-primary/10 text-primary cursor-default"
              : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          היום
        </button>
      </div>

      {/* 2 · View tabs — week / two-weeks / month (center) */}
      <div
        role="tablist"
        aria-label="טווח תצוגה"
        className="inline-flex rounded-full bg-accent/50 p-0.5"
      >
        {(["week", "two-weeks", "month"] as BoardView[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => onViewChange(v)}
            className={`min-h-[36px] px-5 py-1.5 text-[12.5px] font-bold rounded-full transition-all ${
              view === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* 3 · Payment-status legend (visual left) — same hex as the reservation
          bars in the grid, so the legend always stays in sync. */}
      <div className="flex items-center gap-3 flex-wrap">
        {legend.map((item) => (
          <span
            key={item.value}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-semibold"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color ?? "#64748b" }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

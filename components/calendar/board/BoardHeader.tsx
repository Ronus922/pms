"use client"

import { useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { VIEW_DAYS, VIEW_LABEL } from "./board-constants"
import type { BoardView } from "./board-types"
import { addDays, todayIso } from "./board-rules"
import { useCalendarStore } from "@/lib/stores/calendar-store"

interface BoardHeaderProps {
  startDateIso: string
  view: BoardView
  onViewChange: (view: BoardView) => void
  onJumpToToday: () => void
  onPrev: () => void
  onNext: () => void
  /** Total room units — shown as a badge next to the title. */
  unitsCount: number
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
  unitsCount,
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
    // Bare toolbar row (matches reference .cal-head — no card). RTL: title +
    // count on the right; view segmented + date nav + today grouped on the left.
    <div dir="rtl" className="flex items-center gap-3 flex-wrap px-0.5">
      {/* Title + units count (visual right) */}
      <h1 className="text-[23px] font-extrabold tracking-[-0.3px] text-foreground whitespace-nowrap">
        יומן חדרים
      </h1>
      <span className="inline-flex items-center rounded-lg bg-accent px-2.5 py-[3px] text-[13.5px] font-bold text-muted-foreground tabular-nums whitespace-nowrap">
        {unitsCount} יחידות
      </span>

      <div className="flex-1" />

      {/* Left cluster: segmented view · date nav · today (reference tokens) */}
      <div className="flex items-center gap-2.5">
        {/* View segmented control */}
        <div role="tablist" aria-label="טווח תצוגה" className="cal-seg">
          {(["week", "two-weeks", "month"] as BoardView[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => onViewChange(v)}
              className={`cal-seg-btn ${view === v ? "active" : ""}`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="cal-datenav">
          <button
            onClick={onPrev}
            className="cal-dn-btn"
            aria-label="תקופה קודמת"
            title="תקופה קודמת"
          >
            <Icon name="chevron_right" size="sm" />
          </button>

          {/* Clickable date range — invisible native <input type="date"> behind
              a button that calls showPicker() for reliable cross-browser open. */}
          <button
            type="button"
            onClick={openPicker}
            className="cal-dn-range relative inline-flex items-center cursor-pointer"
            title="לחץ לבחירת תאריך"
            aria-label="בחר תאריך התחלה"
          >
            <span dir="ltr" className="pointer-events-none">
              {formatHebrewDate(startDateIso)} – {formatHebrewDate(endIso)}
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

          <button
            onClick={onNext}
            className="cal-dn-btn"
            aria-label="תקופה הבאה"
            title="תקופה הבאה"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        </div>

        <button onClick={onJumpToToday} disabled={isToday} className="cal-dn-today">
          היום
        </button>
      </div>
    </div>
  )
}

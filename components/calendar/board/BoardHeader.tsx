"use client"

import { Icon } from "@/components/shared/Icon"
import { VIEW_DAYS, VIEW_LABEL } from "./board-constants"
import type { BoardView } from "./board-types"
import { addDays, todayIso } from "./board-rules"

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
            aria-label="התאריכים הקודמים"
            title="התאריכים הקודמים"
          >
            <Icon name="chevron_right" size="sm" />
          </button>

          {/* Force LTR on the date range itself so it reads earlier → later
              left-to-right (20/04/2026 - 10/05/2026), not end-first. */}
          <span
            dir="ltr"
            className="px-3 py-1 text-[12.5px] font-bold text-foreground tabular-nums whitespace-nowrap"
          >
            {formatHebrewDate(startDateIso)} - {formatHebrewDate(endIso)}
          </span>

          {/* Left side = forward (upcoming). Left-pointing chevron (←) reads
              as "go forward" in RTL (same direction as the reading flow). */}
          <button
            onClick={onNext}
            className="w-8 h-8 rounded-full hover:bg-card flex items-center justify-center"
            aria-label="התאריכים הבאים"
            title="התאריכים הבאים"
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

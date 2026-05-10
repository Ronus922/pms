"use client"

import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import type {
  DateFilterType,
  StatusFilterValue,
  PresetKey,
  ReservationSearchFilters,
} from "@/lib/actions/reservation-search"

/* ── Preset definitions ────────────────────────────────────── */

interface PresetDef {
  key: PresetKey
  label: string
  icon: string
}

const PRESETS: PresetDef[] = [
  { key: "created_24h", label: "נוצרו ב-24 שעות", icon: "schedule" },
  { key: "cancelled_24h", label: "בוטלו ביממה האחרונה", icon: "event_busy" },
  { key: "pending", label: "הזמנות ממתינות", icon: "hourglass_top" },
  { key: "unpaid", label: "הזמנות שלא שולמו", icon: "money_off" },
  { key: "in_house", label: "שוהים", icon: "hotel" },
  { key: "arrivals_today", label: "הגעות היום", icon: "login" },
  { key: "departures_today", label: "עזיבות היום", icon: "logout" },
]

const DATE_TYPE_OPTIONS: { value: DateFilterType; label: string }[] = [
  { value: "", label: "סוג תאריך" },
  { value: "arrivals", label: "הגעות" },
  { value: "departures", label: "עזיבות" },
  { value: "created", label: "יצירה" },
  { value: "cancelled", label: "בוטל" },
]

const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "", label: "כל הסטטוסים" },
  { value: "confirmed", label: "אושר" },
  { value: "no_show", label: "גנוב" },
  { value: "maintenance", label: "תחזוקה" },
  { value: "unpaid", label: "לא שולם" },
]

/* ── Component ─────────────────────────────────────────────── */

interface Props {
  filters: ReservationSearchFilters
  onChange: (filters: ReservationSearchFilters) => void
  onClearAll: () => void
  agents: string[]
  total: number
}

export function ReservationFilters({ filters, onChange, onClearAll, agents, total }: Props) {
  const hasActive =
    filters.dateType !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.agent !== "" ||
    filters.status !== "" ||
    filters.presets.length > 0

  function update(patch: Partial<ReservationSearchFilters>) {
    onChange({ ...filters, ...patch })
  }

  function togglePreset(key: PresetKey) {
    const next = filters.presets.includes(key)
      ? filters.presets.filter((p) => p !== key)
      : [...filters.presets, key]
    update({ presets: next })
  }

  const selectClass =
    "bg-accent border border-border/40 rounded-xl px-4 py-3 pe-10 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-h-[48px] appearance-none cursor-pointer select-arrow"

  const inputClass =
    "bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-h-[48px]"

  return (
    <div className="space-y-4">
      {/* ── Row 1: Filter selects ── */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Date type */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-xs font-bold text-muted-foreground">סוג תאריך</label>
          <select
            value={filters.dateType}
            onChange={(e) => update({ dateType: e.target.value as DateFilterType })}
            className={selectClass}
          >
            {DATE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-xs font-bold text-muted-foreground">מתאריך</label>
          <DateInput
            value={filters.dateFrom}
            onChange={(v) => update({ dateFrom: v })}
          />
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-xs font-bold text-muted-foreground">עד תאריך</label>
          <DateInput
            value={filters.dateTo}
            onChange={(v) => update({ dateTo: v })}
            minDate={filters.dateFrom}
          />
        </div>

        {/* Agent */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-xs font-bold text-muted-foreground">סוכן</label>
          <select
            value={filters.agent}
            onChange={(e) => update({ agent: e.target.value })}
            className={selectClass}
          >
            <option value="">כל הסוכנים</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-xs font-bold text-muted-foreground">סטטוס</label>
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as StatusFilterValue })}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Clear all */}
        {hasActive && (
          <button
            onClick={onClearAll}
            className="border border-border/30 text-muted-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors min-h-[48px] px-5 py-3 flex items-center gap-2"
          >
            <Icon name="filter_alt_off" size="sm" />
            נקה הכל
          </button>
        )}
      </div>

      {/* ── Row 2: Quick presets ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-muted-foreground ml-2">סינון מהיר:</span>
        {PRESETS.map((preset) => {
          const active = filters.presets.includes(preset.key)
          return (
            <button
              key={preset.key}
              onClick={() => togglePreset(preset.key)}
              className={`
                inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all
                min-h-[36px]
                ${active
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-accent text-muted-foreground border border-border/30 hover:bg-border/30"
                }
              `}
            >
              <Icon name={preset.icon} size="sm" />
              {preset.label}
              {active && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePreset(preset.key)
                  }}
                  className="mr-0.5 w-4 h-4 rounded-full bg-primary/20 hover:bg-primary/40 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Icon name="close" className="!text-[10px]" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Results count ── */}
      {hasActive && (
        <div className="text-xs font-bold text-muted-foreground">
          {total} תוצאות
        </div>
      )}
    </div>
  )
}

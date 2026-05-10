"use client"

import { DateRangePicker } from "@/components/shared/DateRangePicker"
import { InfoTooltip } from "@/components/shared/InfoTooltip"
import type { BulkUpdateScope, Weekday } from "@/lib/types/bulk-room-update"
import { ALL_WEEKDAYS } from "@/lib/types/bulk-room-update"

const HELP = {
  dateRange:
    "טווח התאריכים שעליהם יחולו השינויים. בחר תאריך התחלה וסיום בלחיצה על התאריכון.",
  weekdays:
    "אילו ימי שבוע לעדכן בתוך טווח התאריכים. דוגמה: לעדכן רק את שישי־שבת מבלי לגעת בשאר הימים.",
} as const

const WEEKDAY_SHORT_HE: Record<Weekday, string> = {
  0: "א",
  1: "ב",
  2: "ג",
  3: "ד",
  4: "ה",
  5: "ו",
  6: "ש",
}

interface Props {
  scope: BulkUpdateScope
  setScope: (updater: (prev: BulkUpdateScope) => BulkUpdateScope) => void
  toggleWeekday: (day: Weekday) => void
  selectAllWeekdays: () => void
  clearWeekdays: () => void
}

export function DatesSection({
  scope,
  setScope,
  toggleWeekday,
  selectAllWeekdays,
  clearWeekdays,
}: Props) {
  return (
    <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <h3 className="text-base font-bold text-foreground">תאריכים</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* Date range */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              טווח תאריכים
            </label>
            <InfoTooltip text={HELP.dateRange} />
          </div>
          <DateRangePicker
            from={scope.dateFrom}
            to={scope.dateTo}
            onChange={(from, to) =>
              setScope((s) => ({ ...s, dateFrom: from, dateTo: to }))
            }
          />
        </div>

        {/* Weekdays */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                ימים בשבוע
              </label>
              <InfoTooltip text={HELP.weekdays} />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={selectAllWeekdays}
                className="text-[10px] font-bold text-primary hover:underline px-1.5 py-0.5"
              >
                הכל
              </button>
              <span className="text-[10px] text-muted-foreground">·</span>
              <button
                type="button"
                onClick={clearWeekdays}
                className="text-[10px] font-bold text-muted-foreground hover:underline px-1.5 py-0.5"
              >
                נקה
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_WEEKDAYS.map((d) => {
              const active = scope.weekdays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  aria-pressed={active}
                  className={`h-11 w-11 min-h-[44px] min-w-[44px] text-xs font-bold rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "bg-accent text-muted-foreground hover:bg-accent/70"
                  }`}
                >
                  {WEEKDAY_SHORT_HE[d]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Icon } from "@/components/shared/Icon"
import { useCalendarStore, type CalendarView } from "@/lib/stores/calendar-store"

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "week", label: "שבוע" },
  { value: "two-weeks", label: "שבועיים" },
  { value: "month", label: "חודש" },
]

function formatDateRange(start: Date, days: number): string {
  const end = new Date(start)
  end.setDate(end.getDate() + days - 1)

  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} - ${end.getDate()} ${months[start.getMonth()]}, ${start.getFullYear()}`
  }
  return `${start.getDate()} ${months[start.getMonth()]} - ${end.getDate()} ${months[end.getMonth()]}, ${end.getFullYear()}`
}

function getDaysForView(view: CalendarView): number {
  switch (view) {
    case "week": return 7
    case "two-weeks": return 14
    case "month": return 28
  }
}

export function CalendarNavigation() {
  const { startDate, view, setView, goToday, goForward, goBackward } = useCalendarStore()
  const days = getDaysForView(view)

  return (
    <div className="p-4 border-b border-border/50 flex flex-wrap justify-between items-center gap-4 bg-accent/30">
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-bold font-headline">יומן חדרים</h3>

        {/* Date navigation */}
        <div className="flex items-center bg-card rounded-xl border border-border p-1">
          <button onClick={goBackward} className="p-2.5 hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Icon name="chevron_right" size="sm" />
          </button>
          <span className="px-3 text-sm font-bold min-w-[200px] text-center">
            {formatDateRange(startDate, days)}
          </span>
          <button onClick={goForward} className="p-2.5 hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Icon name="chevron_left" size="sm" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="px-4 py-2.5 text-xs font-bold text-primary bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors min-h-[44px]"
        >
          היום
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* View switcher */}
        <div className="flex bg-card rounded-xl border border-border p-1 gap-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-colors min-h-[44px] ${
                view === opt.value
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status legend */}
        <div className="hidden lg:flex items-center gap-3 mr-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#005da7]" />
            <span className="text-[11px] text-muted-foreground">מאושר</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[11px] text-muted-foreground">ממתין</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-muted-foreground">שולם</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-[11px] text-muted-foreground">VIP</span>
          </div>
        </div>
      </div>
    </div>
  )
}

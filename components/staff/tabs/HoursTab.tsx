"use client"

import { Icon } from "@/components/shared/Icon"

interface HoursTabProps {
  employeeId: string
}

export function HoursTab({ employeeId: _employeeId }: HoursTabProps) {
  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="schedule" size="md" className="text-primary" />
          <h3 className="text-base font-bold text-foreground">דיווח שעות</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-accent p-4">
            <p className="text-xs text-muted-foreground mb-1">שעות החודש</p>
            <p className="text-2xl font-extrabold text-primary tabular-nums">—</p>
          </div>
          <div className="rounded-lg bg-accent p-4">
            <p className="text-xs text-muted-foreground mb-1">משמרות</p>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">—</p>
          </div>
          <div className="rounded-lg bg-accent p-4">
            <p className="text-xs text-muted-foreground mb-1">שעות נוספות</p>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">—</p>
          </div>
        </div>
      </div>

      {/* Empty placeholder for entries */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-base font-bold text-foreground mb-3">היסטוריה</h3>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Icon name="schedule" size="xl" className="opacity-20" />
          <p className="text-sm font-medium">אין דיווחי שעות עדיין</p>
          <p className="text-xs">דיווחי שעות שיוזנו יוצגו כאן</p>
        </div>
      </div>
    </div>
  )
}

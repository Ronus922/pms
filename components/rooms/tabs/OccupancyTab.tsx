"use client"

import type { RoomFormStore } from "@/lib/stores/room-form-store"
import { NumberStepper } from "@/components/shared/NumberStepper"

interface OccupancyTabProps {
  store: RoomFormStore
}

export function OccupancyTab({ store }: OccupancyTabProps) {
  const hasValidationError = store.default_guests > store.max_occupancy

  return (
    <div className="space-y-4" dir="rtl">
      {/* max_occupancy */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
        <NumberStepper
          label="תפוסה מקסימלית"
          value={store.max_occupancy}
          onChange={(v) => store.setField("max_occupancy", v)}
          min={1}
          max={20}
        />
      </div>

      {/* default_guests - highlighted */}
      <div className="rounded-[20px] p-5 bg-primary/5 border border-primary/20">
        <NumberStepper
          label="אורחים ברירת מחדל"
          value={store.default_guests}
          onChange={(v) => store.setField("default_guests", v)}
          min={1}
          max={20}
        />
        <p className="text-xs text-muted-foreground text-center mt-2">
          קובע את המחיר הבסיסי - אורחים מעבר למספר זה יחויבו בתוספת
        </p>
        {hasValidationError && (
          <p className="text-xs text-destructive text-center mt-2 font-bold">
            מספר אורחים ברירת מחדל לא יכול להיות גבוה מהתפוסה המקסימלית
          </p>
        )}
      </div>

      {/* max_adults */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
        <NumberStepper
          label="מבוגרים מקסימום"
          value={store.max_adults}
          onChange={(v) => store.setField("max_adults", v)}
          min={1}
          max={20}
        />
      </div>

      {/* max_children */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
        <NumberStepper
          label="ילדים מקסימום"
          value={store.max_children}
          onChange={(v) => store.setField("max_children", v)}
          min={0}
          max={10}
        />
      </div>

      {/* max_infants */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
        <NumberStepper
          label="תינוקות מקסימום"
          value={store.max_infants}
          onChange={(v) => store.setField("max_infants", v)}
          min={0}
          max={5}
        />
      </div>
    </div>
  )
}

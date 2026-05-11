"use client"

import type { RoomFormStore } from "@/lib/stores/room-form-store"
import { NumberStepper } from "@/components/shared/NumberStepper"

interface BedsTabProps {
  store: RoomFormStore
}

export function BedsTab({ store }: BedsTabProps) {
  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NumberStepper
            label="מיטות יחיד"
            value={store.single_beds}
            onChange={(v) => store.setField("single_beds", v)}
            min={0}
            max={10}
          />
          <NumberStepper
            label="מיטות זוגיות"
            value={store.double_beds}
            onChange={(v) => store.setField("double_beds", v)}
            min={0}
            max={10}
          />
          <NumberStepper
            label="מיטות קווין"
            value={store.queen_beds}
            onChange={(v) => store.setField("queen_beds", v)}
            min={0}
            max={10}
          />
          <NumberStepper
            label="ספות נפתחות"
            value={store.sofa_beds}
            onChange={(v) => store.setField("sofa_beds", v)}
            min={0}
            max={10}
          />
          <NumberStepper
            label="עריסות"
            value={store.cribs}
            onChange={(v) => store.setField("cribs", v)}
            min={0}
            max={5}
          />
        </div>
      </div>

      {/* sleeping_arrangement_note */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-muted-foreground">הערות לסידור השינה</label>
        <textarea
          value={store.sleeping_arrangement_note}
          onChange={(e) => store.setField("sleeping_arrangement_note", e.target.value)}
          placeholder="לדוגמה: ניתן לחבר שתי מיטות יחיד למיטה זוגית"
          rows={3}
          className="w-full rounded-xl border-0 bg-accent px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>
    </div>
  )
}

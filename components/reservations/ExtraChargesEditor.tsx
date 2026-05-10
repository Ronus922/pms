"use client"

import { Icon } from "@/components/shared/Icon"
import { inputClass, selectClass } from "@/components/shared/FormField"
import { EXTRA_CHARGE_TYPES } from "@/lib/constants/reservation"
import type { ExtraChargeItem } from "@/lib/stores/reservation-form-store"

interface ExtraChargesEditorProps {
  charges: ExtraChargeItem[]
  currency: string
  onAdd: (charge: ExtraChargeItem) => void
  onUpdate: (id: string, updates: Partial<ExtraChargeItem>) => void
  onRemove: (id: string) => void
}

export function ExtraChargesEditor({ charges, currency, onAdd, onUpdate, onRemove }: ExtraChargesEditorProps) {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "?" : "?"

  function handleAdd() {
    onAdd({
      id: Date.now().toString(),
      type: "other",
      description: "",
      amount: 0,
    })
  }

  const total = charges.reduce((s, c) => s + (c.amount || 0), 0)

  return (
    <div className="space-y-3">
      {charges.map((charge) => (
        <div key={charge.id} className="flex items-start gap-3 bg-accent/50 rounded-xl p-4">
          <div className="flex-1 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            <select
              value={charge.type}
              onChange={(e) => onUpdate(charge.id, { type: e.target.value })}
              className={selectClass}
            >
              {EXTRA_CHARGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={charge.description}
              onChange={(e) => onUpdate(charge.id, { description: e.target.value })}
              placeholder="תיאור (אופציונלי)"
              className={inputClass}
            />
            <div className="relative">
              <input
                type="number"
                value={charge.amount || ""}
                onChange={(e) => onUpdate(charge.id, { amount: Number(e.target.value) || 0 })}
                placeholder="0"
                min={0}
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                {sym}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(charge.id)}
            className="mt-3 p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Icon name="delete" size="sm" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-border/40 rounded-xl text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[44px]"
      >
        <Icon name="add" size="sm" />
        הוסף תוספת
      </button>

      {charges.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/20 pt-3">
          <span className="text-sm font-bold text-muted-foreground">סה״כ תוספות</span>
          <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
            {sym}{total.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

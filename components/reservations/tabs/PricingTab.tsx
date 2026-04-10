"use client"

import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { Icon } from "@/components/shared/Icon"

const CURRENCIES = [
  { value: "ILS", label: "₪ ILS" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
]

export function PricingTab() {
  const store = useReservationFormStore()

  const currencySymbol = store.currency === "USD" ? "$" : store.currency === "EUR" ? "€" : "₪"

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="מחיר ללילה" required error={store.errors.pricePerNight}>
          <div className="relative">
            <input type="number" className={`${inputClass} pl-12`} dir="ltr"
              value={store.pricePerNight || ""}
              onChange={(e) => store.setField("pricePerNight", Number(e.target.value) || 0)}
              placeholder="0" min={0} step={10} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">
              {currencySymbol}
            </span>
          </div>
        </FormField>

        <FormField label="מטבע">
          <select className={selectClass} value={store.currency}
            onChange={(e) => store.setField("currency", e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="מספר לילות">
          <input type="text" className={`${inputClass} bg-accent/50 cursor-not-allowed`}
            value={store.nights} readOnly dir="ltr" />
        </FormField>

        <FormField label="סכום בסיס">
          <input type="text" className={`${inputClass} bg-accent/50 cursor-not-allowed font-bold`}
            value={`${store.baseAmount.toLocaleString()} ${currencySymbol}`} readOnly dir="ltr" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="הנחה בסכום">
          <input type="number" className={inputClass} dir="ltr"
            value={store.discountAmount || ""}
            onChange={(e) => {
              store.setField("discountAmount", Number(e.target.value) || 0)
              if (Number(e.target.value) > 0) store.setField("discountPercent", 0)
            }}
            placeholder="0" min={0} />
        </FormField>

        <FormField label="הנחה באחוז">
          <div className="relative">
            <input type="number" className={`${inputClass} pl-8`} dir="ltr"
              value={store.discountPercent || ""}
              onChange={(e) => {
                store.setField("discountPercent", Math.min(100, Number(e.target.value) || 0))
                if (Number(e.target.value) > 0) store.setField("discountAmount", 0)
              }}
              placeholder="0" min={0} max={100} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="חיובים נוספים">
          <input type="number" className={inputClass} dir="ltr"
            value={store.extraCharges || ""}
            onChange={(e) => store.setField("extraCharges", Number(e.target.value) || 0)}
            placeholder="0" min={0} />
        </FormField>

        <FormField label="מיסים (17%)">
          <input type="text" className={`${inputClass} bg-accent/50 cursor-not-allowed`}
            value={`${store.taxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currencySymbol}`}
            readOnly dir="ltr" />
        </FormField>
      </div>

      <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={store.taxExempt}
            onChange={(e) => store.setField("taxExempt", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
          <Icon name="public" size="sm" className="text-primary" />
          <span className="text-sm">ללא מע"מ — תושב חוץ</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="פיקדון">
          <input type="number" className={inputClass} dir="ltr"
            value={store.deposit || ""}
            onChange={(e) => store.setField("deposit", Number(e.target.value) || 0)}
            placeholder="0" min={0} />
        </FormField>

        <FormField label="סכום ששולם">
          <input type="number" className={inputClass} dir="ltr"
            value={store.amountPaid || ""}
            onChange={(e) => store.setField("amountPaid", Number(e.target.value) || 0)}
            placeholder="0" min={0} />
        </FormField>
      </div>

      {/* Summary totals */}
      <div className="border-t border-border/50 pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">סכום כולל</span>
          <span className="text-2xl font-extrabold text-primary">
            {store.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
          </span>
        </div>

        {store.discountTotal > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">הנחה</span>
            <span className="text-emerald-600 font-bold">
              -{store.discountTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-sm font-bold">יתרה לתשלום</span>
          <span className={`text-lg font-extrabold ${store.balanceDue > 0 ? "text-destructive" : "text-emerald-600"}`}>
            {store.balanceDue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
          </span>
        </div>
      </div>
    </div>
  )
}

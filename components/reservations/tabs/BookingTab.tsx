"use client"

import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { Icon } from "@/components/shared/Icon"
import { BOOKING_SOURCE_OPTIONS, RESERVATION_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/constants/reservation"
import { PAYMENT_METHODS } from "@/lib/constants/payments"

export function BookingTab() {
  const store = useReservationFormStore()
  const now = new Date()
  const createdAt = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  return (
    <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
          <Icon name="book_online" />
        </div>
        <h2 className="text-xl font-bold font-headline">פרטי הזמנה</h2>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField label="מקור הזמנה" required error={store.errors.source}>
            <select className={selectClass} value={store.source}
              onChange={(e) => store.setField("source", e.target.value)}>
              {BOOKING_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="מקור פרסום">
            <input type="text" className={inputClass} value={store.adSource}
              onChange={(e) => store.setField("adSource", e.target.value)} placeholder="Google, Facebook..." />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <FormField label="סטטוס הזמנה" required>
            <select className={selectClass} value={store.status}
              onChange={(e) => store.setField("status", e.target.value)}>
              {RESERVATION_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="סטטוס תשלום" required error={store.errors.paymentStatus}>
            <select className={selectClass} value={store.paymentStatus}
              onChange={(e) => store.setField("paymentStatus", e.target.value)}>
              {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <FormField label="שיטת תשלום">
            <select className={selectClass} value={store.paymentMethod}
              onChange={(e) => store.setField("paymentMethod", e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>
          <FormField label="מספר עסקה חיצוני">
            <input type="text" className={inputClass} value={store.externalTransactionId} dir="ltr"
              onChange={(e) => store.setField("externalTransactionId", e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <FormField label="מזהה הזמנה חיצוני">
            <input type="text" className={inputClass} value={store.externalId} dir="ltr"
              onChange={(e) => store.setField("externalId", e.target.value)} placeholder="Channel Manager ID" />
          </FormField>
          <FormField label="תאריך יצירה">
            <div className="w-full bg-accent rounded-[20px] px-5 py-4 text-sm text-muted-foreground cursor-not-allowed">{createdAt}</div>
          </FormField>
        </div>

        <div className="h-px bg-border/10" />

        <FormField label="הערות כלליות">
          <textarea className={textareaClass} rows={3} value={store.generalNotes}
            onChange={(e) => store.setField("generalNotes", e.target.value)}
            placeholder="הערות שיוצגו לצוות הקבלה..." />
        </FormField>

        <FormField label="הערות פנימיות">
          <textarea className={textareaClass} rows={3} value={store.internalNotes}
            onChange={(e) => store.setField("internalNotes", e.target.value)}
            placeholder="הערות פנימיות (לא יוצגו לאורח)..." />
        </FormField>
      </div>
    </div>
  )
}

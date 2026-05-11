"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { getStatusColorClass } from "@/components/reservations/StatusPill"
import { getSourceColorClass } from "@/components/reservations/SourceBadge"
import { SmartField } from "@/components/reservations/FieldLock"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { BOOKING_SOURCE_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/constants/reservation"
import { LANGUAGES, COUNTRIES } from "@/lib/constants/localization"

/* Apply a status color to the select itself (bg + text) instead of a pill below. */
function tintedSelectClass(colorClass: string) {
  if (!colorClass) return selectClass
  return `${selectClass.replace("bg-accent", "")} ${colorClass} font-bold`
}

/* ── Helpers — same visual patterns as Step1Guest ──────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ToggleCard({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`w-12 h-7 rounded-full transition-colors relative ${
            checked ? "bg-primary" : "bg-border/40"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={label}
        >
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-0.5" : "left-[calc(100%-1.625rem)]"
          }`} />
        </button>
      </div>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────── */

export function EditStep1Guest() {
  const store = useReservationEditStore()
  const { data, isExternal } = store

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Booking Source + Payment Status ──────────────────
             Reservation-status is intentionally HIDDEN here to match the
             create form (see Step1Guest.tsx). The underlying `data.status`
             stays on the store and is persisted by updateReservation —
             check-in / check-out / cancel live on the action icons + status
             pill at the top of the panel, not inside this step. */}
      <SectionCard title="מקור הזמנה וסטטוס תשלום">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {/* Source */}
          <SmartField isExternal={isExternal} lockType={isExternal ? "locked" : "editable"}>
            <FormField label="מקור הזמנה" required>
              <select
                value={data.source}
                onChange={(e) => store.setField("source", e.target.value)}
                className={tintedSelectClass(getSourceColorClass(data.source))}
                disabled={isExternal}
              >
                <option value="">בחר מקור...</option>
                {BOOKING_SOURCE_OPTIONS.filter((s) => s.value).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>
          </SmartField>

          {/* Payment Status */}
          <FormField label="סטטוס תשלום">
            <select
              value={data.paymentStatus}
              onChange={(e) => store.setField("paymentStatus", e.target.value)}
              className={tintedSelectClass(getStatusColorClass("payment", data.paymentStatus))}
            >
              {PAYMENT_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </FormField>
        </div>
      </SectionCard>

      {/* ── 2. Guest Information ─────────────────────────────── */}
      <SectionCard title="פרטי אורח">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="שם פרטי" required>
              <input type="text" value={data.firstName} onChange={(e) => store.setField("firstName", e.target.value)} placeholder="שם פרטי" className={inputClass} />
            </FormField>
          </SmartField>

          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="שם משפחה" required>
              <input type="text" value={data.lastName} onChange={(e) => store.setField("lastName", e.target.value)} placeholder="שם משפחה" className={inputClass} />
            </FormField>
          </SmartField>

          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="טלפון" required>
              <div className="relative">
                <input type="tel" value={data.phone} onChange={(e) => store.setField("phone", e.target.value)} placeholder="050-0000000" dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none"><Icon name="phone" size="sm" /></div>
              </div>
            </FormField>
          </SmartField>

          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="אימייל">
              <div className="relative">
                <input type="email" value={data.email} onChange={(e) => store.setField("email", e.target.value)} placeholder="email@example.com" dir="ltr" className={`${inputClass} pe-12 text-start`} />
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none"><Icon name="email" size="sm" /></div>
              </div>
            </FormField>
          </SmartField>

          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="ת.ז / דרכון">
              <div className="relative">
                <input type="text" value={data.idNumber} onChange={(e) => store.setField("idNumber", e.target.value)} placeholder="מספר מזהה" dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none"><Icon name="badge" size="sm" /></div>
              </div>
            </FormField>
          </SmartField>

          <FormField label="שפה">
            <div className="relative">
              <select value={data.language} onChange={(e) => store.setField("language", e.target.value)} className={selectClass}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none"><Icon name="translate" size="sm" /></div>
            </div>
          </FormField>

          <FormField label="מדינה">
            <div className="relative">
              <select value={data.country} onChange={(e) => store.setField("country", e.target.value)} className={selectClass}>
                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none"><Icon name="public" size="sm" /></div>
            </div>
          </FormField>

          <FormField label="חברה / ארגון">
            <input type="text" value={data.company} onChange={(e) => store.setField("company", e.target.value)} placeholder="שם חברה (אופציונלי)" className={inputClass} />
          </FormField>
        </div>
      </SectionCard>

      {/* ── 3. VIP Toggle ────────────────────────────────────── */}
      <ToggleCard
        label="אורח VIP"
        description="סימון מיוחד והעדפות"
        checked={data.isVip}
        onChange={(v) => store.setField("isVip", v)}
      />

      {/* ── 4. Agent ─────────────────────────────────────────── */}
      {data.agent && (
        <SectionCard title="סוכן">
          <SmartField isExternal={isExternal} lockType={isExternal ? "locked" : "editable"}>
            <FormField label="סוכן">
              <input type="text" value={data.agent} onChange={(e) => store.setField("agent", e.target.value)} className={inputClass} disabled={isExternal} />
            </FormField>
          </SmartField>
        </SectionCard>
      )}

      {/* ── 5. Notes (split: external vs internal) ───────────── */}
      <SectionCard title="הערות">
        <div className="flex flex-col gap-4">
          <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
            <FormField label="הערות כלליות">
              <textarea value={data.generalNotes} onChange={(e) => store.setField("generalNotes", e.target.value)} placeholder="הערות לצוות הקבלה..." rows={3} className={textareaClass} />
            </FormField>
          </SmartField>

          <FormField label="הערות פנימיות (לא מוצג לאורח)">
            <textarea value={data.internalNotes} onChange={(e) => store.setField("internalNotes", e.target.value)} placeholder="הערות שלא יוצגו לאורח..." rows={3} className={textareaClass} />
          </FormField>

          {data.receptionNotes && (
            <FormField label="הערות קבלה">
              <textarea value={data.receptionNotes} onChange={(e) => store.setField("receptionNotes", e.target.value)} placeholder="הערות לקבלה..." rows={2} className={textareaClass} />
            </FormField>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

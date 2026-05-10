"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, textareaClass } from "@/components/shared/FormField"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { SOURCE_MAP } from "@/components/reservations/SourceBadge"

/* ── Helpers ────────────────────────────────────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon name={icon} size="md" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
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
          onClick={() => onChange(!checked)}
          className={`w-12 h-7 rounded-full transition-colors relative ${
            checked ? "bg-primary" : "bg-border/40"
          }`}
          aria-label={label}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${
              checked ? "left-0.5" : "left-[calc(100%-1.625rem)]"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────── */

export function Step2Stay() {
  const store = useReservationFormStore()
  const sourceLabel = store.source ? (SOURCE_MAP[store.source]?.label ?? store.source) : ""

  return (
    <div className="space-y-6">
      {/* Booking Details — unified: IDs, requests/notes, accessibility */}
      <SectionCard title="פרטי הזמנה" icon="book_online">
        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="מזהה הזמנה חיצוני">
            <input
              type="text"
              className={inputClass}
              value={store.externalId}
              onChange={(e) => store.setField("externalId", e.target.value)}
              dir="ltr"
              placeholder="מספר מ-Booking/Expedia..."
            />
          </FormField>

          <FormField label="מקור הזמנה">
            <div className="w-full bg-accent rounded-xl px-5 py-3.5 min-h-[48px] flex items-center text-sm">
              {sourceLabel ? (
                <span className="font-bold text-foreground">{sourceLabel}</span>
              ) : (
                <span className="text-muted-foreground">לא נבחר מקור</span>
              )}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="בקשות מיוחדות">
            <textarea
              className={textareaClass}
              rows={3}
              value={store.specialRequests}
              onChange={(e) => store.setField("specialRequests", e.target.value)}
              placeholder="אלרגיות, אירועים, העדפות..."
            />
          </FormField>

          <FormField label="הערות כלליות" error={store.errors.generalNotes}>
            <textarea
              className={textareaClass}
              rows={3}
              value={store.generalNotes}
              onChange={(e) => store.setField("generalNotes", e.target.value)}
              placeholder="הערות לצוות הקבלה..."
            />
          </FormField>
        </div>

        <div className="mb-4">
          <FormField label="הערות פנימיות" error={store.errors.internalNotes}>
            <textarea
              className={textareaClass}
              rows={3}
              value={store.internalNotes}
              onChange={(e) => store.setField("internalNotes", e.target.value)}
              placeholder="הערות שלא יוצגו לאורח..."
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={store.accessible}
            onChange={(e) => store.setField("accessible", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
          />
          <Icon name="accessible" size="sm" className="text-muted-foreground" />
          <span className="text-sm font-medium">חדר נגיש</span>
        </label>
      </SectionCard>

      {/* VIP Toggle */}
      <ToggleCard
        label="אורח VIP"
        description="סימון מיוחד והעדפות"
        checked={store.isVip}
        onChange={(v) => store.setField("isVip", v)}
      />
    </div>
  )
}

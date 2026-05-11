"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, textareaClass } from "@/components/shared/FormField"
import { TimeInput } from "@/components/shared/TimeInput"
import { SmartField } from "@/components/reservations/FieldLock"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { EditRoomsSection } from "./EditRoomsSection"

/* ── Helpers ─────────────────────────────────────────────────── */

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

/* ── Component ───────────────────────────────────────────────── */

export function EditStep2Stay() {
  const store = useReservationEditStore()
  const { data, isExternal } = store

  return (
    <div className="space-y-6">
      {/* Check-in / check-out times — reservation-level preferences, not
       *  per-room (those are just dates). */}
      <SectionCard title="שעות כניסה ויציאה" icon="schedule">
        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="שעת כניסה">
            <TimeInput value={data.checkInTime} onChange={(val) => store.setField("checkInTime", val)} />
          </FormField>
          <FormField label="שעת יציאה">
            <TimeInput value={data.checkOutTime} onChange={(val) => store.setField("checkOutTime", val)} />
          </FormField>
        </div>

        <div className="flex items-center gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={data.earlyCheckIn}
              onChange={(e) => store.setField("earlyCheckIn", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <Icon name="login" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">כניסה מוקדמת</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={data.lateCheckOut}
              onChange={(e) => store.setField("lateCheckOut", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <Icon name="logout" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">יציאה מאוחרת</span>
          </label>
        </div>
      </SectionCard>

      {/* Per-room editing — dates, composition, guest contact, room pick.
       *  This is the source of truth for everything that used to live on
       *  reservations-level check_in/adults/etc. */}
      <EditRoomsSection />

      {/* Reservation-level booking details (not per-room). */}
      <SectionCard title="פרטי הזמנה" icon="book_online">
        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <SmartField isExternal={isExternal} lockType={isExternal ? "locked" : "editable"}>
            <FormField label="מספר הזמנה חיצוני">
              <input
                type="text"
                className={inputClass}
                value={data.externalId}
                onChange={(e) => store.setField("externalId", e.target.value)}
                dir="ltr"
                placeholder="מספר מ-Booking/Expedia..."
                disabled={isExternal}
              />
            </FormField>
          </SmartField>

          <FormField label="בקשות מיוחדות">
            <textarea
              className={textareaClass}
              rows={3}
              value={data.specialRequests}
              onChange={(e) => store.setField("specialRequests", e.target.value)}
              placeholder="אלרגיות, אירועים, העדפות..."
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={data.accessible}
            onChange={(e) => store.setField("accessible", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
          />
          <Icon name="accessible" size="sm" className="text-muted-foreground" />
          <span className="text-sm font-medium">חדר נגיש</span>
        </label>
      </SectionCard>
    </div>
  )
}

"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, textareaClass } from "@/components/shared/FormField"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { SmartField } from "@/components/reservations/FieldLock"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { BOARD_TYPE_LABELS } from "@/lib/constants/reservation"

/* ── Helpers — same visual as Step2Stay ────────────────────── */

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

/* ── Component ─────────────────────────────────────────────── */

export function EditStep2Stay() {
  const store = useReservationEditStore()
  const { data, isExternal, rooms, nights } = store

  return (
    <div className="space-y-6">
      {/* ── Stay Dates ──────────────────────────────────────── */}
      <SectionCard title="פרטי שהות" icon="calendar_today">
        <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
          <div className="grid grid-cols-3 gap-4 mb-4 max-sm:grid-cols-1">
            <FormField label="תאריך כניסה" required>
              <div className="relative">
                <input type="date" className={inputClass} value={data.checkIn} onChange={(e) => store.setField("checkIn", e.target.value)} />
                <Icon name="calendar_month" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </FormField>

            <FormField label="תאריך יציאה" required>
              <div className="relative">
                <input type="date" className={inputClass} value={data.checkOut} onChange={(e) => store.setField("checkOut", e.target.value)} />
                <Icon name="calendar_month" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </FormField>

            <FormField label="לילות">
              <div className="w-full bg-accent rounded-xl px-5 py-3.5 min-h-[48px] flex items-center justify-center gap-2">
                <Icon name="dark_mode" size="sm" className="text-primary/60" />
                <span className="text-sm font-bold tabular-nums">{nights > 0 ? nights : "—"}</span>
                {nights > 0 && <span className="text-xs text-muted-foreground">לילות</span>}
              </div>
            </FormField>
          </div>
        </SmartField>

        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="שעת כניסה">
            <input type="time" className={inputClass} value={data.checkInTime} onChange={(e) => store.setField("checkInTime", e.target.value)} />
          </FormField>
          <FormField label="שעת יציאה">
            <input type="time" className={inputClass} value={data.checkOutTime} onChange={(e) => store.setField("checkOutTime", e.target.value)} />
          </FormField>
        </div>

        <div className="flex items-center gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={data.earlyCheckIn} onChange={(e) => store.setField("earlyCheckIn", e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
            <Icon name="login" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">כניסה מוקדמת</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={data.lateCheckOut} onChange={(e) => store.setField("lateCheckOut", e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
            <Icon name="logout" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">יציאה מאוחרת</span>
          </label>
        </div>
      </SectionCard>

      {/* ── Guest Composition ───────────────────────────────── */}
      <SectionCard title="הרכב אורחים" icon="group">
        <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
          <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
            <NumberStepper label="מבוגרים" value={data.adults} min={1} max={10} onChange={(v) => store.setField("adults", v)} />
            <NumberStepper label="ילדים" value={data.children} min={0} max={10} onChange={(v) => store.setField("children", v)} />
            <NumberStepper label="תינוקות" value={data.infants} min={0} max={5} onChange={(v) => store.setField("infants", v)} />
          </div>
        </SmartField>
      </SectionCard>

      {/* ── Rooms (read-only list from server) ──────────────── */}
      <SectionCard title="חדרים" icon="bed">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon name="bed" size="xl" className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">לא שויכו חדרים להזמנה</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="bg-card rounded-xl border border-border/20 p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary tabular-nums">{room.room_number}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-sm font-bold text-foreground">{room.room_type_name}</span>
                    <p className="text-xs text-muted-foreground">
                      {room.floor_name} • {room.building_name}
                    </p>
                    <span className="bg-accent text-muted-foreground px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block">
                      {BOARD_TYPE_LABELS[data.mealPlan] || data.mealPlan}
                    </span>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums">{Number(room.rate_per_night).toLocaleString()} ₪</p>
                    <p className="text-[11px] text-muted-foreground">ללילה</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Reservation Details ──────────────────────────────── */}
      <SectionCard title="פרטי הזמנה" icon="book_online">
        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <SmartField isExternal={isExternal} lockType={isExternal ? "locked" : "editable"}>
            <FormField label="מספר הזמנה חיצוני">
              <input type="text" className={inputClass} value={data.externalId} onChange={(e) => store.setField("externalId", e.target.value)} dir="ltr" placeholder="מספר מ-Booking/Expedia..." disabled={isExternal} />
            </FormField>
          </SmartField>

          <FormField label="בקשות מיוחדות">
            <textarea className={textareaClass} rows={3} value={data.specialRequests} onChange={(e) => store.setField("specialRequests", e.target.value)} placeholder="אלרגיות, אירועים, העדפות..." />
          </FormField>
        </div>

        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={data.accessible} onChange={(e) => store.setField("accessible", e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
          <Icon name="accessible" size="sm" className="text-muted-foreground" />
          <span className="text-sm font-medium">חדר נגיש</span>
        </label>
      </SectionCard>
    </div>
  )
}

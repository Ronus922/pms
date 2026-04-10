"use client"

import { useState } from "react"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { Icon } from "@/components/shared/Icon"
import { searchGuests } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { LANGUAGES, COUNTRIES } from "@/lib/constants/localization"

export function GuestTab() {
  const { tenantId } = useTenant()
  const store = useReservationFormStore()
  const [searchQuery, setSearchQuery] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const results = await searchGuests(tenantId, q)
    setSearchResults(results as unknown as typeof searchResults)
    setSearching(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function selectGuest(guest: any) {
    store.setField("firstName", guest.first_name)
    store.setField("lastName", guest.last_name)
    store.setField("phone", guest.phone || "")
    store.setField("email", guest.email || "")
    store.setField("isVip", guest.is_vip || false)
    store.setField("country", guest.country || "IL")
    setSearchQuery("")
    setSearchResults([])
  }

  return (
  <>
    <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
          <Icon name="person" />
        </div>
        <h2 className="text-xl font-bold font-headline">פרטי אורח ראשי</h2>
      </div>

      <div className="space-y-6">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-6">
          <FormField label="שם פרטי" required error={store.errors.firstName}>
            <input type="text" className={inputClass} value={store.firstName}
              onChange={(e) => store.setField("firstName", e.target.value)} placeholder="לדוג׳: ישראל" />
          </FormField>
          <FormField label="שם משפחה" required error={store.errors.lastName}>
            <input type="text" className={inputClass} value={store.lastName}
              onChange={(e) => store.setField("lastName", e.target.value)} placeholder="לדוג׳: ישראלי" />
          </FormField>
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-2 gap-6">
          <FormField label="טלפון" required error={store.errors.phone}>
            <input type="tel" className={inputClass} value={store.phone} dir="ltr"
              onChange={(e) => store.setField("phone", e.target.value)} placeholder="050-000-0000" />
          </FormField>
          <FormField label="אימייל" error={store.errors.email}>
            <input type="email" className={inputClass} value={store.email} dir="ltr"
              onChange={(e) => store.setField("email", e.target.value)} placeholder="example@domain.com" />
          </FormField>
        </div>

        {/* ID + Language + Country */}
        <div className="grid grid-cols-3 gap-6">
          <FormField label="ת.ז. / דרכון">
            <input type="text" className={inputClass} value={store.idNumber} dir="ltr"
              onChange={(e) => store.setField("idNumber", e.target.value)} placeholder="מספר זיהוי" />
          </FormField>
          <FormField label="שפה">
            <select className={selectClass} value={store.language}
              onChange={(e) => store.setField("language", e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </FormField>
          <FormField label="מדינה">
            <select className={selectClass} value={store.country}
              onChange={(e) => store.setField("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
        </div>

        {/* VIP + Company */}
        <div className="flex items-center justify-between bg-accent rounded-[20px] px-5 py-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={store.isVip}
              onChange={(e) => store.setField("isVip", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
            <Icon name="star" size="sm" className={store.isVip ? "text-amber-500" : "text-muted-foreground"} />
            <span className="text-sm font-medium">VIP</span>
          </label>
          <div className="w-52">
            <input type="text" className="w-full bg-card border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              value={store.company} onChange={(e) => store.setField("company", e.target.value)} placeholder="חברה / סוכן" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/10" />

        {/* Search existing guest */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="person_search" size="sm" className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">האם זהו אורח חוזר?</p>
              <p className="text-xs text-muted-foreground">המערכת תזהה פרטים באופן אוטומטי לפי מספר טלפון או אימייל</p>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className={inputClass}
              placeholder="חפש אורח קיים לפי שם, טלפון או אימייל..."
            />
            {searching && <Icon name="hourglass_empty" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-card border border-border/20 rounded-[20px] shadow-md max-h-48 overflow-y-auto">
                {searchResults.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => selectGuest(g)}
                    className="w-full px-5 py-3 text-right hover:bg-accent transition-colors flex items-center gap-3 border-b border-border/20 last:border-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {g.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{g.full_name}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{g.phone}</p>
                    </div>
                    {g.is_vip && <Icon name="star" filled size="sm" className="text-amber-500 mr-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Section 2: Stay Dates */}
    <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
          <Icon name="calendar_today" />
        </div>
        <h2 className="text-xl font-bold font-headline">מועדי שהייה</h2>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 max-sm:grid-cols-1">
        <FormField label="תאריך כניסה" required error={store.errors.checkIn}>
          <div className="relative">
            <input type="date" className={inputClass} value={store.checkIn}
              onChange={(e) => store.setField("checkIn", e.target.value)} />
            <Icon name="calendar_month" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </FormField>

        <FormField label="תאריך יציאה" required error={store.errors.checkOut}>
          <div className="relative">
            <input type="date" className={inputClass} value={store.checkOut}
              onChange={(e) => store.setField("checkOut", e.target.value)} />
            <Icon name="calendar_month" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </FormField>

        <FormField label="סה״כ לילות">
          <div className="w-full bg-accent rounded-[20px] px-5 py-4 text-sm font-bold text-center h-[54px] flex items-center justify-center">
            {store.nights > 0 ? `מחושב אוטומטית: ${store.nights} לילות` : "—"}
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6 max-sm:grid-cols-1">
        <FormField label="שעת צ׳ק אין">
          <input type="time" className={inputClass} value={store.checkInTime}
            onChange={(e) => store.setField("checkInTime", e.target.value)} />
        </FormField>
        <FormField label="שעת צ׳ק אאוט">
          <input type="time" className={inputClass} value={store.checkOutTime}
            onChange={(e) => store.setField("checkOutTime", e.target.value)} />
        </FormField>
      </div>

      <div className="flex items-center gap-8 max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={store.earlyCheckIn}
            onChange={(e) => store.setField("earlyCheckIn", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
          <span className="text-sm font-medium">Early Check-In</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={store.lateCheckOut}
            onChange={(e) => store.setField("lateCheckOut", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
          <span className="text-sm font-medium">Late Check-Out</span>
        </label>
      </div>
    </div>

    {/* Section 3: Guest Counts */}
    <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
          <Icon name="group" />
        </div>
        <h2 className="text-xl font-bold font-headline">אורחים</h2>
      </div>

      <div className="grid grid-cols-3 gap-6 max-sm:grid-cols-1">
        <NumberStepper label="מבוגרים" value={store.adults} min={1} max={10}
          onChange={(v) => store.setField("adults", v)} />
        <NumberStepper label="ילדים (גיל 2-12)" value={store.children} min={0} max={10}
          onChange={(v) => store.setField("children", v)} />
        <NumberStepper label="תינוקות (מתחת ל-2)" value={store.infants} min={0} max={5}
          onChange={(v) => store.setField("infants", v)} />
      </div>
    </div>
  </>
  )
}

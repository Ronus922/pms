"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { searchGuests } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { BOOKING_SOURCE_OPTIONS, RESERVATION_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/constants/reservation"
import { LANGUAGES, COUNTRIES } from "@/lib/constants/localization"

/* ── Types ───────────────────────────────────────────────────── */

interface GuestResult {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  email: string
  is_vip: boolean
  country: string
}

/* ── Helpers ─────────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
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

/* ── Component ───────────────────────────────────────────────── */

export function Step1Guest() {
  const store = useReservationFormStore()
  const { tenantId } = useTenant()

  /* ── Guest Search State ────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<GuestResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (query.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setIsSearching(true)
      debounceRef.current = setTimeout(async () => {
        const results = (await searchGuests(tenantId, query)) as GuestResult[]
        setSearchResults(results)
        setShowResults(results.length > 0)
        setIsSearching(false)
      }, 300)
    },
    [tenantId]
  )

  const selectGuest = useCallback(
    (guest: GuestResult) => {
      store.setField("firstName", guest.first_name)
      store.setField("lastName", guest.last_name)
      store.setField("phone", guest.phone || "")
      store.setField("email", guest.email || "")
      store.setField("idNumber", "")
      store.setField("country", guest.country || "IL")
      store.setField("isVip", guest.is_vip || false)
      store.setField("company", "")

      setSearchQuery(guest.full_name)
      setShowResults(false)
      setSearchResults([])
    },
    [store]
  )

  /* Close search dropdown on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  /* Cleanup debounce on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Guest Search ─────────────────────────────────── */}
      <SectionCard title="חיפוש אורח">
        <div ref={searchWrapperRef} className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="חפש לפי שם, טלפון או אימייל..."
              className={`${inputClass} pe-12`}
            />
            <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
              {isSearching ? (
                <Icon name="hourglass_empty" size="sm" className="animate-spin" />
              ) : (
                <Icon name="search" size="sm" />
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 inset-x-0 z-50 bg-card rounded-xl border border-border/30 shadow-lg overflow-hidden">
              {searchResults.map((guest) => (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => selectGuest(guest)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-accent/60 transition-colors border-b border-border/10 last:border-b-0"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon name="person" size="sm" className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">
                        {guest.full_name}
                      </span>
                      {guest.is_vip && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[12px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Icon name="crown" size="sm" />
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <Icon name="phone" size="sm" />
                          <span className="tabular-nums" dir="ltr">{guest.phone}</span>
                        </span>
                      )}
                      {guest.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Icon name="email" size="sm" />
                          {guest.email}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 2. Booking Source + Statuses ─────────────────────── */}
      <SectionCard title="מקור הזמנה וסטטוסים">
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          {/* Source */}
          <FormField label="מקור הזמנה" required error={store.errors.source}>
            <div className="flex flex-col gap-2">
              <select
                value={store.source}
                onChange={(e) => store.setField("source", e.target.value)}
                className={selectClass}
              >
                <option value="">בחר מקור...</option>
                {BOOKING_SOURCE_OPTIONS.filter((s) => s.value).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {store.source && <SourceBadge value={store.source} size="md" />}
            </div>
          </FormField>

          {/* Reservation Status */}
          <FormField label="סטטוס הזמנה" error={store.errors.status}>
            <div className="flex flex-col gap-2">
              <select
                value={store.status}
                onChange={(e) => store.setField("status", e.target.value)}
                className={selectClass}
              >
                {RESERVATION_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {store.status && <StatusPill type="reservation" value={store.status} size="md" />}
            </div>
          </FormField>

          {/* Payment Status */}
          <FormField label="סטטוס תשלום" error={store.errors.paymentStatus}>
            <div className="flex flex-col gap-2">
              <select
                value={store.paymentStatus}
                onChange={(e) => store.setField("paymentStatus", e.target.value)}
                className={selectClass}
              >
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {store.paymentStatus && (
                <StatusPill type="payment" value={store.paymentStatus} size="md" />
              )}
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* ── 3. Guest Information ─────────────────────────────── */}
      <SectionCard title="פרטי אורח">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {/* First Name */}
          <FormField label="שם פרטי" required error={store.errors.firstName}>
            <input
              type="text"
              value={store.firstName}
              onChange={(e) => store.setField("firstName", e.target.value)}
              placeholder="שם פרטי"
              className={inputClass}
            />
          </FormField>

          {/* Last Name */}
          <FormField label="שם משפחה" required error={store.errors.lastName}>
            <input
              type="text"
              value={store.lastName}
              onChange={(e) => store.setField("lastName", e.target.value)}
              placeholder="שם משפחה"
              className={inputClass}
            />
          </FormField>

          {/* Phone */}
          <FormField label="טלפון" required error={store.errors.phone}>
            <div className="relative">
              <input
                type="tel"
                value={store.phone}
                onChange={(e) => store.setField("phone", e.target.value)}
                placeholder="050-0000000"
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
                <Icon name="phone" size="sm" />
              </div>
            </div>
          </FormField>

          {/* Email */}
          <FormField label="אימייל" error={store.errors.email}>
            <div className="relative">
              <input
                type="email"
                value={store.email}
                onChange={(e) => store.setField("email", e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className={`${inputClass} pe-12 text-start`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
                <Icon name="email" size="sm" />
              </div>
            </div>
          </FormField>

          {/* ID / Passport */}
          <FormField label="ת.ז / דרכון" error={store.errors.idNumber}>
            <div className="relative">
              <input
                type="text"
                value={store.idNumber}
                onChange={(e) => store.setField("idNumber", e.target.value)}
                placeholder="מספר מזהה"
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
                <Icon name="badge" size="sm" />
              </div>
            </div>
          </FormField>

          {/* Language */}
          <FormField label="שפה" error={store.errors.language}>
            <div className="relative">
              <select
                value={store.language}
                onChange={(e) => store.setField("language", e.target.value)}
                className={selectClass}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
                <Icon name="translate" size="sm" />
              </div>
            </div>
          </FormField>

          {/* Country */}
          <FormField label="מדינה" error={store.errors.country}>
            <div className="relative">
              <select
                value={store.country}
                onChange={(e) => store.setField("country", e.target.value)}
                className={selectClass}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none">
                <Icon name="public" size="sm" />
              </div>
            </div>
          </FormField>

          {/* Company */}
          <FormField label="חברה / ארגון" error={store.errors.company}>
            <input
              type="text"
              value={store.company}
              onChange={(e) => store.setField("company", e.target.value)}
              placeholder="שם חברה (אופציונלי)"
              className={inputClass}
            />
          </FormField>
        </div>
      </SectionCard>

      {/* ── 4. VIP Toggle ────────────────────────────────────── */}
      <ToggleCard
        label="אורח VIP"
        description="סימון מיוחד והעדפות"
        checked={store.isVip}
        onChange={(v) => store.setField("isVip", v)}
      />

      {/* ── 5. Notes ─────────────────────────────────────────── */}
      <SectionCard title="הערות">
        <div className="flex flex-col gap-4">
          <FormField label="הערות כלליות" error={store.errors.generalNotes}>
            <textarea
              value={store.generalNotes}
              onChange={(e) => store.setField("generalNotes", e.target.value)}
              placeholder="הערות לצוות הקבלה..."
              rows={3}
              className={textareaClass}
            />
          </FormField>

          <FormField label="הערות פנימיות" error={store.errors.internalNotes}>
            <textarea
              value={store.internalNotes}
              onChange={(e) => store.setField("internalNotes", e.target.value)}
              placeholder="הערות שלא יוצגו לאורח..."
              rows={3}
              className={textareaClass}
            />
          </FormField>
        </div>
      </SectionCard>
    </div>
  )
}

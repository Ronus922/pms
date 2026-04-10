"use client"

import { useState } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { createReservation } from "@/lib/actions/create-reservation"
import { GuestTab } from "./tabs/GuestTab"
import { BookingTab } from "./tabs/BookingTab"
import { StayTab } from "./tabs/StayTab"
import { PricingTab } from "./tabs/PricingTab"
import { ReservationSummary } from "./ReservationSummary"

import { useTenant } from "@/lib/hooks/use-tenant"

const TABS = [
  { key: "guest", label: "פרטי אורח", icon: "person" },
  { key: "booking", label: "פרטי הזמנה", icon: "book_online" },
  { key: "stay", label: "חדר ותפוסה", icon: "bed" },
  { key: "pricing", label: "תשלום וסיכום", icon: "payments" },
]

interface NewReservationFormProps {
  onCreated?: () => void
}

export function NewReservationForm({ onCreated }: NewReservationFormProps) {
  const { tenantId, propertyId } = useTenant()
  const store = useReservationFormStore()
  const [submitError, setSubmitError] = useState("")

  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {}
    if (step >= 0) {
      if (!store.firstName) errors.firstName = "חובה להזין שם פרטי"
      if (!store.lastName) errors.lastName = "חובה להזין שם משפחה"
      if (!store.phone) errors.phone = "חובה להזין טלפון"
      if (store.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email)) errors.email = "אימייל לא תקין"
      if (!store.checkIn) errors.checkIn = "חובה להזין תאריך הגעה"
      if (!store.checkOut) errors.checkOut = "חובה להזין תאריך עזיבה"
      if (store.checkIn && store.checkOut && store.checkOut <= store.checkIn) errors.checkOut = "תאריך עזיבה חייב להיות אחרי הגעה"
    }
    if (step >= 1) {
      if (!store.source) errors.source = "חובה לבחור מקור הזמנה"
    }
    if (step >= 2) {
      if (!store.roomId && !store.roomTypeId) { errors.roomId = "חובה לבחור חדר"; errors.roomTypeId = "חובה לבחור סוג חדר" }
    }
    if (step >= 3) {
      if (store.pricePerNight <= 0) errors.pricePerNight = "מחיר חייב להיות גדול מ-0"
    }
    store.setErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validate(): boolean {
    return validateStep(TABS.length - 1)
  }

  async function handleSubmit() {
    setSubmitError("")
    if (!validate()) {
      const ek = Object.keys(store.errors)
      if (ek.some((k) => ["firstName","lastName","phone","email","checkIn","checkOut"].includes(k))) store.setActiveTab(0)
      else if (ek.some((k) => ["source","paymentStatus"].includes(k))) store.setActiveTab(1)
      else if (ek.some((k) => ["roomId","roomTypeId"].includes(k))) store.setActiveTab(2)
      else if (ek.some((k) => ["pricePerNight"].includes(k))) store.setActiveTab(3)
      return
    }
    store.setSubmitting(true)
    const result = await createReservation(tenantId, propertyId, {
      firstName: store.firstName, lastName: store.lastName, fullName: store.fullName,
      fullNameManual: store.fullNameManual, phone: store.phone, email: store.email,
      idNumber: store.idNumber, language: store.language, country: store.country,
      city: store.city, address: store.address, zipCode: store.zipCode,
      isVip: store.isVip, company: store.company, source: store.source,
      adSource: store.adSource, externalId: store.externalId, status: store.status,
      paymentStatus: store.paymentStatus, paymentMethod: store.paymentMethod,
      externalTransactionId: store.externalTransactionId, generalNotes: store.generalNotes,
      internalNotes: store.internalNotes, checkIn: store.checkIn, checkOut: store.checkOut,
      checkInTime: store.checkInTime, checkOutTime: store.checkOutTime,
      estimatedArrival: store.estimatedArrival, estimatedDeparture: store.estimatedDeparture,
      earlyCheckIn: store.earlyCheckIn, lateCheckOut: store.lateCheckOut,
      roomId: store.roomId, roomTypeId: store.roomTypeId, ratePlanId: store.ratePlanId,
      boardType: store.boardType, adults: store.adults, children: store.children,
      infants: store.infants, accessible: store.accessible, specialRequests: store.specialRequests,
      pricePerNight: store.pricePerNight, discountAmount: store.discountAmount,
      discountPercent: store.discountPercent, extraCharges: store.extraCharges,
      taxExempt: store.taxExempt, deposit: store.deposit, amountPaid: store.amountPaid,
      currency: store.currency,
    })
    store.setSubmitting(false)
    if (!result.success) { setSubmitError(result.error || "שגיאה ביצירת ההזמנה"); return }
    store.close()
    onCreated?.()
  }

  return (
    <SidePanel
      isOpen={store.isOpen}
      onClose={store.close}
      title="הזמנה חדשה"
      subtitle="יצירת רשומה חדשה במערכת עבור אורח"
    >
      <div className="flex flex-col -m-6" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Tab Navigation */}
        <nav className="flex border-b border-border/20 gap-8 px-8 pt-2 overflow-x-auto no-scrollbar">
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => store.setActiveTab(i)}
              className={`pb-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                store.activeTab === i
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content: 12-column grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-8 p-8 items-start max-lg:grid-cols-1">
            {/* Form area */}
            <div className="col-span-8 max-lg:col-span-1 space-y-8">
              {/* Draft indicator */}
              <div className="flex justify-end">
                <span className="bg-accent px-4 py-2 rounded-full text-xs font-bold text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  טיוטה נשמרת אוטומטית
                </span>
              </div>

              {submitError && (
                <div className="bg-red-50 dark:bg-red-950/20 text-destructive px-5 py-4 rounded-[20px] text-sm flex items-center gap-3">
                  <Icon name="error" size="sm" />
                  {submitError}
                </div>
              )}

              {store.activeTab === 0 && <GuestTab />}
              {store.activeTab === 1 && <BookingTab />}
              {store.activeTab === 2 && <StayTab />}
              {store.activeTab === 3 && <PricingTab />}
            </div>

            {/* Summary sidebar */}
            <div className="col-span-4 max-lg:col-span-1 sticky top-0">
              <ReservationSummary />
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-border/20 px-8 py-4 bg-card/90 backdrop-blur-md flex flex-row-reverse items-center justify-between">
          <div className="flex gap-4">
            {store.activeTab < TABS.length - 1 ? (
              <button
                onClick={() => {
                  if (validateStep(store.activeTab)) {
                    store.setActiveTab(store.activeTab + 1)
                  }
                }}
                className="bg-primary text-white px-10 py-3 rounded-xl min-h-[44px] font-bold text-sm shadow-md hover:shadow-md transition-shadow active:scale-95 flex items-center gap-2"
              >
                לשלב הבא
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={store.isSubmitting}
                className="bg-primary text-white px-10 py-3 rounded-xl min-h-[44px] font-bold text-sm shadow-md hover:shadow-md transition-shadow active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {store.isSubmitting ? "שומר..." : "שמור הזמנה"}
              </button>
            )}
            {store.activeTab > 0 && (
              <button
                onClick={() => store.setActiveTab(store.activeTab - 1)}
                className="bg-accent text-muted-foreground px-8 py-3 rounded-xl min-h-[44px] font-bold text-sm hover:bg-border/30 transition-colors"
              >
                לשלב הקודם
              </button>
            )}
            <button
              onClick={store.close}
              className="bg-accent text-muted-foreground px-8 py-3 rounded-xl min-h-[44px] font-bold text-sm hover:bg-border/30 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}

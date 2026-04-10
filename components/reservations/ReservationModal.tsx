"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { createReservation } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { Step1Guest } from "./steps/Step1Guest"
import { Step2Stay } from "./steps/Step2Stay"
import { Step3Pricing } from "./steps/Step3Pricing"
import { Step4Review } from "./steps/Step4Review"

/* ── Types ──────────────────────────────────────────────────── */

interface ReservationModalProps {
  onCreated?: () => void
}

/* ── Constants ──────────────────────────────────────────────── */

const STEPS = [
  { label: "פרטי אורח", icon: "person" },
  { label: "שהות וחדרים", icon: "bed" },
  { label: "תמחור ותשלום", icon: "payments" },
  { label: "סיכום ואישור", icon: "check_circle" },
] as const

const ACTION_ICONS = [
  { icon: "print", label: "הדפסה" },
  { icon: "file_download", label: "PDF" },
  { icon: "visibility", label: "תצוגה מקדימה" },
  { icon: "email", label: "אימייל" },
  { icon: "phone", label: "SMS" },
  { icon: "whatsapp", label: "WhatsApp" },
] as const

/* ── Component ──────────────────────────────────────────────── */

export function ReservationModal({ onCreated }: ReservationModalProps) {
  const store = useReservationFormStore()
  const { tenantId, propertyId } = useTenant()
  const [submitError, setSubmitError] = useState("")
  const bodyRef = useRef<HTMLDivElement>(null)

  const activeTab = store.activeTab

  /* ── Scroll body to top on tab change ─────────────────────── */
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [activeTab])

  /* ── Validation ───────────────────────────────────────────── */
  const validateStep = useCallback(
    (step: number): boolean => {
      const errors: Record<string, string> = {}

      if (step === 0) {
        if (!store.firstName.trim()) errors.firstName = "חובה להזין שם פרטי"
        if (!store.lastName.trim()) errors.lastName = "חובה להזין שם משפחה"
        if (!store.phone.trim()) errors.phone = "חובה להזין טלפון"
        if (!store.checkIn) errors.checkIn = "חובה להזין תאריך הגעה"
        if (!store.checkOut) errors.checkOut = "חובה להזין תאריך עזיבה"
        if (store.checkIn && store.checkOut && store.checkOut <= store.checkIn) {
          errors.checkOut = "תאריך עזיבה חייב להיות אחרי הגעה"
        }
      }

      if (step === 1) {
        if (store.rooms.length === 0 && !store.roomId && !store.roomTypeId) {
          errors.roomTypeId = "חובה לבחור חדר או סוג חדר"
        }
      }

      if (step === 2) {
        const hasRoomRates = store.rooms.length > 0 && store.rooms.some((r) => r.ratePerNight > 0)
        if (store.pricePerNight <= 0 && !hasRoomRates) {
          errors.pricePerNight = "מחיר ללילה חייב להיות גדול מ-0"
        }
      }

      if (step === 3) {
        if (!store.firstName.trim()) errors.firstName = "חובה להזין שם פרטי"
        if (!store.lastName.trim()) errors.lastName = "חובה להזין שם משפחה"
        if (!store.phone.trim()) errors.phone = "חובה להזין טלפון"
        if (!store.checkIn) errors.checkIn = "חובה להזין תאריך הגעה"
        if (!store.checkOut) errors.checkOut = "חובה להזין תאריך עזיבה"
        if (store.checkIn && store.checkOut && store.checkOut <= store.checkIn) {
          errors.checkOut = "תאריך עזיבה חייב להיות אחרי הגעה"
        }
      }

      store.setErrors(errors)
      return Object.keys(errors).length === 0
    },
    [store]
  )

  /* ── Navigation ───────────────────────────────────────────── */
  const handleNext = useCallback(() => {
    if (validateStep(activeTab)) {
      store.setActiveTab(Math.min(3, activeTab + 1))
    }
  }, [activeTab, validateStep, store])

  const handleBack = useCallback(() => {
    store.setErrors({})
    store.setActiveTab(Math.max(0, activeTab - 1))
  }, [activeTab, store])

  /* ── Submit ───────────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    if (!validateStep(3)) return

    store.setSubmitting(true)
    setSubmitError("")

    const formData = {
      firstName: store.firstName,
      lastName: store.lastName,
      fullName: store.fullName,
      fullNameManual: store.fullNameManual,
      phone: store.phone,
      email: store.email,
      idNumber: store.idNumber,
      language: store.language,
      country: store.country,
      city: store.city,
      address: store.address,
      zipCode: store.zipCode,
      isVip: store.isVip,
      company: store.company,
      source: store.source,
      adSource: store.adSource,
      externalId: store.externalId,
      status: store.status,
      paymentStatus: store.paymentStatus,
      paymentMethod: store.paymentMethod,
      externalTransactionId: store.externalTransactionId,
      generalNotes: store.generalNotes,
      internalNotes: store.internalNotes,
      checkIn: store.checkIn,
      checkOut: store.checkOut,
      checkInTime: store.checkInTime,
      checkOutTime: store.checkOutTime,
      estimatedArrival: store.estimatedArrival,
      estimatedDeparture: store.estimatedDeparture,
      earlyCheckIn: store.earlyCheckIn,
      lateCheckOut: store.lateCheckOut,
      adults: store.adults,
      children: store.children,
      infants: store.infants,
      accessible: store.accessible,
      specialRequests: store.specialRequests,
      rooms: store.rooms,
      roomId: store.roomId,
      roomTypeId: store.roomTypeId,
      ratePlanId: store.ratePlanId,
      boardType: store.boardType,
      pricePerNight: store.pricePerNight,
      discountAmount: store.discountAmount,
      discountPercent: store.discountPercent,
      extraCharges: store.extraCharges,
      taxExempt: store.taxExempt,
      deposit: store.deposit,
      amountPaid: store.amountPaid,
      currency: store.currency,
      cardHolderName: store.cardHolderName,
      cardLast4: store.cardLast4,
      cardExpiryMonth: store.cardExpiryMonth,
      cardExpiryYear: store.cardExpiryYear,
      cardApprovalCode: store.cardApprovalCode,
      cardTransactionRef: store.cardTransactionRef,
      cardInstallments: store.cardInstallments,
      paymentResult: store.paymentResult,
      attachments: store.attachments,
    }

    const result = await createReservation(tenantId, propertyId, formData)

    store.setSubmitting(false)

    if (result.success) {
      store.close()
      onCreated?.()
    } else {
      setSubmitError(result.error || "שגיאה ביצירת ההזמנה")
    }
  }, [store, tenantId, propertyId, onCreated, validateStep])

  /* ── Save Draft ───────────────────────────────────────────── */
  const handleSaveDraft = useCallback(() => {
    store.setField("status", "draft")
    handleSubmit()
  }, [store, handleSubmit])

  /* ── Close handler ────────────────────────────────────────── */
  const handleClose = useCallback(() => {
    store.close()
    setSubmitError("")
  }, [store])

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <SidePanel
      isOpen={store.isOpen}
      onClose={handleClose}
      title="הקמת הזמנה חדשה"
      subtitle="יצירת הזמנה, חדרים, תמחור ותשלום"
    >
      <div className="flex flex-col -m-6" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* ── Action Icons + Step Progress ───────────────────── */}
        <div className="shrink-0 bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 border-b border-border/15">
          {/* Action icons */}
          <div className="flex items-center gap-2 px-6 pt-4 pb-3">
            {ACTION_ICONS.map((action) => (
              <button
                key={action.icon}
                type="button"
                className="w-9 h-9 rounded-xl bg-accent hover:bg-border/40 flex items-center justify-center transition-colors"
                aria-label={action.label}
                title={action.label}
              >
                <Icon name={action.icon} size="sm" className="text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* Step Progress Bar */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between max-w-[520px] mx-auto">
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => store.setActiveTab(i)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        i === activeTab
                          ? "bg-primary text-white shadow-md"
                          : i < activeTab
                            ? "bg-primary/20 text-primary"
                            : "bg-accent text-muted-foreground group-hover:bg-border/40"
                      }`}
                    >
                      {i < activeTab ? (
                        <Icon name="check_circle" size="sm" />
                      ) : (
                        <span className="tabular-nums">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-[12px] font-bold transition-colors whitespace-nowrap ${
                        i === activeTab
                          ? "text-primary"
                          : i < activeTab
                            ? "text-primary/70"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>

                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-10 h-0.5 mx-1.5 mt-[-18px] rounded-full transition-colors ${
                        i < activeTab ? "bg-primary" : "bg-border/30"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body: Side Nav + Content ────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          {/* Side Nav */}
          <div className="w-48 shrink-0 border-l border-border/15 bg-card/50 py-4 flex flex-col">
            <nav className="flex-1 space-y-1 px-2">
              {STEPS.map((step, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => store.setActiveTab(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all text-right min-h-[44px] ${
                    i === activeTab
                      ? "bg-primary/10 text-primary border-r-4 border-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 ${
                      i === activeTab
                        ? "bg-primary text-white"
                        : i < activeTab
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                          : "bg-accent text-muted-foreground"
                    }`}
                  >
                    {i < activeTab ? (
                      <Icon name="check_circle" size="sm" />
                    ) : (
                      <span className="tabular-nums">{i + 1}</span>
                    )}
                  </span>
                  <span>{step.label}</span>
                </button>
              ))}
            </nav>

            <div className="px-3 pt-3 border-t border-border/15">
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <Icon name="info" size="sm" className="opacity-50" />
                שלב {activeTab + 1} מתוך {STEPS.length}
              </p>
            </div>
          </div>

          {/* Content */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5">
            {/* Error banner */}
            {submitError && (
              <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <Icon name="error" size="md" className="text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm font-bold text-red-800 dark:text-red-300">{submitError}</span>
                <button
                  type="button"
                  onClick={() => setSubmitError("")}
                  className="ms-auto min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="סגור שגיאה"
                >
                  <Icon name="close" size="sm" className="text-red-400" />
                </button>
              </div>
            )}

            {/* Step errors summary */}
            {Object.keys(store.errors).length > 0 && (
              <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="error" size="sm" className="text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-red-800 dark:text-red-300">יש לתקן את השגיאות הבאות:</span>
                </div>
                <ul className="flex flex-col gap-1 ps-6">
                  {Object.values(store.errors).map((err, i) => (
                    <li key={i} className="text-xs text-red-700 dark:text-red-400 list-disc">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 0 && <Step1Guest />}
                {activeTab === 1 && <Step2Stay />}
                {activeTab === 2 && <Step3Pricing />}
                {activeTab === 3 && <Step4Review />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between">
          {/* Right side (RTL start): cancel + draft */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] px-4 py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              ביטול
            </button>
            {activeTab === 3 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={store.isSubmitting}
                className="min-h-[44px] px-5 py-3 border border-border/30 text-muted-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
              >
                שמור טיוטה
              </button>
            )}
          </div>

          {/* Left side (RTL end): navigation */}
          <div className="flex items-center gap-3">
            {activeTab > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[44px] px-6 py-3 border border-border/30 text-muted-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Icon name="chevron_right" size="sm" />
                חזרה
              </button>
            )}
            {activeTab < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-8 py-3 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                הבא
                <Icon name="chevron_left" size="sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={store.isSubmitting}
                className="min-h-[44px] px-8 py-3 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {store.isSubmitting ? (
                  <>
                    <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                    יוצר הזמנה...
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" size="sm" />
                    צור הזמנה
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </SidePanel>
  )
}

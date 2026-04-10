"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { updateReservation } from "@/lib/actions/reservation-update"
import { EditStep1Guest } from "./edit-steps/EditStep1Guest"
import { EditStep2Stay } from "./edit-steps/EditStep2Stay"
import { EditStep3Pricing } from "./edit-steps/EditStep3Pricing"
import { EditStep4Summary } from "./edit-steps/EditStep4Summary"

/* ── Constants — same as ReservationModal ──────────────────── */

const STEPS = [
  { label: "פרטי אורח", icon: "person" },
  { label: "שהות וחדרים", icon: "bed" },
  { label: "תמחור ותשלום", icon: "payments" },
  { label: "סיכום ופעולות", icon: "check_circle" },
] as const

const ACTION_ICONS = [
  { icon: "print", label: "הדפסה" },
  { icon: "file_download", label: "PDF" },
  { icon: "visibility", label: "תצוגה מקדימה" },
  { icon: "email", label: "אימייל" },
  { icon: "phone", label: "SMS" },
  { icon: "whatsapp", label: "WhatsApp" },
] as const

/* ── Component ─────────────────────────────────────────────── */

interface ExistingReservationPanelProps {
  onSaved?: () => void
}

export function ExistingReservationPanel({ onSaved }: ExistingReservationPanelProps) {
  const store = useReservationEditStore()
  const [saveError, setSaveError] = useState("")
  const bodyRef = useRef<HTMLDivElement>(null)

  const activeTab = store.activeTab

  /* ── Scroll body to top on tab change ─────────────────────── */
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [activeTab])

  /* ── Save handler ─────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    store.setSaving(true)
    setSaveError("")

    const result = await updateReservation(
      store.reservationId,
      store.tenantId,
      store.guestId,
      store.data
    )

    store.setSaving(false)

    if (result.success) {
      // Reload data to sync originalData
      await store.open(store.reservationId, store.tenantId)
      onSaved?.()
    } else {
      setSaveError(result.error || "שגיאה בשמירת ההזמנה")
    }
  }, [store, onSaved])

  /* ── Close with dirty check ───────────────────────────────── */
  const handleClose = useCallback(() => {
    if (store.isDirty) {
      const confirmed = window.confirm("יש שינויים שלא נשמרו. לסגור בכל זאת?")
      if (!confirmed) return
    }
    store.close()
    setSaveError("")
  }, [store])

  /* ── Build subtitle ───────────────────────────────────────── */
  const subtitle = store.reservationNumber
    ? `#${store.reservationNumber}`
    : ""

  /* ── Footer element ─────────────────────────────────────── */
  const footerEl = !store.isLoading ? (
    <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between">
      {/* Right side (RTL start): close */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="min-h-[44px] px-4 py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          סגור
        </button>
      </div>

      {/* Left side (RTL end): save */}
      <div className="flex items-center gap-3">
        {store.isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={store.isSaving}
            className="min-h-[44px] px-8 py-3 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {store.isSaving ? (
              <>
                <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Icon name="save" size="sm" />
                שמור שינויים
              </>
            )}
          </button>
        )}
      </div>
    </div>
  ) : undefined

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <SidePanel
      isOpen={store.isOpen}
      onClose={handleClose}
      title="פרטי הזמנה"
      subtitle={subtitle}
      noPadding
      footer={footerEl}
    >
      {store.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Icon name="hourglass_empty" size="xl" className="text-muted-foreground opacity-30 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* ── Badges + Action Icons + Step Progress ──────────── */}
          <div className="shrink-0 bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 border-b border-border/15">
            {/* Source + Status Badges */}
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 flex-wrap">
              {store.data.source && (
                <SourceBadge value={store.data.source} size="md" />
              )}
              {store.data.status && (
                <StatusPill type="reservation" value={store.data.status} size="md" />
              )}
              {store.data.paymentStatus && (
                <StatusPill type="payment" value={store.data.paymentStatus} size="md" />
              )}
              {store.isExternal && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800">
                  <Icon name="link" size="sm" />
                  חיצוני
                </span>
              )}
              {store.isDirty && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800">
                  <Icon name="edit" size="sm" />
                  שינויים לא שמורים
                </span>
              )}
            </div>

            {/* Action icons */}
            <div className="flex items-center gap-2 px-6 pb-3">
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
              <div className="flex flex-row-reverse items-center justify-between max-w-[520px] mx-auto">
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
            <div className="w-48 shrink-0 border-l border-border/15 bg-card/50 py-4 flex flex-col max-sm:hidden">
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

            {/* Content — scrollable */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5">
              {/* Error banner */}
              {saveError && (
                <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <Icon name="error" size="md" className="text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-sm font-bold text-red-800 dark:text-red-300">{saveError}</span>
                  <button
                    type="button"
                    onClick={() => setSaveError("")}
                    className="ms-auto min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="סגור שגיאה"
                  >
                    <Icon name="close" size="sm" className="text-red-400" />
                  </button>
                </div>
              )}

              {/* Load error */}
              {store.errors.load && (
                <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-red-800">{store.errors.load}</span>
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
                  {activeTab === 0 && <EditStep1Guest />}
                  {activeTab === 1 && <EditStep2Stay />}
                  {activeTab === 2 && <EditStep3Pricing />}
                  {activeTab === 3 && <EditStep4Summary />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </SidePanel>
  )
}

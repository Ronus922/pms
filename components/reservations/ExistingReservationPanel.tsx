"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { toast } from "sonner"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { useMessagingStore } from "@/lib/stores/messaging-store"
import { updateReservation } from "@/lib/actions/reservation-update"
import { updateReservationRooms } from "@/lib/actions/update-reservation-rooms"
import { exportReservationToExcel } from "@/lib/actions/reservation-export-excel"
import { downloadReservationPdf } from "@/lib/utils/reservation-pdf-client"
import {
  openPrint,
  openPreview,
  downloadBase64,
} from "@/lib/utils/reservation-export-client"
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

interface ActionItem {
  icon: string
  label: string
  action: "print" | "pdf" | "excel" | "preview" | "email" | "sms" | "whatsapp"
  disabled?: boolean
}

const ACTION_ICONS: readonly ActionItem[] = [
  { icon: "print",         label: "הדפסה",         action: "print" },
  { icon: "file_download", label: "הורדת PDF",      action: "pdf" },
  { icon: "table_rows",    label: "הורדת Excel",    action: "excel" },
  { icon: "visibility",    label: "תצוגה מקדימה",   action: "preview" },
  { icon: "email",         label: "שליחת אימייל",   action: "email" },
  { icon: "phone",         label: "SMS (בקרוב)",    action: "sms",     disabled: true },
  { icon: "whatsapp",      label: "שליחת WhatsApp", action: "whatsapp" },
] as const

/* ── Component ─────────────────────────────────────────────── */

interface ExistingReservationPanelProps {
  onSaved?: () => void
}

export function ExistingReservationPanel({ onSaved }: ExistingReservationPanelProps) {
  const store = useReservationEditStore()
  const openMessaging = useMessagingStore((m) => m.open)
  const [saveError, setSaveError] = useState("")
  const [exporting, setExporting] = useState<string>("")
  const bodyRef = useRef<HTMLDivElement>(null)

  const activeTab = store.activeTab

  /* ── Scroll body to top on tab change ─────────────────────── */
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [activeTab])

  /* ── Save handler. `closeAfter` = "שמור וסגור" button — skips the
   *  panel reload and closes immediately after a successful write. */
  const handleSave = useCallback(async (closeAfter = false) => {
    store.setSaving(true)
    setSaveError("")

    // Per-room validation BEFORE hitting the server — matches Module mandate:
    //   check_in / check_out required, adults >= 1, room_id required.
    for (let i = 0; i < store.editableRooms.length; i++) {
      const r = store.editableRooms[i]
      if (!r.roomId) {
        store.setSaving(false)
        setSaveError(`חדר ${i + 1}: חובה לבחור חדר זמין`)
        return
      }
      if (!r.checkIn || !r.checkOut || r.checkOut <= r.checkIn) {
        store.setSaving(false)
        setSaveError(`חדר ${i + 1}: תאריכים לא תקינים`)
        return
      }
      if (!r.adults || r.adults < 1) {
        store.setSaving(false)
        setSaveError(`חדר ${i + 1}: לפחות מבוגר אחד נדרש`)
        return
      }
    }
    if (store.editableRooms.length === 0) {
      store.setSaving(false)
      setSaveError("חובה להוסיף לפחות חדר אחד")
      return
    }

    // 1. Write per-room truth FIRST. reservation_rooms is the source of
    //    truth for dates/composition/guest contact — the reservations-level
    //    updateReservation call after this only touches guest + booking.
    const roomsResult = await updateReservationRooms(
      store.tenantId,
      store.reservationId,
      store.editableRooms,
    )
    if (!roomsResult.success) {
      store.setSaving(false)
      setSaveError(roomsResult.error || "שגיאה בשמירת חדרי ההזמנה")
      return
    }

    // 2. Write reservation-level fields (guest, booking details, pricing).
    const result = await updateReservation(
      store.reservationId,
      store.tenantId,
      store.guestId,
      store.data
    )

    store.setSaving(false)

    if (result.success) {
      // Notify every subscribed page (table / calendar / guest panel)
      // that this reservation was saved so they can re-fetch their list.
      store.bumpSaved()
      onSaved?.()
      if (closeAfter) {
        store.close()
        setSaveError("")
      } else {
        // Reload data to sync originalData + originalEditableRooms
        await store.open(store.reservationId, store.tenantId)
      }
    } else {
      setSaveError(result.error || "שגיאה בשמירת ההזמנה")
    }
  }, [store, onSaved])

  /* ── Close with dirty check ───────────────────────────────── */
  const { confirm, confirmDialog } = useConfirm()
  const handleClose = useCallback(async () => {
    if (store.isDirty) {
      const confirmed = await confirm({
        message: "יש שינויים שלא נשמרו. לסגור בכל זאת?",
        confirmLabel: "סגור בלי לשמור",
        danger: true,
      })
      if (!confirmed) return
    }
    store.close()
    setSaveError("")
  }, [store, confirm])

  /* ── Action icon handler ─────────────────────────────────── */
  const handleAction = useCallback(
    async (action: ActionItem["action"]) => {
      const id = store.reservationId
      if (!id) return
      switch (action) {
        case "print":
          openPrint(id)
          return
        case "preview":
          openPreview(id)
          return
        case "pdf": {
          setExporting("pdf")
          const res = await downloadReservationPdf(id)
          setExporting("")
          if (!res.success) toast.error(res.error || "שגיאה ביצירת PDF")
          else toast.success("ה-PDF הורד")
          return
        }
        case "excel": {
          setExporting("excel")
          const res = await exportReservationToExcel(id)
          setExporting("")
          if (!res.success || !res.base64 || !res.filename) {
            toast.error(res.error || "שגיאה ביצירת קובץ אקסל")
            return
          }
          downloadBase64(
            res.base64,
            res.filename,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
          toast.success("קובץ ה-Excel הורד")
          return
        }
        case "email":
          if (!store.data.email) {
            toast.error("אין כתובת מייל לאורח. הוסף כתובת בטאב פרטי האורח.")
            return
          }
          openMessaging({
            channel: "email",
            reservationId: id,
            tenantId: store.tenantId,
            defaultRecipient: store.data.email,
          })
          return
        case "whatsapp":
          if (!store.data.phone) {
            toast.error("אין מספר טלפון לאורח. הוסף טלפון בטאב פרטי האורח.")
            return
          }
          openMessaging({
            channel: "whatsapp",
            reservationId: id,
            tenantId: store.tenantId,
            defaultRecipient: store.data.phone,
          })
          return
        case "sms":
          return
      }
    },
    [store.reservationId, store.tenantId, store.data.email, store.data.phone, openMessaging],
  )

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

      {/* Left side (RTL end): save / save-and-close pair */}
      <div className="flex items-center gap-2">
        {store.isDirty && (
          <>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={store.isSaving}
              className="btn btn-outline"
              title="שמור והישאר בעריכה"
            >
              {store.isSaving ? (
                <>
                  <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <Icon name="save" size="sm" />
                  שמור
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={store.isSaving}
              className="btn btn-primary"
              title="שמור וסגור את הפאנל"
            >
              <Icon name="check" size="sm" />
              שמור וסגור
            </button>
          </>
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
          <div className="shrink-0 bg-gradient-to-l from-primary/10 to-secondary/10 border-b border-border/15">
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
              {ACTION_ICONS.map((item) => {
                const isLoading = exporting === item.action
                const disabled = item.disabled || isLoading
                return (
                  <button
                    key={item.icon}
                    type="button"
                    onClick={() => !disabled && handleAction(item.action)}
                    disabled={disabled}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      item.disabled
                        ? "bg-accent/40 opacity-40 cursor-not-allowed"
                        : "bg-accent hover:bg-border/40 cursor-pointer"
                    }`}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Icon
                      name={isLoading ? "hourglass_empty" : item.icon}
                      size="sm"
                      className={`text-muted-foreground ${isLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                )
              })}
            </div>

            {/* Step Progress Bar — RTL: step 1 on the right, 4 on the left, equal spacing */}
            <div className="px-6 pb-4" dir="rtl">
              <div className="relative max-w-[520px] mx-auto">
                <div
                  className="absolute top-[18px] h-0.5 bg-border/30 rounded-full pointer-events-none"
                  style={{ insetInlineStart: "12.5%", insetInlineEnd: "12.5%" }}
                  aria-hidden
                />
                <div
                  className="absolute top-[18px] h-0.5 bg-primary rounded-full transition-[width] pointer-events-none"
                  style={{
                    insetInlineStart: "12.5%",
                    width:
                      STEPS.length > 1
                        ? `${(activeTab / (STEPS.length - 1)) * 75}%`
                        : "0%",
                  }}
                  aria-hidden
                />
                <div className="relative grid grid-cols-4">
                {STEPS.map((step, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => store.setActiveTab(i)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          i === activeTab
                            ? "bg-primary text-primary-foreground shadow-md"
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
                ))}
                </div>
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
                          ? "bg-primary text-primary-foreground"
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
      {confirmDialog}
    </SidePanel>
  )
}

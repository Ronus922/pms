"use client"

import { Icon } from "@/components/shared/Icon"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { FileUploadArea } from "@/components/reservations/FileUploadArea"
import { useReservationFormStore, type ReservationFormStore } from "@/lib/stores/reservation-form-store"
import { BOARD_TYPE_LABELS } from "@/lib/constants/reservation"
import { PAYMENT_METHOD_LABELS, CURRENCY_SYMBOLS } from "@/lib/constants/payments"
import { LANGUAGE_LABELS, COUNTRY_LABELS } from "@/lib/constants/localization"

/* ── Helpers ───────────────────────────────────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        {icon && <Icon name={icon} size="md" className="text-primary" />}
        {title}
      </h3>
      {children}
    </div>
  )
}

function ReviewRow({ label, value, dir }: { label: string; value: React.ReactNode; dir?: string }) {
  if (!value || value === "") return null
  return (
    <div className="flex items-start justify-between py-1.5 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-bold text-foreground text-start`} dir={dir}>
        {value}
      </span>
    </div>
  )
}

function SummaryAmountRow({
  label,
  value,
  color,
  bold,
  large,
}: {
  label: string
  value: string
  color?: string
  bold?: boolean
  large?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${bold ? "font-bold" : ""} text-muted-foreground`}>{label}</span>
      <span
        className={`tabular-nums ${large ? "text-lg font-bold" : "text-sm"} ${
          bold ? "font-bold" : ""
        } ${color || "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "₪"
  return `${symbol}${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ValidationWarning {
  message: string
  step: number
  icon: string
}

function getValidationWarnings(store: ReservationFormStore): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  if (!store.firstName || !store.lastName) {
    warnings.push({ message: "שם אורח חסר", step: 0, icon: "person" })
  }
  if (!store.phone) {
    warnings.push({ message: "טלפון חסר", step: 0, icon: "phone" })
  }
  if (!store.checkIn || !store.checkOut) {
    warnings.push({ message: "תאריכים חסרים", step: 1, icon: "calendar_today" })
  }
  if (store.checkIn && store.checkOut && store.checkOut <= store.checkIn) {
    warnings.push({ message: "תאריך יציאה לא תקין", step: 1, icon: "error" })
  }
  if (store.rooms.length === 0 && !store.roomId && !store.roomTypeId) {
    warnings.push({ message: "לא נבחר חדר", step: 1, icon: "bed" })
  }
  if (store.pricePerNight === 0 && store.rooms.length === 0) {
    warnings.push({ message: "מחיר לא הוגדר", step: 2, icon: "payments" })
  }

  return warnings
}

/* ── Component ─────────────────────────────────────────────── */

export function Step4Review() {
  const store = useReservationFormStore()
  const warnings = getValidationWarnings(store)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Validation Warnings ──────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Icon name="priority_high" size="sm" className="text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{w.message}</span>
              </div>
              <button
                type="button"
                onClick={() => store.setActiveTab(w.step)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg transition-colors"
              >
                לשלב {w.step + 1}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 1. Guest Summary ─────────────────────────────────── */}
      <SectionCard title="פרטי אורח" icon="person">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-base font-bold text-foreground">
              {store.fullName || `${store.firstName} ${store.lastName}`.trim() || "---"}
            </span>
            {store.isVip && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[12px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Icon name="crown" size="sm" />
                VIP
              </span>
            )}
          </div>
          <ReviewRow label="טלפון" value={store.phone} dir="ltr" />
          <ReviewRow label="אימייל" value={store.email} dir="ltr" />
          <ReviewRow label="ת.ז / דרכון" value={store.idNumber} dir="ltr" />
          <ReviewRow label="מדינה" value={COUNTRY_LABELS[store.country] || store.country} />
          <ReviewRow label="שפה" value={LANGUAGE_LABELS[store.language] || store.language} />
          {store.source && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">מקור</span>
              <SourceBadge value={store.source} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 2. Stay Summary ──────────────────────────────────── */}
      <SectionCard title="פרטי שהייה" icon="calendar_today">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between py-2 mb-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="login" size="sm" className="text-emerald-500" />
              <span>כניסה</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
              {store.checkIn || "---"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 mb-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="logout" size="sm" className="text-red-500" />
              <span>יציאה</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
              {store.checkOut || "---"}
            </span>
          </div>

          <div className="bg-primary/5 rounded-lg px-3 py-2 text-center mb-2">
            <span className="text-sm font-bold text-primary tabular-nums">{store.nights} לילות</span>
          </div>

          <ReviewRow label="שעת כניסה" value={store.checkInTime} dir="ltr" />
          <ReviewRow label="שעת יציאה" value={store.checkOutTime} dir="ltr" />

          <div className="border-t border-border/20 mt-2 pt-2">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Icon name="person" size="sm" className="text-muted-foreground" />
                <span className="text-sm tabular-nums">{store.adults} מבוגרים</span>
              </div>
              {store.children > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="group" size="sm" className="text-muted-foreground" />
                  <span className="text-sm tabular-nums">{store.children} ילדים</span>
                </div>
              )}
              {store.infants > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="child_care" size="sm" className="text-muted-foreground" />
                  <span className="text-sm tabular-nums">{store.infants} תינוקות</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Rooms Summary ─────────────────────────────────── */}
      <SectionCard title="חדרים" icon="bed">
        {store.rooms.length > 0 ? (
          <div className="flex flex-col gap-2">
            {store.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between bg-accent/50 rounded-xl px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground">
                    חדר {room.roomId ? `#${room.roomId.slice(0, 6)}` : "---"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {BOARD_TYPE_LABELS[room.boardType] || room.boardType}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {formatCurrency(room.ratePerNight, store.currency)} / לילה
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-4 py-3">
            <Icon name="priority_high" size="sm" className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-300">לא נבחרו חדרים</span>
          </div>
        )}
      </SectionCard>

      {/* ── 4. Pricing Summary ───────────────────────────────── */}
      <SectionCard title="סיכום תמחור" icon="payments">
        <div className="flex flex-col gap-1">
          <SummaryAmountRow
            label="סכום בסיסי"
            value={formatCurrency(store.baseAmount, store.currency)}
          />
          {store.discountTotal > 0 && (
            <SummaryAmountRow
              label="הנחה"
              value={`-${formatCurrency(store.discountTotal, store.currency)}`}
              color="text-emerald-600 dark:text-emerald-400"
            />
          )}
          {store.extraCharges > 0 && (
            <SummaryAmountRow
              label="תוספות"
              value={`+${formatCurrency(store.extraCharges, store.currency)}`}
            />
          )}
          <SummaryAmountRow
            label="מע״מ"
            value={`+${formatCurrency(store.taxAmount, store.currency)}`}
          />

          <div className="border-t border-border/30 my-2" />

          <SummaryAmountRow
            label="סה״כ לתשלום"
            value={formatCurrency(store.grandTotal, store.currency)}
            large
            bold
            color="text-[#003aa0] dark:text-blue-400"
          />
          <SummaryAmountRow
            label="יתרה לתשלום"
            value={formatCurrency(store.balanceDue, store.currency)}
            bold
            color={store.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}
          />
        </div>
      </SectionCard>

      {/* ── 5. Payment Summary ───────────────────────────────── */}
      <SectionCard title="פרטי תשלום" icon="credit_card">
        <div className="flex flex-col gap-1">
          <ReviewRow
            label="אמצעי תשלום"
            value={PAYMENT_METHOD_LABELS[store.paymentMethod] || store.paymentMethod || "---"}
          />

          {store.paymentStatus && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">סטטוס תשלום</span>
              <StatusPill type="payment" value={store.paymentStatus} />
            </div>
          )}

          {store.paymentMethod === "credit_card" && (
            <>
              {store.cardLast4 && (
                <ReviewRow label="כרטיס" value={`**** ${store.cardLast4}`} dir="ltr" />
              )}
              {store.cardApprovalCode && (
                <ReviewRow label="קוד אישור" value={store.cardApprovalCode} dir="ltr" />
              )}
              {store.paymentResult && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">תוצאת חיוב</span>
                  <StatusPill type="paymentResult" value={store.paymentResult} />
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* ── 6. Notes ─────────────────────────────────────────── */}
      {(store.generalNotes || store.internalNotes) && (
        <SectionCard title="הערות" icon="sticky_note_2">
          <div className="flex flex-col gap-3">
            {store.generalNotes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground mb-1 block">הערות כלליות</span>
                <p className="text-sm text-foreground bg-accent/50 rounded-xl px-4 py-3 whitespace-pre-wrap">
                  {store.generalNotes}
                </p>
              </div>
            )}
            {store.internalNotes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground mb-1 block">הערות פנימיות</span>
                <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/20 rounded-xl px-4 py-3 whitespace-pre-wrap">
                  {store.internalNotes}
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 7. Attachments ───────────────────────────────────── */}
      <SectionCard title={`קבצים מצורפים (${store.attachments.length})`} icon="attach_file">
        <FileUploadArea />
      </SectionCard>
    </div>
  )
}

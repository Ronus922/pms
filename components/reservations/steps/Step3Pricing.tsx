"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { StatusPill } from "@/components/reservations/StatusPill"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { PAYMENT_METHODS, CURRENCY_OPTIONS, CURRENCY_SYMBOLS } from "@/lib/constants/payments"

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: String(i + 1).padStart(2, "0"),
}))

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 11 }, (_, i) => ({
  value: String(currentYear + i),
  label: String(currentYear + i),
}))

/* ── Helpers ───────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function SummaryRow({
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

/* ── Component ─────────────────────────────────────────────── */

export function Step3Pricing() {
  const store = useReservationFormStore()
  const sym = CURRENCY_SYMBOLS[store.currency] || "₪"

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Pricing Card ──────────────────────────────────── */}
      <SectionCard title="תמחור">
        {store.rooms.length > 0 ? (
          <div className="flex flex-col gap-3">
            {/* Per-room rate summary */}
            {store.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between bg-accent/50 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Icon name="bed" size="sm" className="text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    חדר {room.roomId ? `#${room.roomId.slice(0, 6)}` : room.roomTypeId.slice(0, 8)}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(room.ratePerNight, store.currency)} / לילה
                </span>
              </div>
            ))}

            {/* Total nightly rate */}
            <div className="flex items-center justify-between border-t border-border/20 pt-3">
              <span className="text-sm font-bold text-muted-foreground">סה״כ ללילה</span>
              <span className="text-sm font-bold tabular-nums text-primary">
                {formatCurrency(store.totalNightlyRate, store.currency)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="מחיר ללילה" required error={store.errors.pricePerNight}>
              <div className="relative">
                <input
                  type="number"
                  value={store.pricePerNight || ""}
                  onChange={(e) => store.setField("pricePerNight", Number(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  dir="ltr"
                  className={`${inputClass} pe-12 text-start tabular-nums`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                  {sym}
                </div>
              </div>
            </FormField>

            <FormField label="מטבע" error={store.errors.currency}>
              <select
                value={store.currency}
                onChange={(e) => store.setField("currency", e.target.value)}
                className={selectClass}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        {/* Nights + Base Amount (always shown) */}
        <div className="grid grid-cols-2 gap-4 mt-4 max-sm:grid-cols-1">
          <FormField label="מספר לילות">
            <div className={`${inputClass} bg-muted/50 tabular-nums flex items-center`}>
              {store.nights}
            </div>
          </FormField>

          <FormField label="סכום בסיסי">
            <div className={`${inputClass} bg-muted/50 tabular-nums flex items-center`}>
              {formatCurrency(store.baseAmount, store.currency)}
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* ── 2. Discounts ─────────────────────────────────────── */}
      <SectionCard title="הנחות">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label="הנחה בסכום" error={store.errors.discountAmount}>
            <div className="relative">
              <input
                type="number"
                value={store.discountAmount || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0
                  store.setField("discountAmount", val)
                  if (val > 0) store.setField("discountPercent", 0)
                }}
                placeholder="0"
                min={0}
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                {sym}
              </div>
            </div>
          </FormField>

          <FormField label="הנחה באחוזים" error={store.errors.discountPercent}>
            <div className="relative">
              <input
                type="number"
                value={store.discountPercent || ""}
                onChange={(e) => {
                  const val = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                  store.setField("discountPercent", val)
                  if (val > 0) store.setField("discountAmount", 0)
                }}
                placeholder="0"
                min={0}
                max={100}
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                %
              </div>
            </div>
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label="תוספות" error={store.errors.extraCharges}>
            <div className="relative">
              <input
                type="number"
                value={store.extraCharges || ""}
                onChange={(e) => store.setField("extraCharges", Number(e.target.value) || 0)}
                placeholder="0"
                min={0}
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                {sym}
              </div>
            </div>
          </FormField>
        </div>

        {/* Tax Exempt Toggle */}
        <div className="mt-4 bg-accent/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="public" size="md" className="text-muted-foreground" />
              <div>
                <span className="text-sm font-bold text-foreground">פטור ממע״מ</span>
                <p className="text-xs text-muted-foreground mt-0.5">תושב חוץ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => store.setField("taxExempt", !store.taxExempt)}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                store.taxExempt ? "bg-primary" : "bg-border/40"
              }`}
              aria-label="פטור ממע״מ"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${
                  store.taxExempt ? "left-0.5" : "left-[calc(100%-1.625rem)]"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tax Amount */}
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            מע״מ ({store.taxExempt ? "פטור" : "17%"})
          </span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(store.taxAmount, store.currency)}
          </span>
        </div>
      </SectionCard>

      {/* ── 3. Totals Card ───────────────────────────────────── */}
      <SectionCard title="סיכום תשלום">
        <div className="flex flex-col gap-1">
          <SummaryRow
            label="סכום בסיסי"
            value={formatCurrency(store.baseAmount, store.currency)}
          />
          {store.discountTotal > 0 && (
            <SummaryRow
              label="הנחה"
              value={`-${formatCurrency(store.discountTotal, store.currency)}`}
              color="text-emerald-600 dark:text-emerald-400"
            />
          )}
          {store.extraCharges > 0 && (
            <SummaryRow
              label="תוספות"
              value={`+${formatCurrency(store.extraCharges, store.currency)}`}
            />
          )}
          <SummaryRow
            label="מע״מ"
            value={`+${formatCurrency(store.taxAmount, store.currency)}`}
          />

          {/* Divider */}
          <div className="border-t border-border/30 my-2" />

          <SummaryRow
            label="סה״כ לתשלום"
            value={formatCurrency(store.grandTotal, store.currency)}
            large
            bold
            color="text-[#003aa0] dark:text-blue-400"
          />
          <SummaryRow
            label="שולם"
            value={formatCurrency(store.amountPaid, store.currency)}
          />
          <SummaryRow
            label="מקדמה"
            value={formatCurrency(store.deposit, store.currency)}
          />
          <SummaryRow
            label="יתרה לתשלום"
            value={formatCurrency(store.balanceDue, store.currency)}
            bold
            color={store.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}
          />
        </div>
      </SectionCard>

      {/* ── 4. Payment Method ────────────────────────────────── */}
      <SectionCard title="אמצעי תשלום">
        <div className="flex flex-col gap-4">
          <FormField label="אמצעי תשלום" error={store.errors.paymentMethod}>
            <select
              value={store.paymentMethod}
              onChange={(e) => store.setField("paymentMethod", e.target.value)}
              className={selectClass}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="מקדמה" error={store.errors.deposit}>
              <div className="relative">
                <input
                  type="number"
                  value={store.deposit || ""}
                  onChange={(e) => store.setField("deposit", Number(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  dir="ltr"
                  className={`${inputClass} pe-12 text-start tabular-nums`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                  {sym}
                </div>
              </div>
            </FormField>

            <FormField label="סכום ששולם" error={store.errors.amountPaid}>
              <div className="relative">
                <input
                  type="number"
                  value={store.amountPaid || ""}
                  onChange={(e) => store.setField("amountPaid", Number(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  dir="ltr"
                  className={`${inputClass} pe-12 text-start tabular-nums`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 end-4 text-muted-foreground pointer-events-none text-sm font-bold">
                  {sym}
                </div>
              </div>
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── 5. Credit Card (conditional) ─────────────────────── */}
      {store.paymentMethod === "credit_card" && (
        <SectionCard title="פרטי כרטיס אשראי">
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="שם בעל הכרטיס" error={store.errors.cardHolderName}>
              <input
                type="text"
                value={store.cardHolderName}
                onChange={(e) => store.setField("cardHolderName", e.target.value)}
                placeholder="שם מלא"
                className={inputClass}
              />
            </FormField>

            <FormField label="4 ספרות אחרונות" error={store.errors.cardLast4}>
              <input
                type="text"
                value={store.cardLast4}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4)
                  store.setField("cardLast4", val)
                }}
                placeholder="1234"
                maxLength={4}
                dir="ltr"
                className={`${inputClass} text-start tabular-nums`}
              />
            </FormField>

            <FormField label="חודש תוקף" error={store.errors.cardExpiryMonth}>
              <select
                value={store.cardExpiryMonth}
                onChange={(e) => store.setField("cardExpiryMonth", e.target.value)}
                className={selectClass}
              >
                <option value="">חודש</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="שנת תוקף" error={store.errors.cardExpiryYear}>
              <select
                value={store.cardExpiryYear}
                onChange={(e) => store.setField("cardExpiryYear", e.target.value)}
                className={selectClass}
              >
                <option value="">שנה</option>
                {YEARS.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="קוד אישור" error={store.errors.cardApprovalCode}>
              <input
                type="text"
                value={store.cardApprovalCode}
                onChange={(e) => store.setField("cardApprovalCode", e.target.value)}
                placeholder="קוד אישור"
                dir="ltr"
                className={`${inputClass} text-start tabular-nums`}
              />
            </FormField>

            <FormField label="מספר עסקה" error={store.errors.cardTransactionRef}>
              <input
                type="text"
                value={store.cardTransactionRef}
                onChange={(e) => store.setField("cardTransactionRef", e.target.value)}
                placeholder="מספר עסקה"
                dir="ltr"
                className={`${inputClass} text-start tabular-nums`}
              />
            </FormField>

            <FormField label="תשלומים" error={store.errors.cardInstallments}>
              <input
                type="number"
                value={store.cardInstallments}
                onChange={(e) => {
                  const val = Math.min(36, Math.max(1, Number(e.target.value) || 1))
                  store.setField("cardInstallments", val)
                }}
                min={1}
                max={36}
                dir="ltr"
                className={`${inputClass} text-start tabular-nums`}
              />
            </FormField>
          </div>

          {/* Charge Now Button */}
          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => store.setField("paymentResult", "approved")}
              className="min-h-[44px] px-8 py-3 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Icon name="credit_card" size="md" className="text-white" />
              חייב עכשיו
            </button>

            {store.paymentResult && (
              <StatusPill type="paymentResult" value={store.paymentResult} size="md" />
            )}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { StatusPill } from "@/components/reservations/StatusPill"
import { ExtraChargesEditor } from "@/components/reservations/ExtraChargesEditor"
import { Icon } from "@/components/shared/Icon"
import {
  PricingEditor,
  type PricingRoomLine,
  type RatePlanOption,
} from "@/components/reservations/pricing/PricingEditor"
import { CardFields } from "@/components/reservations/pricing/CardFields"
import { SectionCard } from "@/components/reservations/pricing/shared"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { getTenantSettings } from "@/lib/actions/settings"
import { enumerateNights } from "@/lib/pricing/engine"
import { PAYMENT_METHODS, CURRENCY_SYMBOLS } from "@/lib/constants/payments"

/**
 * Create-flow pricing step. Every control lives in PricingEditor / CardFields,
 * which the edit panel renders too — the two surfaces cannot drift apart
 * because there is only one of each.
 */
export function Step3Pricing() {
  const store = useReservationFormStore()
  const { tenantId } = useTenant()
  const sym = CURRENCY_SYMBOLS[store.currency] || "₪"

  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["ILS"])

  useEffect(() => {
    let cancelled = false
    getFormOptions(tenantId)
      .then((opts) => {
        if (cancelled) return
        setRatePlans(
          (opts.ratePlans ?? []).map((p) => ({ id: String(p.id), name: String(p.name) })),
        )
      })
      .catch(() => {})
    getTenantSettings(tenantId)
      .then((s) => {
        if (cancelled) return
        setCurrencies(s.enabledCurrencies)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const rooms: PricingRoomLine[] = store.rooms.map((room) => ({
    id: room.id,
    label: `חדר ${room.roomNumber || room.roomId?.slice(0, 6) || "—"}`,
    ratePerNight: room.ratePerNight || 0,
    nights: enumerateNights(room.checkIn || store.checkIn, room.checkOut || store.checkOut).length,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PricingEditor
        value={{
          priceMode: store.priceMode,
          manualNightlyRate: store.manualNightlyRate,
          manualTotal: store.manualTotal,
          discountMode: store.discountMode,
          discountValue: store.discountValue,
          vatInclusive: store.vatInclusive,
          vatExempt: store.taxExempt,
          currency: store.currency,
          ratePlanId: store.ratePlanId || null,
        }}
        onChange={(key, next) => {
          if (key === "vatExempt") store.setField("taxExempt", next as boolean)
          else if (key === "ratePlanId") store.setField("ratePlanId", (next as string | null) ?? "")
          else store.setField(key, next as never)
        }}
        result={store.pricing}
        rooms={rooms}
        ratePlans={ratePlans}
        currencies={currencies}
        errors={store.errors}
        extraChargesSlot={
          <div>
            <h4 className="text-sm font-bold text-muted-foreground mb-3">תוספות</h4>
            <ExtraChargesEditor
              charges={store.extraCharges}
              currency={store.currency}
              onAdd={(c) => store.addExtraCharge(c)}
              onUpdate={(id, u) => store.updateExtraCharge(id, u)}
              onRemove={(id) => store.removeExtraCharge(id)}
            />
          </div>
        }
      />

      {/* ── Payment method ──────────────────────────────────── */}
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
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
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
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                  {sym}
                </div>
              </div>
            </FormField>
          </div>

          <p className="text-xs text-muted-foreground">
            המקדמה נחשבת לתשלום ואינה מנוכה פעם שנייה מהיתרה.
          </p>
        </div>
      </SectionCard>

      {/* ── Credit card ─────────────────────────────────────── */}
      {store.paymentMethod === "credit_card" && (
        <SectionCard title="פרטי כרטיס אשראי">
          <CardFields
            value={{
              cardHolderName: store.cardHolderName,
              cardLast4: store.cardLast4,
              cardHolderId: store.cardHolderId,
              cardExpiryMonth: store.cardExpiryMonth,
              cardExpiryYear: store.cardExpiryYear,
              cardInstallments: store.cardInstallments,
              cardApprovalCode: store.cardApprovalCode,
              cardTransactionRef: store.cardTransactionRef,
            }}
            onChange={(key, next) => store.setField(key, next as never)}
            errors={store.errors}
          />

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/50 px-4 py-3 text-xs text-muted-foreground">
            <Icon name="lock" size="sm" className="shrink-0 mt-0.5" />
            <span>
              נשמרות 4 הספרות האחרונות בלבד. מספר הכרטיס המלא וקוד ה-CVV אינם נשמרים במערכת
              בשום צורה.
            </span>
          </div>

          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => store.setField("paymentResult", "approved")}
              className="btn btn-primary"
            >
              <Icon name="credit_card" size="md" className="text-primary-foreground" />
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

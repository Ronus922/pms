"use client"

import { useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SmartField } from "@/components/reservations/FieldLock"
import {
  PricingEditor,
  type RatePlanOption,
} from "@/components/reservations/pricing/PricingEditor"
import { RoomPricingRow } from "@/components/reservations/pricing/RoomPricingRow"
import { CardFields } from "@/components/reservations/pricing/CardFields"
import { SectionCard, formatCurrency } from "@/components/reservations/pricing/shared"
import {
  priceEditableRooms,
  useReservationEditStore,
} from "@/lib/stores/reservation-edit-store"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { getTenantSettings } from "@/lib/actions/settings"
import { enumerateNights } from "@/lib/pricing/engine"
import { PAYMENT_METHODS, CURRENCY_SYMBOLS } from "@/lib/constants/payments"

/** Shown on the reservation-level editor when its own manual total is the
 *  authoritative figure and the per-room sum is therefore not. */
const RESERVATION_OVERRIDES_ROOMS =
  'ההזמנה במצב "סה״כ מחיר ידני" — הסכום שהוזן כאן גובר על סכום החדרים. ' +
  "התמחור פר-חדר נשמר אך אינו משנה את הסה״כ; עבור למצב אחר כדי שסכום החדרים יקבע."

/**
 * Edit-flow pricing step. Renders the SAME PricingEditor / CardFields as the
 * create wizard, so the two surfaces cannot drift.
 *
 * Card entry is deliberately NOT wrapped in SmartField: a channel booking locks
 * guest identity and dates, but a clerk still has to record how that guest paid.
 */
export function EditStep3Pricing() {
  const store = useReservationEditStore()
  const { data, isExternal, editableRooms, payments, pricing, tenantId } = store
  const sym = CURRENCY_SYMBOLS[data.currency] || "₪"

  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["ILS"])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    getFormOptions(tenantId)
      .then((opts) => {
        if (cancelled) return
        const plans = (opts.ratePlans ?? []) as unknown as Array<{ id: string; name: string }>
        setRatePlans(plans.map((p) => ({ id: p.id, name: p.name })))
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

  /** A reservation-level manual total is the final word — the per-room sum
   *  cannot move it, so the room controls are shown but locked. */
  const reservationOverridesRooms = data.priceMode === "manual_total"

  // Priced through the SAME function the store used for the reservation total.
  // Two code paths pricing one room is how a screen starts disagreeing with the
  // number that gets saved.
  const roomPricing = useMemo(
    () => priceEditableRooms(data, editableRooms),
    [data, editableRooms],
  )

  return (
    <div className="flex flex-col gap-6">
      <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
        <PricingEditor
          value={{
            priceMode: data.priceMode,
            manualNightlyRate: data.manualNightlyRate,
            manualTotal: data.manualTotal,
            discountMode: data.discountMode,
            discountValue: data.discountValue,
            vatInclusive: data.vatInclusive,
            vatExempt: data.taxExempt,
            currency: data.currency,
            ratePlanId: data.ratePlanId || null,
          }}
          onChange={(key, next) => {
            if (key === "vatExempt") store.setField("taxExempt", next as boolean)
            else if (key === "ratePlanId") store.setField("ratePlanId", (next as string | null) ?? "")
            else store.setField(key, next as never)
          }}
          result={pricing}
          /* The per-room lines live in RoomPricingRow below, where they are also
           * editable. Repeating them here would show the same money twice. */
          rooms={[]}
          ratePlans={ratePlans}
          currencies={currencies}
          errors={store.errors}
          overriddenNotice={reservationOverridesRooms ? RESERVATION_OVERRIDES_ROOMS : null}
        />
      </SmartField>

      {/* ── Per-room pricing ────────────────────────────────── */}
      {editableRooms.length > 0 && (
        <SectionCard title="תמחור לפי חדר">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              לכל חדר אותן אפשרויות תמחור של ההזמנה. הסה״כ של כל חדר מחושב לפי הפקדים שלו,
              והנחת ההזמנה והתוספות מוחלות מעל סכום החדרים.
            </p>

            {editableRooms.map((room, idx) => (
              <RoomPricingRow
                key={room.id}
                label={`חדר ${room.roomNumber || room.roomTypeName || idx + 1}`}
                nightsCount={
                  enumerateNights(room.checkIn || data.checkIn, room.checkOut || data.checkOut)
                    .length
                }
                value={{
                  priceMode: room.priceMode,
                  manualNightlyRate: room.manualNightlyRate,
                  manualTotal: room.manualTotal,
                  discountMode: room.discountMode,
                  discountValue: room.discountValue,
                  vatInclusive: room.vatInclusive,
                  currency: room.currency || data.currency,
                }}
                onChange={(key, next) => {
                  // One invoice, one currency: the room picker writes the
                  // reservation's currency, which cascades back to every room.
                  if (key === "currency") store.setField("currency", next as string)
                  else store.updateEditableRoom(room.id, { [key]: next })
                }}
                result={roomPricing[idx].result}
                currencies={currencies}
                overridden={reservationOverridesRooms}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Payment method ──────────────────────────────────── */}
      <SectionCard title="אמצעי תשלום">
        <div className="flex flex-col gap-4">
          <FormField label="אמצעי תשלום" error={store.errors.paymentMethod}>
            <select
              value={data.paymentMethod}
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
                  value={data.deposit || ""}
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

            <FormField label="סכום ששולם" error={store.errors.totalPaid}>
              <div className="relative">
                <input
                  type="number"
                  value={data.totalPaid || ""}
                  onChange={(e) => store.setField("totalPaid", Number(e.target.value) || 0)}
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
      {data.paymentMethod === "credit_card" && (
        <SectionCard title="פרטי כרטיס אשראי">
          <CardFields
            value={{
              cardHolderName: data.cardHolderName,
              cardLast4: data.cardLast4,
              cardHolderId: data.cardHolderId,
              cardExpiryMonth: data.cardExpiryMonth,
              cardExpiryYear: data.cardExpiryYear,
              cardInstallments: data.cardInstallments,
              cardApprovalCode: data.cardApprovalCode,
              cardTransactionRef: data.cardTransactionRef,
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
        </SectionCard>
      )}

      {/* ── Payment history ─────────────────────────────────── */}
      {payments.length > 0 && (
        <SectionCard title={`היסטוריית תשלומים (${payments.length})`}>
          <div className="flex flex-col gap-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("he-IL")} • {p.method}
                  </span>
                  {p.status && <StatusPill type="paymentResult" value={p.status} size="sm" />}
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
                  {formatCurrency(Number(p.amount), data.currency)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

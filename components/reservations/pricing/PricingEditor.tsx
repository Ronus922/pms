"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { CURRENCY_SYMBOLS } from "@/lib/constants/payments"
import type { DiscountMode, PriceMode, PricingResult } from "@/lib/pricing/engine"
import { SectionCard, SummaryRow, ToggleSwitch, formatCurrency } from "./shared"

/**
 * The one pricing surface. Create, edit and per-room editing all render THIS —
 * there is no second copy to drift.
 *
 * Deliberately store-agnostic: it takes a value + onChange + an already-computed
 * PricingResult. The caller owns the store; this component owns the controls.
 * That is what lets the create wizard (useReservationFormStore) and the edit
 * panel (useReservationEditStore) share it without either knowing about the other.
 */

export interface PricingEditorValue {
  priceMode: PriceMode
  manualNightlyRate: number | null
  manualTotal: number | null
  discountMode: DiscountMode
  discountValue: number
  vatInclusive: boolean
  vatExempt: boolean
  currency: string
  ratePlanId: string | null
}

export interface PricingRoomLine {
  id: string
  label: string
  ratePerNight: number
  nights: number
}

export interface RatePlanOption {
  id: string
  name: string
}

const PRICE_MODES: Array<{ value: PriceMode; label: string }> = [
  { value: "auto", label: "מחיר מקורי (אוטומטי)" },
  { value: "manual_nightly", label: "מחיר ידני ללילה" },
  { value: "manual_total", label: "סה״כ מחיר ידני" },
]

const DISCOUNT_MODES: Array<{ value: DiscountMode; label: string; suffix: "%" | "amount" | null }> = [
  { value: "none", label: "מחיר מלא (בלי הנחה)", suffix: null },
  { value: "amount_per_night", label: "הנחה בסכום ללילה", suffix: "amount" },
  { value: "percent_per_night", label: "אחוז הנחה ללילה", suffix: "%" },
  { value: "amount_total", label: "הנחה בסכום להזמנה", suffix: "amount" },
  { value: "percent_total", label: "אחוז הנחה להזמנה", suffix: "%" },
]

export interface PricingEditorProps {
  value: PricingEditorValue
  onChange: <K extends keyof PricingEditorValue>(key: K, next: PricingEditorValue[K]) => void
  /** Computed by the caller through lib/pricing/engine — never recomputed here. */
  result: PricingResult
  rooms: PricingRoomLine[]
  ratePlans: RatePlanOption[]
  /** From tenants.enabled_currencies, not a code constant. */
  currencies: readonly string[]
  errors: Record<string, string | undefined>
  /** Human label of the LOS tier that won, for the badge. */
  losRuleLabel?: string | null
  /** The create flow supplies its ExtraChargesEditor here. */
  extraChargesSlot?: React.ReactNode
  /** Shown when a reservation-level manual total overrides room-level pricing. */
  overriddenNotice?: string | null
  disabled?: boolean
}

export function PricingEditor({
  value,
  onChange,
  result,
  rooms,
  ratePlans,
  currencies,
  errors,
  losRuleLabel,
  extraChargesSlot,
  overriddenNotice,
  disabled = false,
}: PricingEditorProps) {
  const [showNightly, setShowNightly] = useState(false)
  const [discountReset, setDiscountReset] = useState(false)
  const sym = CURRENCY_SYMBOLS[value.currency] || "₪"
  const discountMeta = DISCOUNT_MODES.find((d) => d.value === value.discountMode) ?? DISCOUNT_MODES[0]
  const isManualTotal = value.priceMode === "manual_total"

  /**
   * A discount of "20" means 20% in a percent mode and ₪20 in an amount mode.
   * Carrying the number across that boundary silently changes what the guest is
   * charged, and only the percent side is range-checked — so 20% → ₪20 passes
   * validation while quietly collapsing the discount. Switching between the two
   * families clears the value and says so; switching within a family keeps it.
   */
  const handleDiscountModeChange = (next: DiscountMode) => {
    const nextMeta = DISCOUNT_MODES.find((d) => d.value === next)
    const familyChanged =
      nextMeta?.suffix !== discountMeta.suffix && nextMeta?.suffix !== null && discountMeta.suffix !== null
    onChange("discountMode", next)
    if (familyChanged && value.discountValue > 0) {
      onChange("discountValue", 0)
      setDiscountReset(true)
    } else {
      setDiscountReset(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Pricing ─────────────────────────────────────────── */}
      <SectionCard title="פירוט תמחור">
        <div className="flex flex-col gap-4">
          {/* Rate plan + the tier that actually fired */}
          <FormField label="תוכנית תעריפים" error={errors.ratePlanId}>
            <div className="flex flex-col gap-2">
              <select
                value={value.ratePlanId ?? ""}
                onChange={(e) => onChange("ratePlanId", e.target.value || null)}
                className={selectClass}
                disabled={disabled}
              >
                <option value="">ללא תוכנית</option>
                {ratePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {losRuleLabel && (
                <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                  <Icon name="local_offer" size="sm" />
                  {losRuleLabel}
                </span>
              )}
            </div>
          </FormField>

          {/* Price mode */}
          <FormField label="אופן קביעת המחיר">
            <select
              value={value.priceMode}
              onChange={(e) => onChange("priceMode", e.target.value as PriceMode)}
              className={selectClass}
              disabled={disabled}
            >
              {PRICE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            {value.priceMode === "auto" && (
              <FormField label="תעריף מחושב ללילה">
                <div className={`${inputClass} bg-muted/50 tabular-nums flex items-center`} dir="ltr">
                  {formatCurrency(result.effectiveNightlyRate, value.currency)}
                </div>
              </FormField>
            )}

            {value.priceMode === "manual_nightly" && (
              <FormField label="מחיר ידני ללילה" required error={errors.manualNightlyRate}>
                <div className="relative">
                  <input
                    type="number"
                    value={value.manualNightlyRate ?? ""}
                    onChange={(e) =>
                      onChange("manualNightlyRate", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    dir="ltr"
                    disabled={disabled}
                    className={`${inputClass} pe-12 text-start tabular-nums`}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                    {sym}
                  </div>
                </div>
              </FormField>
            )}

            {isManualTotal && (
              <FormField label="סה״כ מחיר ידני" required error={errors.manualTotal}>
                <div className="relative">
                  <input
                    type="number"
                    value={value.manualTotal ?? ""}
                    onChange={(e) =>
                      onChange("manualTotal", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    dir="ltr"
                    disabled={disabled}
                    className={`${inputClass} pe-12 text-start tabular-nums`}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                    {sym}
                  </div>
                </div>
              </FormField>
            )}

            <FormField label="מטבע" error={errors.currency}>
              <select
                value={value.currency}
                onChange={(e) => onChange("currency", e.target.value)}
                className={selectClass}
                disabled={disabled}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c} ({CURRENCY_SYMBOLS[c] || c})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Per-room lines */}
          {rooms.length > 0 && (
            <div className="flex flex-col gap-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between bg-accent/50 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="bed" size="sm" className="text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground truncate">{room.label}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
                      {formatCurrency(room.ratePerNight * room.nights, value.currency)}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                      {formatCurrency(room.ratePerNight, value.currency)} × {room.nights} לילות
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overriddenNotice && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>{overriddenNotice}</span>
            </div>
          )}

          {/* Nightly breakdown */}
          {result.nights.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowNightly((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-2 -mx-2 min-h-11 text-xs font-bold text-primary"
                aria-expanded={showNightly}
              >
                <Icon name={showNightly ? "expand_less" : "expand_more"} size="sm" />
                פירוט לילי ({result.nights.length} לילות)
              </button>
              {showNightly && (
                <div className="mt-2 overflow-x-auto rounded-xl border border-border/20">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-start font-bold">תאריך</th>
                        <th className="px-4 py-3 text-start font-bold">תעריף</th>
                        <th className="px-4 py-3 text-start font-bold">מקור</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.nights.map((n) => (
                        <tr key={n.date} className="border-t border-border/15">
                          <td className="px-4 py-3 tabular-nums" dir="ltr">
                            {n.date}
                          </td>
                          <td className="px-4 py-3 tabular-nums" dir="ltr">
                            {formatCurrency(n.appliedRate, value.currency)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{NIGHT_SOURCE_LABELS[n.source]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Discount ────────────────────────────────────────── */}
      <SectionCard title="הנחות ותוספות">
        <div className="flex flex-col gap-4">
          {isManualTotal ? (
            <div className="flex items-start gap-2 rounded-xl bg-accent/50 px-4 py-3 text-xs text-muted-foreground">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>
                במצב &quot;סה״כ מחיר ידני&quot; הסכום שהוזן הוא הסכום הסופי. הנחות ותוספות אינן
                משנות אותו.
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <FormField label="סוג הנחה">
                  <select
                    value={value.discountMode}
                    onChange={(e) => handleDiscountModeChange(e.target.value as DiscountMode)}
                    className={selectClass}
                    disabled={disabled}
                  >
                    {DISCOUNT_MODES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                {discountMeta.suffix && (
                  <FormField label={discountMeta.label} error={errors.discountValue}>
                    <div className="relative">
                      <input
                        type="number"
                        value={value.discountValue || ""}
                        onChange={(e) => {
                          const raw = Number(e.target.value) || 0
                          onChange(
                            "discountValue",
                            discountMeta.suffix === "%" ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw),
                          )
                        }}
                        placeholder="0"
                        min={0}
                        max={discountMeta.suffix === "%" ? 100 : undefined}
                        dir="ltr"
                        disabled={disabled}
                        className={`${inputClass} pe-12 text-start tabular-nums`}
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                        {discountMeta.suffix === "%" ? "%" : sym}
                      </div>
                    </div>
                  </FormField>
                )}
              </div>

              {discountReset && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                  <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
                  <span>
                    ערך ההנחה אופס — מעבר בין הנחה באחוזים להנחה בסכום משנה את משמעות המספר.
                  </span>
                </div>
              )}

              {extraChargesSlot && <div>{extraChargesSlot}</div>}
            </>
          )}

          {/* VAT controls */}
          <div className="bg-accent/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="receipt_long" size="md" className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-foreground">המחיר כולל מע״מ</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {value.vatExempt
                      ? "פטור ממע״מ"
                      : value.vatInclusive
                        ? "המע״מ כלול בסכום שהוזן"
                        : "המע״מ יתווסף מעל הסכום שהוזן"}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={value.vatInclusive}
                onChange={(next) => onChange("vatInclusive", next)}
                label="המחיר כולל מע״מ"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/20 pt-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="public" size="md" className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-foreground">פטור ממע״מ</span>
                  <p className="text-xs text-muted-foreground mt-0.5">תושב חוץ</p>
                </div>
              </div>
              <ToggleSwitch
                checked={value.vatExempt}
                onChange={(next) => onChange("vatExempt", next)}
                label="פטור ממע״מ"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Summary ─────────────────────────────────────────── */}
      <SectionCard title="סיכום תשלום">
        <div className="flex flex-col gap-1">
          <SummaryRow
            label="סכום לפני הנחה"
            value={formatCurrency(result.grossBeforeDiscount, value.currency)}
          />
          {result.discountTotal > 0 && (
            <SummaryRow
              label="הנחה"
              value={`-${formatCurrency(result.discountTotal, value.currency)}`}
              color="text-emerald-600 dark:text-emerald-400"
            />
          )}
          {result.extraCharges > 0 && (
            <SummaryRow label="תוספות" value={`+${formatCurrency(result.extraCharges, value.currency)}`} />
          )}
          <SummaryRow label="סכום ללא מע״מ" value={formatCurrency(result.netAmount, value.currency)} />
          <SummaryRow
            label={
              value.vatExempt
                ? "מע״מ (פטור)"
                : `מע״מ (${(result.vatAmount / Math.max(result.netAmount, 1) * 100).toFixed(0)}%) — ${
                    value.vatInclusive ? "כלול" : "בנוסף"
                  }`
            }
            value={formatCurrency(result.vatAmount, value.currency)}
          />

          <div className="border-t border-border/30 my-2" />

          <SummaryRow
            label="סה״כ לתשלום"
            value={formatCurrency(result.grandTotal, value.currency)}
            large
            bold
            color="text-primary dark:text-blue-400"
          />
          <SummaryRow label="שולם" value={formatCurrency(result.paid, value.currency)} />
          <SummaryRow
            label={result.balanceDue < 0 ? "יתרת זכות" : "יתרה לתשלום"}
            value={formatCurrency(Math.abs(result.balanceDue), value.currency)}
            bold
            color={
              result.balanceDue > 0
                ? "text-red-600 dark:text-red-400"
                : result.balanceDue < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
            }
          />
        </div>
      </SectionCard>
    </div>
  )
}

const NIGHT_SOURCE_LABELS: Record<string, string> = {
  rate_override: "תעריף מיוחד",
  rate_plan_los: "הנחת אורך שהות",
  rate_plan: "תוכנית תעריפים",
  room_type_base: "מחיר בסיס",
  manual: "ידני",
}

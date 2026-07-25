"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { CURRENCY_SYMBOLS } from "@/lib/constants/payments"
import type { DiscountMode, PriceMode, PricingResult } from "@/lib/pricing/engine"
import type { RoomPricingControls } from "@/lib/pricing/rooms"
import {
  DISCOUNT_MODES,
  DISCOUNT_RESET_NOTICE,
  PRICE_MODES,
  SummaryRow,
  ToggleSwitch,
  discountFamilyChanged,
  discountMeta,
  formatCurrency,
  priceModeLabel,
} from "./shared"

/**
 * One room's pricing controls — the SAME set the reservation exposes in
 * PricingEditor, scoped to a single reservation_rooms row. Signoff item 7
 * ("אותן אפשרויות בעריכת חדר") is this component.
 *
 * Collapsed it is a summary line: room, effective nightly rate, room subtotal.
 * Expanded it reveals price mode, the manual value for that mode, discount,
 * the VAT-inclusive toggle and the currency.
 *
 * Deliberately store-agnostic, exactly like PricingEditor: value + onChange +
 * an already-computed PricingResult. `result` comes from lib/pricing/rooms →
 * lib/pricing/engine; not one figure is worked out in this file.
 */

export type RoomPricingValue = RoomPricingControls

export interface RoomPricingRowProps {
  label: string
  /** Nights this room is actually booked for. */
  nightsCount: number
  value: RoomPricingValue
  onChange: <K extends keyof RoomPricingValue>(key: K, next: RoomPricingValue[K]) => void
  /** Computed by the caller through lib/pricing/rooms — never recomputed here. */
  result: PricingResult
  /** From tenants.enabled_currencies, not a code constant. */
  currencies: readonly string[]
  /** True when a reservation-level manual total owns the final number. */
  overridden?: boolean
  disabled?: boolean
  error?: string
}

export function RoomPricingRow({
  label,
  nightsCount,
  value,
  onChange,
  result,
  currencies,
  overridden = false,
  disabled = false,
  error,
}: RoomPricingRowProps) {
  const [open, setOpen] = useState(false)
  const [discountReset, setDiscountReset] = useState(false)
  const sym = CURRENCY_SYMBOLS[value.currency] || "₪"
  const meta = discountMeta(value.discountMode)
  const locked = disabled || overridden

  const handleDiscountModeChange = (next: DiscountMode) => {
    const familyChanged = discountFamilyChanged(value.discountMode, next)
    onChange("discountMode", next)
    if (familyChanged && value.discountValue > 0) {
      onChange("discountValue", 0)
      setDiscountReset(true)
    } else {
      setDiscountReset(false)
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-card overflow-hidden ${
        overridden ? "border-amber-500/30" : "border-border/15"
      }`}
    >
      {/* ── Collapsed summary ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-11 text-start"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            name={open ? "expand_less" : "expand_more"}
            size="sm"
            className="text-muted-foreground shrink-0"
          />
          <Icon name="bed" size="sm" className="text-primary shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold text-foreground truncate">{label}</span>
            {overridden ? (
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 truncate">
                נקבע ברמת ההזמנה
              </span>
            ) : (
              value.priceMode !== "auto" && (
                <span className="text-[11px] text-primary font-bold truncate">
                  {priceModeLabel(value.priceMode)}
                </span>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-sm font-bold tabular-nums text-foreground" dir="ltr">
            {formatCurrency(result.grandTotal, value.currency)}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
            {formatCurrency(result.effectiveNightlyRate, value.currency)} × {nightsCount} לילות
          </span>
        </div>
      </button>

      {/* ── Expanded controls ───────────────────────────────── */}
      {open && (
        <div className="flex flex-col gap-4 border-t border-border/15 p-4">
          {overridden && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>
                ההזמנה נמצאת במצב &quot;סה״כ מחיר ידני&quot; — הסכום שנקבע ברמת ההזמנה הוא הקובע,
                והתמחור פר-חדר אינו משנה אותו. בטל את המצב הידני ברמת ההזמנה כדי לערוך כאן.
              </span>
            </div>
          )}

          <FormField label="אופן קביעת המחיר">
            <select
              value={value.priceMode}
              onChange={(e) => onChange("priceMode", e.target.value as PriceMode)}
              className={selectClass}
              disabled={locked}
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
                <div
                  className={`${inputClass} bg-muted/50 tabular-nums flex items-center`}
                  dir="ltr"
                >
                  {formatCurrency(result.effectiveNightlyRate, value.currency)}
                </div>
              </FormField>
            )}

            {value.priceMode === "manual_nightly" && (
              <FormField label="מחיר ידני ללילה" required>
                <div className="relative">
                  <input
                    type="number"
                    value={value.manualNightlyRate ?? ""}
                    onChange={(e) =>
                      onChange(
                        "manualNightlyRate",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    placeholder="0"
                    min={0}
                    dir="ltr"
                    disabled={locked}
                    className={`${inputClass} pe-12 text-start tabular-nums`}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                    {sym}
                  </div>
                </div>
              </FormField>
            )}

            {value.priceMode === "manual_total" && (
              <FormField label="סה״כ מחיר ידני לחדר" required>
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
                    disabled={locked}
                    className={`${inputClass} pe-12 text-start tabular-nums`}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                    {sym}
                  </div>
                </div>
              </FormField>
            )}

            <FormField label="מטבע">
              <div className="flex flex-col gap-2">
                <select
                  value={value.currency}
                  onChange={(e) => onChange("currency", e.target.value)}
                  className={selectClass}
                  disabled={locked}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c} ({CURRENCY_SYMBOLS[c] || c})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">
                  חשבונית אחת = מטבע אחד. שינוי כאן מחיל את המטבע על ההזמנה כולה.
                </span>
              </div>
            </FormField>
          </div>

          {/* Discount */}
          {value.priceMode === "manual_total" ? (
            <div className="flex items-start gap-2 rounded-xl bg-accent/50 px-4 py-3 text-xs text-muted-foreground">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>
                במצב &quot;סה״כ מחיר ידני&quot; הסכום שהוזן הוא הסכום הסופי לחדר. הנחה אינה משנה
                אותו.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <FormField label="סוג הנחה">
                <select
                  value={value.discountMode}
                  onChange={(e) => handleDiscountModeChange(e.target.value as DiscountMode)}
                  className={selectClass}
                  disabled={locked}
                >
                  {DISCOUNT_MODES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </FormField>

              {meta.suffix && (
                <FormField label={meta.label}>
                  <div className="relative">
                    <input
                      type="number"
                      value={value.discountValue || ""}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 0
                        onChange(
                          "discountValue",
                          meta.suffix === "%"
                            ? Math.min(100, Math.max(0, raw))
                            : Math.max(0, raw),
                        )
                      }}
                      placeholder="0"
                      min={0}
                      max={meta.suffix === "%" ? 100 : undefined}
                      dir="ltr"
                      disabled={locked}
                      className={`${inputClass} pe-12 text-start tabular-nums`}
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">
                      {meta.suffix === "%" ? "%" : sym}
                    </div>
                  </div>
                </FormField>
              )}
            </div>
          )}

          {discountReset && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>{DISCOUNT_RESET_NOTICE}</span>
            </div>
          )}

          {/* VAT — the RATE belongs to the reservation (the era it was sold in);
              only the convention is per room. */}
          <div className="bg-accent/50 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Icon name="receipt_long" size="md" className="text-muted-foreground shrink-0" />
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-bold text-foreground">מחיר החדר כולל מע״מ</span>
                <p className="text-xs text-muted-foreground">
                  {value.vatInclusive
                    ? "המע״מ כלול בתעריף שהוזן לחדר"
                    : "המע״מ יתווסף מעל התעריף שהוזן לחדר"}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={value.vatInclusive}
              onChange={(next) => onChange("vatInclusive", next)}
              label="מחיר החדר כולל מע״מ"
              disabled={locked}
            />
          </div>

          {/* Room summary — every figure straight off the engine result. */}
          <div className="flex flex-col gap-1 rounded-xl bg-accent/30 p-4">
            <SummaryRow
              label="סכום לפני הנחה"
              value={formatCurrency(result.grossBeforeDiscount, value.currency)}
            />
            {result.discountTotal > 0 && (
              <SummaryRow
                label="הנחת חדר"
                value={`-${formatCurrency(result.discountTotal, value.currency)}`}
                color="text-emerald-600 dark:text-emerald-400"
              />
            )}
            <SummaryRow
              label="סכום ללא מע״מ"
              value={formatCurrency(result.netAmount, value.currency)}
            />
            <SummaryRow label="מע״מ" value={formatCurrency(result.vatAmount, value.currency)} />
            <SummaryRow
              label="סה״כ לחדר"
              value={formatCurrency(result.grandTotal, value.currency)}
              bold
              color="text-primary dark:text-blue-400"
            />
          </div>

          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

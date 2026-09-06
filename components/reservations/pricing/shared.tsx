"use client"

import { CURRENCY_SYMBOLS } from "@/lib/constants/payments"
import type { DiscountMode, PriceMode } from "@/lib/pricing/engine"

/**
 * Primitives shared by the create and edit pricing surfaces.
 *
 * These were duplicated almost line-for-line across Step3Pricing /
 * EditStep3Pricing / Step4Review / EditStep4Summary. One definition, four
 * consumers — CLAUDE.md rule 8 (DRY components).
 */

/* ── Option lists ────────────────────────────────────────────
 * The reservation-level editor and the per-room row must offer the SAME
 * choices with the SAME labels, so the lists live here rather than in either
 * one of them. */

export const PRICE_MODES: ReadonlyArray<{ value: PriceMode; label: string }> = [
  { value: "auto", label: "מחיר מקורי (אוטומטי)" },
  { value: "manual_nightly", label: "מחיר ידני ללילה" },
  { value: "manual_total", label: "סה״כ מחיר ידני" },
]

/** `null` = the mode takes no value at all. */
export type DiscountSuffix = "%" | "amount" | null

export const DISCOUNT_MODES: ReadonlyArray<{
  value: DiscountMode
  label: string
  suffix: DiscountSuffix
}> = [
  { value: "none", label: "מחיר מלא (בלי הנחה)", suffix: null },
  { value: "amount_per_night", label: "הנחה בסכום ללילה", suffix: "amount" },
  { value: "percent_per_night", label: "אחוז הנחה ללילה", suffix: "%" },
  { value: "amount_total", label: "הנחה בסכום להזמנה", suffix: "amount" },
  { value: "percent_total", label: "אחוז הנחה להזמנה", suffix: "%" },
]

export function discountMeta(mode: DiscountMode) {
  return DISCOUNT_MODES.find((d) => d.value === mode) ?? DISCOUNT_MODES[0]
}

export function priceModeLabel(mode: PriceMode): string {
  return PRICE_MODES.find((m) => m.value === mode)?.label ?? mode
}

/**
 * A discount of "20" means 20% in a percent mode and ₪20 in an amount mode.
 * Carrying the number across that boundary silently changes what the guest is
 * charged, and only the percent side is range-checked — so 20% → ₪20 passes
 * validation while quietly collapsing the discount. Callers clear the value and
 * say so when this returns true; switching WITHIN a family keeps it.
 */
export function discountFamilyChanged(prev: DiscountMode, next: DiscountMode): boolean {
  const a = discountMeta(prev).suffix
  const b = discountMeta(next).suffix
  return a !== null && b !== null && a !== b
}

export const DISCOUNT_RESET_NOTICE =
  "ערך ההנחה אופס — מעבר בין הנחה באחוזים להנחה בסכום משנה את משמעות המספר."

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // Spacing lives on the parent as `gap`, not as a margin on the heading —
    // iron rule 4. The original copies of this card used `mb-4` on the <h3>.
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm flex flex-col gap-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export function SummaryRow({
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
        dir="ltr"
      >
        {value}
      </span>
    </div>
  )
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "₪"
  const abs = Math.abs(amount).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${amount < 0 ? "-" : ""}${symbol}${abs}`
}

/**
 * Pill switch. The visible track stays 48x28 to match the existing design, but
 * the hit area is padded out to the 44px minimum touch target (iron rule 6).
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`shrink-0 flex items-center justify-center min-w-11 min-h-11 px-2 py-2 -m-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span
        className={`block w-12 h-7 rounded-full transition-colors relative ${
          checked ? "bg-primary" : "bg-border/40"
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-0.5" : "left-[calc(100%-1.625rem)]"
          }`}
        />
      </span>
    </button>
  )
}

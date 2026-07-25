"use client"

import { CURRENCY_SYMBOLS } from "@/lib/constants/payments"

/**
 * Primitives shared by the create and edit pricing surfaces.
 *
 * These were duplicated almost line-for-line across Step3Pricing /
 * EditStep3Pricing / Step4Review / EditStep4Summary. One definition, four
 * consumers — CLAUDE.md rule 8 (DRY components).
 */

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
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="shrink-0 flex items-center justify-center min-w-11 min-h-11 px-2 py-2 -m-2"
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

"use client"

import { FormField, inputClass, selectClass } from "@/components/shared/FormField"

/**
 * Credit-card details, typed by a human at the desk. One definition used by BOTH
 * the create wizard and the edit panel — previously the edit panel had no inputs
 * at all, only a hardcoded masked string ("4580 **** **** ****") that was never
 * derived from any real data.
 *
 * PCI: this component deliberately captures only the LAST FOUR DIGITS. The full
 * PAN and the CVV are never collected here, never placed in a store, and never
 * persisted — not even encrypted. If a full number is ever needed for a charge,
 * it must go straight to the processor from the input without touching our state.
 *
 * External (channel) reservations lock guest identity and dates. They do NOT
 * lock payment entry — a front-desk clerk still has to record how a Booking.com
 * guest actually paid.
 */

export interface CardFieldsValue {
  cardHolderName: string
  /** Exactly what the name says. Never the full number. */
  cardLast4: string
  cardHolderId: string
  cardExpiryMonth: string
  cardExpiryYear: string
  cardInstallments: number
  cardApprovalCode: string
  cardTransactionRef: string
}

export interface CardFieldsProps {
  value: CardFieldsValue
  onChange: <K extends keyof CardFieldsValue>(key: K, next: CardFieldsValue[K]) => void
  errors?: Record<string, string | undefined>
  disabled?: boolean
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))

function expiryYears(): string[] {
  // Derived from the current year at render time; the list is short-lived UI
  // state, so there is nothing to snapshot.
  const current = new Date().getFullYear()
  return Array.from({ length: 11 }, (_, i) => String(current + i))
}

export function CardFields({ value, onChange, errors = {}, disabled = false }: CardFieldsProps) {
  const years = expiryYears()

  return (
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      <FormField label="שם בעל הכרטיס" error={errors.cardHolderName}>
        <input
          type="text"
          value={value.cardHolderName}
          onChange={(e) => onChange("cardHolderName", e.target.value)}
          placeholder="שם מלא"
          autoComplete="off"
          disabled={disabled}
          className={inputClass}
        />
      </FormField>

      <FormField label="4 ספרות אחרונות" error={errors.cardLast4}>
        <input
          type="text"
          inputMode="numeric"
          value={value.cardLast4}
          onChange={(e) => onChange("cardLast4", e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          maxLength={4}
          dir="ltr"
          autoComplete="off"
          disabled={disabled}
          className={`${inputClass} text-start tabular-nums`}
        />
      </FormField>

      <FormField label="ת.ז. בעל הכרטיס" error={errors.cardHolderId}>
        <input
          type="text"
          inputMode="numeric"
          value={value.cardHolderId}
          onChange={(e) => onChange("cardHolderId", e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="000000000"
          maxLength={9}
          dir="ltr"
          autoComplete="off"
          disabled={disabled}
          className={`${inputClass} text-start tabular-nums`}
        />
      </FormField>

      <FormField
        label="תוקף (חודש / שנה)"
        error={errors.cardExpiryMonth || errors.cardExpiryYear}
      >
        <div className="grid grid-cols-2 gap-2">
          <select
            value={value.cardExpiryMonth}
            onChange={(e) => onChange("cardExpiryMonth", e.target.value)}
            className={selectClass}
            aria-label="חודש תוקף"
            disabled={disabled}
          >
            <option value="">חודש</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={value.cardExpiryYear}
            onChange={(e) => onChange("cardExpiryYear", e.target.value)}
            className={selectClass}
            aria-label="שנת תוקף"
            disabled={disabled}
          >
            <option value="">שנה</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </FormField>

      <FormField label="תשלומים" error={errors.cardInstallments}>
        <input
          type="number"
          value={value.cardInstallments || 1}
          onChange={(e) =>
            onChange("cardInstallments", Math.min(36, Math.max(1, Number(e.target.value) || 1)))
          }
          min={1}
          max={36}
          dir="ltr"
          disabled={disabled}
          className={`${inputClass} text-start tabular-nums`}
        />
      </FormField>

      <FormField label="קוד אישור" error={errors.cardApprovalCode}>
        <input
          type="text"
          value={value.cardApprovalCode}
          onChange={(e) => onChange("cardApprovalCode", e.target.value.slice(0, 32))}
          placeholder="קוד אישור מחברת האשראי"
          dir="ltr"
          autoComplete="off"
          disabled={disabled}
          className={`${inputClass} text-start`}
        />
      </FormField>

      <FormField label="אסמכתא / מספר עסקה" error={errors.cardTransactionRef}>
        <input
          type="text"
          value={value.cardTransactionRef}
          onChange={(e) => onChange("cardTransactionRef", e.target.value.slice(0, 64))}
          placeholder="מספר אסמכתא"
          dir="ltr"
          autoComplete="off"
          disabled={disabled}
          className={`${inputClass} text-start`}
        />
      </FormField>
    </div>
  )
}

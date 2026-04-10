/* ── Payment Constants — SINGLE SOURCE OF TRUTH ──────────── */

export const PAYMENT_METHODS = [
  { value: "", label: "בחר אמצעי תשלום..." },
  { value: "cash", label: "מזומן" },
  { value: "credit_card", label: "כרטיס אשראי" },
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "check", label: "צ׳ק" },
  { value: "bit", label: "ביט" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "אחר" },
] as const

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.filter((m) => m.value).map((m) => [m.value, m.label])
)

export const CURRENCY_OPTIONS = [
  { value: "ILS", label: "ILS (₪)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
] as const

export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
}

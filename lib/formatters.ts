import { format, isValid, parseISO } from "date-fns"
import { he } from "date-fns/locale"

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatDate(value: string | null | undefined, pattern = "dd/MM/yyyy") {
  if (!value) return "—"
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, pattern, { locale: he }) : value
}

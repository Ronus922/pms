"use client"

import { Icon } from "@/components/shared/Icon"

/* ── Reservation Status ─────────────────────────────────────── */

const RESERVATION_STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  confirmed:    { label: "מאושר",    color: "emerald", icon: "check_circle" },
  pending:      { label: "ממתין",    color: "amber",   icon: "hourglass_empty" },
  cancelled:    { label: "בוטל",     color: "red",     icon: "block" },
  no_show:      { label: "לא הגיע",  color: "slate",   icon: "person_off" },
  checked_in:   { label: "נכנס",     color: "blue",    icon: "login" },
  checked_out:  { label: "יצא",      color: "gray",    icon: "logout" },
  draft:        { label: "טיוטה",    color: "slate",   icon: "edit" },
}

/* ── Payment Status ─────────────────────────────────────────── */

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  paid:             { label: "שולם",        color: "emerald", icon: "check_circle" },
  fully_paid:       { label: "שולם במלואו", color: "emerald", icon: "done_all" },
  partially_paid:   { label: "שולם חלקית",  color: "amber",   icon: "percent" },
  unpaid:           { label: "לא שולם",     color: "red",     icon: "error" },
  refunded:         { label: "הוחזר",       color: "purple",  icon: "receipt_long" },
  failed:           { label: "נכשל",        color: "red",     icon: "error" },
  pending_transfer: { label: "ממתין להעברה", color: "amber",  icon: "hourglass_empty" },
  pending_approval: { label: "ממתין לאישור", color: "amber",  icon: "hourglass_empty" },
  cancelled:        { label: "בוטל",        color: "slate",   icon: "block" },
}

/* ── Payment Result ─────────────────────────────────────────── */

const PAYMENT_RESULT_MAP: Record<string, { label: string; color: string; icon: string }> = {
  approved: { label: "אושר",       color: "emerald", icon: "check_circle" },
  declined: { label: "נדחה",       color: "red",     icon: "block" },
  refused:  { label: "סורב",       color: "red",     icon: "error" },
  stolen:   { label: "כרטיס גנוב", color: "red",     icon: "priority_high" },
  error:    { label: "שגיאה",      color: "amber",   icon: "error" },
}

/* ── Color Map ──────────────────────────────────────────────── */

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/20",     text: "text-amber-700 dark:text-amber-400",     border: "border-amber-200 dark:border-amber-800" },
  red:     { bg: "bg-red-50 dark:bg-red-950/20",         text: "text-red-700 dark:text-red-400",         border: "border-red-200 dark:border-red-800" },
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/20",       text: "text-blue-700 dark:text-blue-400",       border: "border-blue-200 dark:border-blue-800" },
  purple:  { bg: "bg-purple-50 dark:bg-purple-950/20",   text: "text-purple-700 dark:text-purple-400",   border: "border-purple-200 dark:border-purple-800" },
  slate:   { bg: "bg-slate-100 dark:bg-slate-800/30",    text: "text-slate-600 dark:text-slate-400",     border: "border-slate-200 dark:border-slate-700" },
  gray:    { bg: "bg-gray-100 dark:bg-gray-800/30",      text: "text-gray-600 dark:text-gray-400",       border: "border-gray-200 dark:border-gray-700" },
}

/* ── Component ──────────────────────────────────────────────── */

interface StatusPillProps {
  type: "reservation" | "payment" | "paymentResult"
  value: string
  size?: "sm" | "md"
}

export function StatusPill({ type, value, size = "sm" }: StatusPillProps) {
  const map =
    type === "reservation" ? RESERVATION_STATUS_MAP :
    type === "payment" ? PAYMENT_STATUS_MAP :
    PAYMENT_RESULT_MAP

  const item = map[value]
  if (!item) return <span className="text-xs text-muted-foreground">{value}</span>

  const colors = COLOR_MAP[item.color] || COLOR_MAP.slate

  const sizeClass = size === "md"
    ? "px-3 py-1.5 text-xs gap-1.5"
    : "px-2.5 py-1 text-[11px] gap-1"

  return (
    <span className={`inline-flex items-center font-bold rounded-full border ${sizeClass} ${colors.bg} ${colors.text} ${colors.border}`}>
      <Icon name={item.icon} size="sm" />
      {item.label}
    </span>
  )
}

/* ── Color helper for inline usage (e.g. selects) ──────────── */

export function getStatusColorClass(
  type: "reservation" | "payment" | "paymentResult",
  value: string,
): string {
  const map =
    type === "reservation" ? RESERVATION_STATUS_MAP :
    type === "payment" ? PAYMENT_STATUS_MAP :
    PAYMENT_RESULT_MAP
  const item = map[value]
  if (!item) return ""
  const colors = COLOR_MAP[item.color]
  return colors ? `${colors.bg} ${colors.text}` : ""
}

/* ── Exports for dropdowns ──────────────────────────────────── */

export const RESERVATION_STATUSES = Object.entries(RESERVATION_STATUS_MAP).map(([value, { label }]) => ({ value, label }))
export const PAYMENT_STATUSES = Object.entries(PAYMENT_STATUS_MAP).map(([value, { label }]) => ({ value, label }))
export const PAYMENT_RESULTS = Object.entries(PAYMENT_RESULT_MAP).map(([value, { label }]) => ({ value, label }))

export { RESERVATION_STATUS_MAP, PAYMENT_STATUS_MAP, PAYMENT_RESULT_MAP }

/* ── Reservation Constants — SINGLE SOURCE OF TRUTH ─────── */

/* ── Board / Meal Plan Types ──────────────────────────────── */

export const BOARD_TYPES = [
  { value: "room_only", label: "לינה בלבד" },
  { value: "none", label: "ללא" },
  { value: "breakfast", label: "ארוחת בוקר" },
  { value: "half_board", label: "חצי פנסיון" },
  { value: "full_board", label: "פנסיון מלא" },
  { value: "all_inclusive", label: "הכל כלול" },
] as const

export const BOARD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BOARD_TYPES.map((b) => [b.value, b.label])
)

/* ── Booking Sources (dropdown list) ─────────────────────── */

export const BOOKING_SOURCE_OPTIONS = [
  { value: "", label: "בחר מקור..." },
  { value: "direct", label: "ישיר" },
  { value: "phone", label: "טלפון" },
  { value: "website", label: "אתר" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "booking.com", label: "Booking.com" },
  { value: "expedia", label: "Expedia" },
  { value: "airbnb", label: "Airbnb" },
  { value: "agent", label: "סוכן" },
  { value: "corporate", label: "חברה" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "אחר" },
] as const

/* ── Reservation Status (for creation dropdowns) ─────────── */

export const RESERVATION_STATUS_OPTIONS = [
  { value: "confirmed", label: "מאושרת" },
  { value: "draft", label: "טיוטה" },
  { value: "pending", label: "ממתין לאישור" },
] as const

/* ── Payment Status (for dropdowns) ──────────────────────── */

export const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "לא שולם" },
  { value: "partially_paid", label: "שולם חלקית" },
  { value: "fully_paid", label: "שולם מלא" },
  { value: "pending_transfer", label: "ממתין להעברה" },
  { value: "pending_approval", label: "ממתין לאישור" },
  { value: "failed", label: "נכשל" },
  { value: "refunded", label: "הוחזר" },
  { value: "cancelled", label: "בוטל" },
] as const

/* ── Status display labels (for table/list rendering) ────── */

export const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  pending: "ממתין",
  confirmed: "מאושר",
  checked_in: "In House",
  checked_out: "צ׳ק אאוט",
  cancelled: "בוטל",
  no_show: "No Show",
}

export const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "לא שולם",
  partially_paid: "שולם חלקית",
  fully_paid: "שולם מלא",
  pending_transfer: "ממתין להעברה",
  pending_approval: "ממתין לאישור",
  failed: "נכשל",
  refunded: "הוחזר",
  cancelled: "בוטל",
}

export const SOURCE_LABELS: Record<string, string> = {
  direct: "ישיר",
  phone: "טלפון",
  website: "אתר",
  whatsapp: "WhatsApp",
  "booking.com": "Booking.com",
  booking: "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  agent: "סוכן",
  corporate: "חברה",
  walk_in: "Walk-in",
  other: "אחר",
}

/* ── Status border colors (for table rows) ───────────────── */

export const STATUS_BORDER_COLORS: Record<string, string> = {
  confirmed: "#003aa0",
  checked_in: "#22c55e",
  checked_out: "#9ca3af",
  cancelled: "#ef4444",
  no_show: "#f97316",
  pending: "#eab308",
  draft: "#9ca3af",
}

/* ── Extra Charge Types ──────────────────────────────────── */

export const EXTRA_CHARGE_TYPES = [
  { value: "pet", label: "בעל חיים" },
  { value: "late_checkout", label: "יציאה מאוחרת" },
  { value: "early_checkin", label: "כניסה מוקדמת" },
  { value: "extra_cleaning", label: "ניקיון נוסף" },
  { value: "extra_bed", label: "מיטה נוספת" },
  { value: "damage", label: "נזק / חיוב מיוחד" },
  { value: "other", label: "אחר" },
] as const

/* ── External source detection ───────────────────────────── */

const EXTERNAL_SOURCES = new Set([
  "booking", "booking.com", "airbnb", "expedia", "agent", "corporate",
])

export function isExternalSource(
  source: string | null,
  externalId?: string | null,
  channelManagerId?: string | null
): boolean {
  if (channelManagerId) return true
  if (externalId) return true
  if (source && EXTERNAL_SOURCES.has(source)) return true
  return false
}

import type { BoardView } from "./board-types"

export const ROW_HEIGHT = 56
export const HEADER_HEIGHT = 64
export const RAIL_WIDTH = 168
export const BAR_HEIGHT = 40
export const BAR_V_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2
export const EDGE_HANDLE = 10

export const VIEW_DAYS: Record<BoardView, number> = {
  week: 7,
  "two-weeks": 21,
  month: 30,
}

export const VIEW_LABEL: Record<BoardView, string> = {
  week: "שבוע",
  "two-weeks": "3 שבועות",
  month: "30 יום",
}

// NOTE: reservation bar colour is NOT defined here. It comes from Settings →
// Payment Status (lookup_items.color keyed by reservations.payment_status).
// See <CalendarBoard>/useLookup('payment_status') and ReservationBlock's paymentColor prop.

export const ROOM_STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  occupied: { dot: "bg-sky-500", label: "תפוס" },
  in_progress: { dot: "bg-blue-500", label: "בטיפול" },
  vacant_clean: { dot: "bg-emerald-500", label: "פנוי" },
  vacant_dirty: { dot: "bg-amber-500", label: "מלוכלך" },
  maintenance: { dot: "bg-orange-500", label: "תחזוקה" },
  out_of_order: { dot: "bg-rose-500", label: "לא פעיל" },
}

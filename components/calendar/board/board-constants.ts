import type { BoardView } from "./board-types"

/* Board geometry — matched to design-ref/rooms-calendar.html (.tl-row 74,
 * .tl-roomcell 228, .tl-bar 48). Fixed per-view column widths drive horizontal
 * scroll instead of squishing every day into the viewport. */
export const ROW_HEIGHT = 74
export const HEADER_HEIGHT = 64
export const RAIL_WIDTH = 228
export const BAR_HEIGHT = 48
export const BAR_V_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2
export const EDGE_HANDLE = 10

export const VIEW_DAYS: Record<BoardView, number> = {
  week: 7,
  "two-weeks": 21,
  month: 30,
}

/** Fixed, readable day-column width per view (px) — reference source of truth.
 *  The board scrolls horizontally INSIDE its own card (contained scroll) rather
 *  than crushing columns to fit, so days stay readable on every screen. */
export const COL_WIDTH: Record<BoardView, number> = {
  week: 188,
  "two-weeks": 126,
  month: 86,
}

export const VIEW_LABEL: Record<BoardView, string> = {
  week: "שבוע",
  "two-weeks": "3 שבועות",
  month: "30 יום",
}

// NOTE: reservation bar colour is NOT defined here. It comes from Settings →
// Payment Status (lookup_items.color keyed by reservations.payment_status).
// See <CalendarBoard>/useLookup('payment_status') and ReservationBlock's paymentColor prop.

/** Reference `.rc-status` colour class + label per derived room status. */
export const ROOM_STATUS_META: Record<string, { cls: string; label: string }> = {
  occupied: { cls: "busy", label: "תפוס" },
  in_progress: { cls: "maint", label: "בטיפול" },
  vacant_clean: { cls: "ok", label: "פנוי" },
  vacant_dirty: { cls: "dirty", label: "מלוכלך" },
  maintenance: { cls: "maint", label: "תחזוקה" },
  out_of_order: { cls: "off", label: "לא פעיל" },
}

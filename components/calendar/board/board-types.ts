export type BoardView = "week" | "two-weeks" | "month"

export interface BoardRoom {
  id: string
  room_number: string
  name: string | null
  /** Manual admin-set status: available | blocked | maintenance | out_of_order | unavailable */
  status: string
  /** Housekeeping-driven state: clean | dirty | in_progress */
  cleaning_state: string
  sort_order: number | null
  floor_id: string | null
  building_id: string | null
  room_type_id: string
  room_type_name: string
  /** Effective caps — COALESCE(rooms.*, room_types.*). Same source of truth
   *  as Room Management, so calendar quick-open opens with correct occupancy. */
  max_occupancy: number
  default_occupancy: number
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
  base_price: number | string
  extra_person_price: number | string
  floor_name: string | null
  building_name: string | null
}

export type ReservationStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "pending"

export interface BoardReservation {
  id: string
  segment_id: string // reservation_rooms.id — unique per (reservation × room)
  reservation_number: string
  status: ReservationStatus | string
  /** parent reservation start date (earliest segment across the reservation) */
  check_in: string
  /** parent reservation end date (latest segment across the reservation) */
  check_out: string
  /** segment-level dates used by the board to render/move/resize THIS segment */
  segment_check_in: string
  segment_check_out: string
  estimated_arrival_time: string | null
  estimated_departure_time: string | null
  actual_checkin_time: string | null
  actual_checkout_time: string | null
  adults: number
  children: number
  source: string | null
  is_vip: boolean
  payment_status: string
  total_price: number | string | null
  balance_due: number | string | null
  general_notes: string | null
  internal_notes: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  guest_vip: boolean
  room_id: string
  rate_per_night: number | string | null
}

export interface BoardRateOverride {
  room_type_id: string
  date_from: string
  date_to: string
  price: number | string
  min_nights: number | null
  stop_sell: boolean
  reason: string | null
}

export interface BoardDailyPricing {
  room_id: string
  date: string
  price: number | string
  min_nights: number | null
  max_nights: number | null
  min_nights_on_arrival: number | null
  is_closed: boolean
  closed_on_arrival: boolean
  closed_on_departure: boolean
}

export interface BoardBlock {
  room_id: string
  block_date: string
  reason: string | null
}

export interface BoardRatePlan {
  id: string
  min_nights: number | null
  type: string
}

export interface OperationalTimes {
  /** Tenant default check-in (HH:mm). */
  default_checkin_time: string | null
  /** Tenant default check-out (HH:mm). */
  default_checkout_time: string | null
  /** Optional Sabbath/holiday override (HH:mm). */
  sabbath_checkin_time: string | null
  sabbath_checkout_time: string | null
}

export interface BoardData {
  rooms: BoardRoom[]
  reservations: BoardReservation[]
  rateOverrides: BoardRateOverride[]
  ratePlans: BoardRatePlan[]
  blocks: BoardBlock[]
  dailyPricing: BoardDailyPricing[]
  currency: string
  operationalTimes: OperationalTimes
}

/** Interaction state machine — single source of truth for drag/create/resize.
 *  Operates at the SEGMENT level (reservation_rooms row), not the parent reservation,
 *  so multi-room reservations move/resize segment-by-segment. */
export type DragState =
  | { type: "idle" }
  | {
      type: "create"
      roomId: string
      anchorCol: number
      currentCol: number
      invalid?: boolean
      reason?: string
    }
  | {
      type: "move"
      segmentId: string
      srcRoomId: string
      srcStartCol: number
      srcNights: number
      /** Fractional start offset within the check-in day (e.g. 15:00 → 0.625).
       *  Captured when move starts so the overlay preserves the source bar's
       *  exact geometry instead of snapping to whole nights. Prevents the
       *  overlay from appearing wider than the committed reservation span. */
      srcStartFraction: number
      /** Fractional column-width of the source bar
       *  (= srcNights − srcStartFraction + endFraction). */
      srcWidthCols: number
      targetRoomId: string
      targetStartCol: number
      invalid?: boolean
      reason?: string
    }
  | {
      type: "resize"
      segmentId: string
      edge: "start" | "end"
      roomId: string
      originalStartCol: number
      originalNights: number
      newStartCol: number
      newNights: number
      invalid?: boolean
      reason?: string
    }

export interface CellCoord {
  roomId: string
  col: number
}

/** Row-level status computed from reservations + rooms + housekeeping on the client. */
export type DerivedRoomStatus =
  | "occupied"
  | "in_progress"
  | "vacant_clean"
  | "vacant_dirty"
  | "maintenance"
  | "out_of_order"

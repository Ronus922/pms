import type {
  BoardBlock,
  BoardDailyPricing,
  BoardRatePlan,
  BoardRateOverride,
  BoardReservation,
  BoardRoom,
  DerivedRoomStatus,
  OperationalTimes,
} from "./board-types"

const DEFAULT_CHECKIN_HHMM = "15:00"
const DEFAULT_CHECKOUT_HHMM = "11:00"

/** "15:30" → 15.5, "03:00:00" → 3 */
export function hhmmToHours(hhmm: string | null | undefined): number {
  if (!hhmm) return 0
  const s = String(hhmm)
  const [h = "0", m = "0"] = s.split(":")
  const hours = parseFloat(h) + parseFloat(m) / 60
  return Number.isFinite(hours) ? Math.max(0, Math.min(24, hours)) : 0
}

/** From an ISO timestamp, extract hours-into-day (local). */
export function isoTimestampHours(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.getHours() + d.getMinutes() / 60
}

/** A Sabbath window in Israel — Friday (5) and Saturday (6) weekday. */
function isSabbathDay(iso: string): boolean {
  const wd = new Date(iso + "T00:00:00Z").getUTCDay()
  return wd === 5 || wd === 6
}

/** Resolve the check-in time (hours into day, 0–24) for a reservation ON its check-in date.
 *  Priority:
 *    1. reservation.actual_checkin_time (timestamp)
 *    2. reservation.estimated_arrival_time (time)
 *    3. tenants.sabbath_checkin_time if check-in day is Fri/Sat
 *    4. tenants.default_checkin_time
 *    5. built-in 15:00 fallback
 */
export function resolveCheckInTime(
  res: BoardReservation,
  checkInIso: string,
  times: OperationalTimes | null | undefined,
): number {
  const actual = isoTimestampHours(res.actual_checkin_time)
  if (actual != null) return actual
  if (res.estimated_arrival_time) return hhmmToHours(res.estimated_arrival_time)

  if (isSabbathDay(checkInIso) && times?.sabbath_checkin_time) {
    return hhmmToHours(times.sabbath_checkin_time)
  }
  if (times?.default_checkin_time) return hhmmToHours(times.default_checkin_time)
  return hhmmToHours(DEFAULT_CHECKIN_HHMM)
}

/** Resolve the check-out time (hours into day, 0–24) for a reservation ON its check-out date. */
export function resolveCheckOutTime(
  res: BoardReservation,
  checkOutIso: string,
  times: OperationalTimes | null | undefined,
): number {
  const actual = isoTimestampHours(res.actual_checkout_time)
  if (actual != null) return actual
  if (res.estimated_departure_time) return hhmmToHours(res.estimated_departure_time)

  if (isSabbathDay(checkOutIso) && times?.sabbath_checkout_time) {
    return hhmmToHours(times.sabbath_checkout_time)
  }
  if (times?.default_checkout_time) return hhmmToHours(times.default_checkout_time)
  return hhmmToHours(DEFAULT_CHECKOUT_HHMM)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00Z").getTime()
  const d2 = new Date(b + "T00:00:00Z").getTime()
  return Math.round((d2 - d1) / 86400000)
}

export function todayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function dateAtCol(startIso: string, col: number): string {
  return addDays(startIso, col)
}

export function isoWeekday(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay() // 0=Sun
}

/** Effective cell pricing + LOS rules. Priority: daily pricing → rate override → rate plan default → base. */
export function getCellPricing(
  roomId: string,
  roomTypeId: string,
  baseRoomPrice: number,
  dateIso: string,
  dailyPricing: BoardDailyPricing[],
  rateOverrides: BoardRateOverride[],
  ratePlans: BoardRatePlan[],
): {
  price: number
  minNights: number
  /** Max nights allowed starting from this date. null = no cap. */
  maxNights: number | null
  closed: boolean
  closedOnArrival: boolean
  closedOnDeparture: boolean
  source: "daily" | "override" | "base"
} {
  const daily = dailyPricing.find((d) => d.room_id === roomId && d.date === dateIso)
  if (daily) {
    const max = daily.max_nights != null ? Number(daily.max_nights) : null
    return {
      price: Number(daily.price) || 0,
      minNights: Math.max(1, Number(daily.min_nights ?? daily.min_nights_on_arrival ?? 1) || 1),
      maxNights: max && max > 0 ? max : null,
      closed: !!daily.is_closed,
      closedOnArrival: !!daily.closed_on_arrival,
      closedOnDeparture: !!daily.closed_on_departure,
      source: "daily",
    }
  }

  const override = rateOverrides.find(
    (r) =>
      r.room_type_id === roomTypeId &&
      dateIso >= r.date_from.slice(0, 10) &&
      dateIso <= r.date_to.slice(0, 10),
  )
  if (override) {
    return {
      price: Number(override.price) || 0,
      minNights: Math.max(1, Number(override.min_nights ?? 1) || 1),
      maxNights: null,
      closed: !!override.stop_sell,
      closedOnArrival: false,
      closedOnDeparture: false,
      source: "override",
    }
  }

  const defaultMin = ratePlans.find((r) => r.type === "default")?.min_nights ?? 1
  return {
    price: Number(baseRoomPrice) || 0,
    minNights: Math.max(1, Number(defaultMin) || 1),
    maxNights: null,
    closed: false,
    closedOnArrival: false,
    closedOnDeparture: false,
    source: "base",
  }
}

/** Derive live room status from live data. Priority (highest wins):
 *  1. Manual admin status: out_of_order / unavailable / maintenance
 *  2. Block on today's date
 *  3. Active reservation today → `occupied`
 *  4. Housekeeping `cleaning_state`: in_progress → `in_progress`, dirty → `vacant_dirty`
 *  5. Default → `vacant_clean`
 */
export function deriveRoomStatus(
  room: BoardRoom,
  reservations: BoardReservation[],
  blocks: BoardBlock[],
  todayIsoDate: string,
): DerivedRoomStatus {
  if (room.status === "out_of_order" || room.status === "unavailable") return "out_of_order"
  if (room.status === "maintenance") return "maintenance"

  const blockedToday = blocks.some(
    (b) => b.room_id === room.id && b.block_date.slice(0, 10) === todayIsoDate,
  )
  if (blockedToday) return "out_of_order"

  const activeNow = reservations.find(
    (r) =>
      r.room_id === room.id &&
      (r.status === "confirmed" || r.status === "checked_in") &&
      r.segment_check_in <= todayIsoDate &&
      r.segment_check_out > todayIsoDate,
  )
  if (activeNow) return "occupied"

  if (room.cleaning_state === "in_progress") return "in_progress"
  if (room.cleaning_state === "dirty") return "vacant_dirty"
  return "vacant_clean"
}

export interface AvailabilityCheck {
  available: boolean
  reason?: string
}

/** Client-side availability check. Server revalidates via check_room_availability. */
export function checkAvailability(
  roomId: string,
  checkInIso: string,
  checkOutIso: string,
  excludeReservationId: string | null,
  room: BoardRoom,
  reservations: BoardReservation[],
  blocks: BoardBlock[],
  dailyPricing: BoardDailyPricing[],
): AvailabilityCheck {
  if (diffDays(checkInIso, checkOutIso) < 1) return { available: false, reason: "טווח לא תקף" }

  if (room.status === "out_of_order" || room.status === "unavailable")
    return { available: false, reason: "חדר לא זמין" }
  if (room.status === "maintenance") return { available: false, reason: "חדר בתחזוקה" }

  // Overlap check (check-out exclusive) — uses SEGMENT dates so we don't block
  // adjacent segments of the same reservation in other rooms.
  const overlap = reservations.find(
    (r) =>
      r.room_id === roomId &&
      r.id !== excludeReservationId &&
      (r.status === "confirmed" || r.status === "checked_in") &&
      r.segment_check_in < checkOutIso &&
      r.segment_check_out > checkInIso,
  )
  if (overlap) return { available: false, reason: "חפיפה עם הזמנה קיימת" }

  // Blocks on any night in [checkIn, checkOut)
  for (let d = checkInIso; d < checkOutIso; d = addDays(d, 1)) {
    const blocked = blocks.some((b) => b.room_id === roomId && b.block_date.slice(0, 10) === d)
    if (blocked) return { available: false, reason: "תאריך חסום" }
    const pricing = dailyPricing.find((p) => p.room_id === roomId && p.date === d)
    if (pricing?.is_closed) return { available: false, reason: "תאריך סגור למכירה" }
  }

  // Closed-on-arrival / departure
  const arrivalPricing = dailyPricing.find((p) => p.room_id === roomId && p.date === checkInIso)
  if (arrivalPricing?.closed_on_arrival)
    return { available: false, reason: "סגור להגעה בתאריך זה" }

  const lastNight = addDays(checkOutIso, -1)
  const lastPricing = dailyPricing.find((p) => p.room_id === roomId && p.date === lastNight)
  if (lastPricing?.closed_on_departure)
    return { available: false, reason: "סגור לעזיבה בתאריך זה" }

  return { available: true }
}

export interface LosCheck {
  valid: boolean
  minNights: number
  /** null = no cap */
  maxNights: number | null
  actualNights: number
  /** "min" when shorter than min_nights, "max" when longer than max_nights. */
  violation?: "min" | "max"
  reason?: string
}

/** Combined LOS validation — enforces BOTH min_nights and max_nights sourced
 *  from the existing pricing / restrictions system. This is the single entry
 *  point for length-of-stay checks from the board. See memory
 *  `project_calendar_los_rules.md`. */
export function checkLosRules(
  roomId: string,
  roomTypeId: string,
  baseRoomPrice: number,
  checkInIso: string,
  checkOutIso: string,
  dailyPricing: BoardDailyPricing[],
  rateOverrides: BoardRateOverride[],
  ratePlans: BoardRatePlan[],
): LosCheck {
  const pricing = getCellPricing(
    roomId,
    roomTypeId,
    baseRoomPrice,
    checkInIso,
    dailyPricing,
    rateOverrides,
    ratePlans,
  )
  const nights = diffDays(checkInIso, checkOutIso)

  if (nights < pricing.minNights) {
    return {
      valid: false,
      minNights: pricing.minNights,
      maxNights: pricing.maxNights,
      actualNights: nights,
      violation: "min",
      reason: `נדרש מינימום ${pricing.minNights} לילות בתאריך זה`,
    }
  }
  if (pricing.maxNights != null && nights > pricing.maxNights) {
    return {
      valid: false,
      minNights: pricing.minNights,
      maxNights: pricing.maxNights,
      actualNights: nights,
      violation: "max",
      reason: `מותר מקסימום ${pricing.maxNights} לילות בתאריך זה`,
    }
  }
  return {
    valid: true,
    minNights: pricing.minNights,
    maxNights: pricing.maxNights,
    actualNights: nights,
  }
}

/** @deprecated Legacy name — use `checkLosRules`. Kept as a thin alias during
 *  transition so any lingering caller still works. */
export const checkMinNights = checkLosRules

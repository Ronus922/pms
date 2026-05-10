/**
 * Effective Room Daily Pricing — read layer
 * ──────────────────────────────────────────────────────────────
 * Priority:
 *   1. room_daily_pricing (per room_id + date)
 *   2. room_types.base_price (per room's type)
 *   3. sensible defaults
 *
 * Use this helper in every NEW pricing read path. It is safe to
 * call from both server actions and services — but the reservation
 * flow is LOCKED and must not be modified without regression tests.
 *
 * NO WRITES. Read only.
 */

import "server-only"

import { db } from "@/lib/db"

export interface EffectiveRoomDailyPricing {
  roomId: string
  date: string
  price: number | null
  currency: string
  minNights: number | null
  maxNights: number | null
  minNightsOnArrival: number | null
  isClosed: boolean
  closedOnArrival: boolean
  closedOnDeparture: boolean
  /** true when the values came from a room_daily_pricing row (as opposed to the base_price fallback). */
  isOverride: boolean
}

const DEFAULT_CURRENCY = "ILS"

function defaultsFromBase(
  roomId: string,
  date: string,
  basePrice: number | null,
  currency: string = DEFAULT_CURRENCY,
): EffectiveRoomDailyPricing {
  return {
    roomId,
    date,
    price: basePrice,
    currency,
    minNights: null,
    maxNights: null,
    minNightsOnArrival: null,
    isClosed: false,
    closedOnArrival: false,
    closedOnDeparture: false,
    isOverride: false,
  }
}

/**
 * Single-cell read. Prefer the batch variant when you need more than
 * one (room, date) pair — this performs one round trip per call.
 */
export async function getEffectiveRoomDailyPricing(
  tenantId: string,
  roomId: string,
  date: string,
): Promise<EffectiveRoomDailyPricing> {
  const [override] = await db`
    SELECT
      price, currency,
      min_nights, max_nights, min_nights_on_arrival,
      is_closed, closed_on_arrival, closed_on_departure
    FROM room_daily_pricing
    WHERE tenant_id = ${tenantId}
      AND room_id = ${roomId}
      AND date = ${date}::date
    LIMIT 1
  `

  if (override) {
    return {
      roomId,
      date,
      price: override.price !== null ? Number(override.price) : null,
      currency: (override.currency as string) ?? DEFAULT_CURRENCY,
      minNights:
        override.min_nights !== null ? Number(override.min_nights) : null,
      maxNights:
        override.max_nights !== null ? Number(override.max_nights) : null,
      minNightsOnArrival:
        override.min_nights_on_arrival !== null
          ? Number(override.min_nights_on_arrival)
          : null,
      isClosed: Boolean(override.is_closed),
      closedOnArrival: Boolean(override.closed_on_arrival),
      closedOnDeparture: Boolean(override.closed_on_departure),
      isOverride: true,
    }
  }

  // Fallback — read room_type.base_price
  const [base] = await db`
    SELECT rt.base_price
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.id = ${roomId} AND r.tenant_id = ${tenantId}
    LIMIT 1
  `
  const basePrice = base?.base_price !== null && base?.base_price !== undefined
    ? Number(base.base_price)
    : null

  return defaultsFromBase(roomId, date, basePrice)
}

/**
 * Batch read for a rectangle of (rooms × date range). Returns a flat
 * array — callers can index into a Map<`${roomId}::${date}`, row>.
 *
 * Cells without an override are NOT returned. The caller is expected
 * to fall back to the room's base price for any missing (room, date)
 * pair. This keeps the payload small for a typical 28-day × 100-room
 * calendar view.
 */
export async function getEffectiveRoomDailyPricingBatch(
  tenantId: string,
  roomIds: string[],
  fromDate: string,
  toDate: string,
): Promise<EffectiveRoomDailyPricing[]> {
  if (!roomIds.length) return []

  const rows = await db`
    SELECT
      room_id,
      to_char(date, 'YYYY-MM-DD') AS date,
      price, currency,
      min_nights, max_nights, min_nights_on_arrival,
      is_closed, closed_on_arrival, closed_on_departure
    FROM room_daily_pricing
    WHERE tenant_id = ${tenantId}
      AND room_id = ANY(${roomIds}::uuid[])
      AND date BETWEEN ${fromDate}::date AND ${toDate}::date
  `

  return (rows as unknown as Array<{
    room_id: string
    date: string
    price: number | null
    currency: string
    min_nights: number | null
    max_nights: number | null
    min_nights_on_arrival: number | null
    is_closed: boolean
    closed_on_arrival: boolean
    closed_on_departure: boolean
  }>).map((r) => ({
    roomId: r.room_id,
    date: r.date,
    price: r.price !== null ? Number(r.price) : null,
    currency: r.currency ?? DEFAULT_CURRENCY,
    minNights: r.min_nights !== null ? Number(r.min_nights) : null,
    maxNights: r.max_nights !== null ? Number(r.max_nights) : null,
    minNightsOnArrival:
      r.min_nights_on_arrival !== null ? Number(r.min_nights_on_arrival) : null,
    isClosed: Boolean(r.is_closed),
    closedOnArrival: Boolean(r.closed_on_arrival),
    closedOnDeparture: Boolean(r.closed_on_departure),
    isOverride: true,
  }))
}

/**
 * Convenience: resolve the effective values for every night of a
 * stay range (check_in inclusive, check_out exclusive).
 * Returns one entry per night, back-filling `base_price` for any date
 * without an override.
 */
export async function getEffectiveRoomDailyPricingForStay(
  tenantId: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<EffectiveRoomDailyPricing[]> {
  if (checkIn >= checkOut) return []

  const [base] = await db`
    SELECT rt.base_price
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.id = ${roomId} AND r.tenant_id = ${tenantId}
    LIMIT 1
  `
  const basePrice =
    base?.base_price !== null && base?.base_price !== undefined
      ? Number(base.base_price)
      : null

  const overrides = await getEffectiveRoomDailyPricingBatch(
    tenantId,
    [roomId],
    checkIn,
    shiftDate(checkOut, -1),
  )
  const overrideMap = new Map<string, EffectiveRoomDailyPricing>()
  for (const o of overrides) overrideMap.set(o.date, o)

  const nights: EffectiveRoomDailyPricing[] = []
  let cursor = checkIn
  while (cursor < checkOut) {
    const override = overrideMap.get(cursor)
    if (override) {
      nights.push(override)
    } else {
      nights.push(defaultsFromBase(roomId, cursor, basePrice))
    }
    cursor = shiftDate(cursor, 1)
  }
  return nights
}

/** Internal — shift an ISO date string by N days (positive or negative). */
function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(isoDate + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Index a batch result into a Map for O(1) lookup.
 * Key format: `${roomId}::${date}`.
 */
export function indexDailyPricingBatch(
  rows: EffectiveRoomDailyPricing[],
): Map<string, EffectiveRoomDailyPricing> {
  const m = new Map<string, EffectiveRoomDailyPricing>()
  for (const r of rows) m.set(`${r.roomId}::${r.date}`, r)
  return m
}

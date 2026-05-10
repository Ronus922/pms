/**
 * Bulk Room Update — preview computation (pure)
 * ──────────────────────────────────────────────────────────────
 * Given the fully-expanded scope + fetched context (existing daily
 * pricing rows, reservation overlaps, rooms), compute:
 *  - affected records
 *  - skipped records
 *  - warnings (reservation overlaps, close-blocked-by-reservation)
 *  - a small preview table with sample final values
 *
 * NO DB CALLS. Service layer provides the fetched data.
 */

import type {
  BulkUpdateFields,
  BulkUpdatePreview,
  BulkUpdatePreviewRow,
  BulkUpdateRoomOption,
  BulkUpdateScope,
  BulkUpdateWarning,
  ExistingDailyPricingRow,
  ReservationOverlapRow,
} from "@/lib/types/bulk-room-update"

import {
  collectActiveFields,
  expandDates,
  validateBulkUpdate,
} from "./bulkRoomUpdateValidation"

interface PreviewContext {
  rooms: BulkUpdateRoomOption[]
  existingPricing: ExistingDailyPricingRow[]
  reservationOverlaps: ReservationOverlapRow[]
}

/** Apply a single price mode against a current price and return the next value. */
export function computeFinalPrice(
  current: number | null,
  fields: BulkUpdateFields,
  basePrice: number | null,
): number | null {
  if (!fields.price.enabled || fields.price.value === "") return current
  const inputValue = Number(fields.price.value)
  const existing = current ?? basePrice ?? 0
  switch (fields.price.mode) {
    case "replace":
      return Math.max(0, inputValue)
    case "add":
      return Math.max(0, existing + inputValue)
    case "subtract":
      return Math.max(0, existing - inputValue)
    case "percent_add":
      return Math.max(0, Math.round(existing * (1 + inputValue / 100) * 100) / 100)
    case "percent_subtract":
      return Math.max(0, Math.round(existing * (1 - inputValue / 100) * 100) / 100)
    default:
      return current
  }
}

/**
 * Resolve the final value for every active field for a single (room, date) cell.
 */
export function resolveFinalValues(
  room: BulkUpdateRoomOption,
  existing: ExistingDailyPricingRow | undefined,
  fields: BulkUpdateFields,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}

  if (fields.price.enabled) {
    out.price = computeFinalPrice(existing?.price ?? null, fields, room.base_price)
  }
  if (fields.currency.enabled) {
    out.currency = fields.currency.value
  }
  if (fields.availability.enabled) {
    out.is_closed = fields.availability.closed
  }
  if (fields.min_nights.enabled && fields.min_nights.value !== "") {
    out.min_nights = Number(fields.min_nights.value)
  }
  if (fields.max_nights.enabled && fields.max_nights.value !== "") {
    out.max_nights = Number(fields.max_nights.value)
  }
  if (
    fields.min_nights_on_arrival.enabled &&
    fields.min_nights_on_arrival.value !== ""
  ) {
    out.min_nights_on_arrival = Number(fields.min_nights_on_arrival.value)
  }
  if (fields.closed_on_arrival.enabled) {
    out.closed_on_arrival = fields.closed_on_arrival.closed
  }
  if (fields.closed_on_departure.enabled) {
    out.closed_on_departure = fields.closed_on_departure.closed
  }

  return out
}

/**
 * Check whether a reservation overlap blocks this cell from being "closed".
 * Reservation covers a cell if check_in <= date < check_out.
 */
function reservationCoversDate(
  overlap: ReservationOverlapRow,
  date: string,
): boolean {
  return overlap.check_in <= date && overlap.check_out > date
}

export function buildPreview(
  fields: BulkUpdateFields,
  scope: BulkUpdateScope,
  ctx: PreviewContext,
): BulkUpdatePreview {
  const preValidation = validateBulkUpdate(fields, scope)
  const fieldsToUpdate = collectActiveFields(fields)
  const dates = expandDates(scope)
  const selectedRooms = ctx.rooms.filter((r) => scope.roomIds.includes(r.id))

  // Build lookup maps for O(1) access
  const pricingMap = new Map<string, ExistingDailyPricingRow>()
  for (const row of ctx.existingPricing) {
    pricingMap.set(`${row.room_id}::${row.date}`, row)
  }
  const overlapByRoom = new Map<string, ReservationOverlapRow[]>()
  for (const o of ctx.reservationOverlaps) {
    const list = overlapByRoom.get(o.room_id) ?? []
    list.push(o)
    overlapByRoom.set(o.room_id, list)
  }

  const warnings: BulkUpdateWarning[] = [...preValidation]
  const rows: BulkUpdatePreviewRow[] = []
  let affected = 0
  let skipped = 0

  const wantsClose =
    (fields.availability.enabled && fields.availability.closed) ||
    (fields.closed_on_arrival.enabled && fields.closed_on_arrival.closed) ||
    (fields.closed_on_departure.enabled && fields.closed_on_departure.closed)

  for (const room of selectedRooms) {
    const overlaps = overlapByRoom.get(room.id) ?? []
    let firstSampleAdded = false
    for (const date of dates) {
      const existing = pricingMap.get(`${room.id}::${date}`)
      const blockedByReservation =
        wantsClose &&
        overlaps.some((o) => reservationCoversDate(o, date))

      if (blockedByReservation) {
        skipped++
        warnings.push({
          code: "close_blocked_by_reservation",
          level: "warning",
          roomId: room.id,
          date,
          message: `חדר ${room.room_number} — לא ניתן לסגור ב-${date} עקב הזמנה קיימת`,
        })
        continue
      }

      // Soft info warning when an existing reservation overlaps (price still applies)
      const hasOverlap = overlaps.some((o) => reservationCoversDate(o, date))
      if (hasOverlap && !blockedByReservation) {
        warnings.push({
          code: "reservation_overlap",
          level: "info",
          roomId: room.id,
          date,
          message: `חדר ${room.room_number} — קיימת הזמנה ב-${date} (עדכון מחיר/לילות יבוצע)`,
        })
      }

      affected++

      // Only accumulate one sample row per room to keep preview table small
      if (!firstSampleAdded) {
        rows.push({
          roomId: room.id,
          roomNumber: room.room_number,
          roomName: room.room_name,
          dateFrom: dates[0] ?? scope.dateFrom,
          dateTo: dates[dates.length - 1] ?? scope.dateTo,
          changedFields: fieldsToUpdate,
          sampleFinal: resolveFinalValues(room, existing, fields),
        })
        firstSampleAdded = true
      }
    }
  }

  return {
    roomsCount: selectedRooms.length,
    datesCount: dates.length,
    weekdays: scope.weekdays,
    fieldsToUpdate,
    affectedRecords: affected,
    skippedRecords: skipped,
    warnings,
    rows,
  }
}

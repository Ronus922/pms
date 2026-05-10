/**
 * Bulk Room Update — apply plan builder (pure)
 * ──────────────────────────────────────────────────────────────
 * Converts the validated form state into a list of (room_id, date, patch)
 * operations that the service layer will UPSERT into room_daily_pricing.
 *
 * NO DB CALLS. Service layer consumes these operations.
 */

import type {
  BulkUpdateFields,
  BulkUpdateRoomOption,
  BulkUpdateScope,
  ExistingDailyPricingRow,
  ReservationOverlapRow,
} from "@/lib/types/bulk-room-update"

import { expandDates } from "./bulkRoomUpdateValidation"
import { computeFinalPrice } from "./bulkRoomUpdatePreview"

export interface ApplyOperation {
  roomId: string
  date: string
  patch: {
    price?: number | null
    currency?: string
    min_nights?: number | null
    max_nights?: number | null
    min_nights_on_arrival?: number | null
    is_closed?: boolean
    closed_on_arrival?: boolean
    closed_on_departure?: boolean
  }
  previous: {
    price: number | null
    currency: string
    min_nights: number | null
    max_nights: number | null
    min_nights_on_arrival: number | null
    is_closed: boolean
    closed_on_arrival: boolean
    closed_on_departure: boolean
  }
  skipped: boolean
  skipReason?: string
}

export interface ApplyPlan {
  operations: ApplyOperation[]
  affectedCount: number
  skippedCount: number
}

interface ApplyContext {
  rooms: BulkUpdateRoomOption[]
  existingPricing: ExistingDailyPricingRow[]
  reservationOverlaps: ReservationOverlapRow[]
}

const DEFAULT_CURRENCY = "ILS"

function defaultPrevious(
  existing: ExistingDailyPricingRow | undefined,
  basePrice: number | null,
): ApplyOperation["previous"] {
  return {
    price: existing?.price ?? basePrice ?? null,
    currency: existing?.currency ?? DEFAULT_CURRENCY,
    min_nights: existing?.min_nights ?? null,
    max_nights: existing?.max_nights ?? null,
    min_nights_on_arrival: existing?.min_nights_on_arrival ?? null,
    is_closed: existing?.is_closed ?? false,
    closed_on_arrival: existing?.closed_on_arrival ?? false,
    closed_on_departure: existing?.closed_on_departure ?? false,
  }
}

export function buildApplyPlan(
  fields: BulkUpdateFields,
  scope: BulkUpdateScope,
  ctx: ApplyContext,
): ApplyPlan {
  const dates = expandDates(scope)
  const selectedRooms = ctx.rooms.filter((r) => scope.roomIds.includes(r.id))

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

  const operations: ApplyOperation[] = []
  let affected = 0
  let skipped = 0

  for (const room of selectedRooms) {
    const overlaps = overlapByRoom.get(room.id) ?? []
    for (const date of dates) {
      const existing = pricingMap.get(`${room.id}::${date}`)
      const previous = defaultPrevious(existing, room.base_price)
      const patch: ApplyOperation["patch"] = {}

      // Build patch from only the enabled (toggled) fields
      if (fields.price.enabled && fields.price.value !== "") {
        patch.price = computeFinalPrice(
          existing?.price ?? null,
          fields,
          room.base_price,
        )
      }
      if (fields.currency.enabled) {
        patch.currency = fields.currency.value
      }
      if (fields.min_nights.enabled && fields.min_nights.value !== "") {
        patch.min_nights = Number(fields.min_nights.value)
      }
      if (fields.max_nights.enabled && fields.max_nights.value !== "") {
        patch.max_nights = Number(fields.max_nights.value)
      }
      if (
        fields.min_nights_on_arrival.enabled &&
        fields.min_nights_on_arrival.value !== ""
      ) {
        patch.min_nights_on_arrival = Number(fields.min_nights_on_arrival.value)
      }

      // Detect reservation-blocked close attempts
      const blockingOverlap = overlaps.find(
        (o) => o.check_in <= date && o.check_out > date,
      )
      const wantsClose =
        (fields.availability.enabled && fields.availability.closed) ||
        (fields.closed_on_arrival.enabled && fields.closed_on_arrival.closed) ||
        (fields.closed_on_departure.enabled && fields.closed_on_departure.closed)

      if (blockingOverlap && wantsClose) {
        operations.push({
          roomId: room.id,
          date,
          patch: {},
          previous,
          skipped: true,
          skipReason: "reservation_overlap",
        })
        skipped++
        continue
      }

      if (fields.availability.enabled) {
        patch.is_closed = fields.availability.closed
      }
      if (fields.closed_on_arrival.enabled) {
        patch.closed_on_arrival = fields.closed_on_arrival.closed
      }
      if (fields.closed_on_departure.enabled) {
        patch.closed_on_departure = fields.closed_on_departure.closed
      }

      // If no active field actually produced a patch entry, skip silently
      if (Object.keys(patch).length === 0) {
        continue
      }

      operations.push({
        roomId: room.id,
        date,
        patch,
        previous,
        skipped: false,
      })
      affected++
    }
  }

  return { operations, affectedCount: affected, skippedCount: skipped }
}

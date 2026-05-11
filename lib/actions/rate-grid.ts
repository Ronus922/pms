"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import {
  getEffectiveRoomDailyPricingBatch,
  indexDailyPricingBatch,
} from "@/lib/utils/effective-pricing"

export interface RateGridRoom {
  id: string
  room_number: string
  room_name: string | null
  room_type_name: string | null
  base_price: number | null
  base_currency: string
}

export interface RateGridCell {
  date: string
  price: number | null
  currency: string
  min_nights: number | null
  max_nights: number | null
  min_nights_on_arrival: number | null
  is_closed: boolean
  closed_on_arrival: boolean
  closed_on_departure: boolean
  is_override: boolean
}

export interface RateGridRoomData {
  room: RateGridRoom
  cells: RateGridCell[]
}

export interface RateGridData {
  dates: string[]
  rooms: RateGridRoomData[]
  pendingSyncCount: number
}

/** Field keys accepted by updateRateGridCell (must match room_daily_pricing columns). */
export type RateGridField =
  | "price"
  | "currency"
  | "min_nights"
  | "max_nights"
  | "min_nights_on_arrival"
  | "is_closed"
  | "closed_on_arrival"
  | "closed_on_departure"

type RateGridValue = string | number | boolean | null

/* ── Helpers ─────────────────────────────────────────────────── */

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function buildDateRange(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    cursor = shiftDate(cursor, 1)
  }
  return out
}

/* ── Read: full grid ─────────────────────────────────────────── */

export async function getRateGridData(
  dateFrom: string,
  dateTo: string,
  roomIds?: string[],
): Promise<
  | { success: true; data: RateGridData }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "view")
    const tenantId = actor.tenantId

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return { success: false, error: "טווח תאריכים לא תקין" }
    }
    if (dateFrom > dateTo) {
      return { success: false, error: "תאריך התחלה חייב להיות לפני תאריך סיום" }
    }

    // 1. Rooms (filtered by optional ids)
    const rooms = roomIds && roomIds.length > 0
      ? (await db`
          SELECT
            r.id,
            r.room_number,
            r.name AS room_name,
            rt.name AS room_type_name,
            rt.base_price,
            'ILS'::text AS base_currency
          FROM rooms r
          LEFT JOIN room_types rt ON rt.id = r.room_type_id
          WHERE r.tenant_id = ${tenantId}::uuid
            AND r.is_active = true
            AND r.id = ANY(${roomIds}::uuid[])
          ORDER BY r.sort_order, r.room_number
        `) as unknown as Array<{
          id: string
          room_number: string
          room_name: string | null
          room_type_name: string | null
          base_price: string | number | null
          base_currency: string
        }>
      : (await db`
          SELECT
            r.id,
            r.room_number,
            r.name AS room_name,
            rt.name AS room_type_name,
            rt.base_price,
            'ILS'::text AS base_currency
          FROM rooms r
          LEFT JOIN room_types rt ON rt.id = r.room_type_id
          WHERE r.tenant_id = ${tenantId}::uuid
            AND r.is_active = true
          ORDER BY r.sort_order, r.room_number
        `) as unknown as Array<{
          id: string
          room_number: string
          room_name: string | null
          room_type_name: string | null
          base_price: string | number | null
          base_currency: string
        }>

    if (rooms.length === 0) {
      return {
        success: true,
        data: {
          dates: buildDateRange(dateFrom, dateTo),
          rooms: [],
          pendingSyncCount: 0,
        },
      }
    }

    // 2. Daily pricing overrides (batch)
    const roomIdList = rooms.map((r) => r.id)
    const overrides = await getEffectiveRoomDailyPricingBatch(
      tenantId,
      roomIdList,
      dateFrom,
      dateTo,
    )
    const overrideIndex = indexDailyPricingBatch(overrides)

    // 3. Pending sync count — reads from channel_sync_jobs, the real Channex
    //    outbound queue populated by the DB trigger on room_daily_pricing.
    //    `retry` is counted too since those jobs are still in-flight from the
    //    worker's perspective.
    const [syncRow] = await db`
      SELECT COUNT(*) AS cnt
      FROM channel_sync_jobs
      WHERE tenant_id = ${tenantId}::uuid
        AND status IN ('pending','retry','running')
    `
    const pendingSyncCount = Number((syncRow as { cnt: string }).cnt)

    // 4. Build grid
    const dates = buildDateRange(dateFrom, dateTo)
    const gridRooms: RateGridRoomData[] = rooms.map((r) => {
      const basePrice =
        r.base_price !== null && r.base_price !== undefined
          ? Number(r.base_price)
          : null
      const cells: RateGridCell[] = dates.map((d) => {
        const o = overrideIndex.get(`${r.id}::${d}`)
        if (o) {
          return {
            date: d,
            price: o.price,
            currency: o.currency,
            min_nights: o.minNights,
            max_nights: o.maxNights,
            min_nights_on_arrival: o.minNightsOnArrival,
            is_closed: o.isClosed,
            closed_on_arrival: o.closedOnArrival,
            closed_on_departure: o.closedOnDeparture,
            is_override: true,
          }
        }
        return {
          date: d,
          price: basePrice,
          currency: r.base_currency ?? "ILS",
          min_nights: null,
          max_nights: null,
          min_nights_on_arrival: null,
          is_closed: false,
          closed_on_arrival: false,
          closed_on_departure: false,
          is_override: false,
        }
      })
      return {
        room: {
          id: r.id,
          room_number: r.room_number,
          room_name: r.room_name,
          room_type_name: r.room_type_name,
          base_price: basePrice,
          base_currency: r.base_currency ?? "ILS",
        },
        cells,
      }
    })

    return {
      success: true,
      data: { dates, rooms: gridRooms, pendingSyncCount },
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת הרשת",
    }
  }
}

/* ── Write: single-cell inline edit ──────────────────────────── */

/**
 * Upsert a single field on a single (room, date) cell.
 * The DB trigger `enqueue_channex_job_on_pricing` automatically enqueues a
 * `channel_sync_jobs` row — no application code is needed to queue the push.
 * The sync itself is triggered manually by the user via the Sync button in
 * the rate grid toolbar (manual mode for inline edits).
 */
export async function updateRateGridCell(
  roomId: string,
  date: string,
  field: RateGridField,
  value: RateGridValue,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, error: "תאריך לא תקין" }
    }

    // Normalise value per field type
    let normalized: string | number | boolean | null = value
    const numericFields = new Set<RateGridField>([
      "price",
      "min_nights",
      "max_nights",
      "min_nights_on_arrival",
    ])
    const booleanFields = new Set<RateGridField>([
      "is_closed",
      "closed_on_arrival",
      "closed_on_departure",
    ])

    if (numericFields.has(field)) {
      if (value === null || value === "" || value === undefined) {
        normalized = null
      } else {
        const n = Number(value)
        if (Number.isNaN(n) || n < 0) {
          return { success: false, error: "ערך מספרי לא תקין" }
        }
        normalized = n
      }
    } else if (booleanFields.has(field)) {
      normalized = Boolean(value)
    } else if (field === "currency") {
      if (typeof value !== "string" || !value.trim()) {
        return { success: false, error: "מטבע לא תקין" }
      }
      normalized = value.trim().toUpperCase()
    }

    // UPSERT — branch by field to keep Postgres.js template literal happy.
    // The trigger on room_daily_pricing queues sync events automatically.
    if (field === "price") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, price, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as number | null}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET price = EXCLUDED.price,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "currency") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, currency, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as string}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET currency = EXCLUDED.currency,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "min_nights") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, min_nights, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as number | null}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET min_nights = EXCLUDED.min_nights,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "max_nights") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, max_nights, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as number | null}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET max_nights = EXCLUDED.max_nights,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "min_nights_on_arrival") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, min_nights_on_arrival, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as number | null}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET min_nights_on_arrival = EXCLUDED.min_nights_on_arrival,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "is_closed") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, is_closed, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as boolean}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET is_closed = EXCLUDED.is_closed,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "closed_on_arrival") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, closed_on_arrival, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as boolean}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET closed_on_arrival = EXCLUDED.closed_on_arrival,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    } else if (field === "closed_on_departure") {
      await db`
        INSERT INTO room_daily_pricing
          (tenant_id, room_id, date, closed_on_departure, source_type, updated_by)
        VALUES
          (${tenantId}::uuid, ${roomId}::uuid, ${date}::date,
           ${normalized as boolean}, 'manual', ${userId}::uuid)
        ON CONFLICT (room_id, date) DO UPDATE
          SET closed_on_departure = EXCLUDED.closed_on_departure,
              source_type = 'manual',
              updated_by = EXCLUDED.updated_by,
              updated_at = now()
      `
    }

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון",
    }
  }
}

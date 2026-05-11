/**
 * Bulk Room Update — service layer
 * ──────────────────────────────────────────────────────────────
 * Owns all DB interactions for bulk updates:
 *  - fetch form data (rooms, filters)
 *  - fetch context for preview/apply (existing pricing + reservation overlaps)
 *  - run the UPSERT transaction against room_daily_pricing
 *  - write the audit log (bulk_room_update_logs + items)
 *
 * Called from server actions only.
 */

import "server-only"

import { db } from "@/lib/db"
import type {
  BulkUpdateActionInput,
  BulkUpdateFormData,
  BulkUpdatePreview,
  BulkUpdateRoomOption,
  BulkUpdateWarning,
  ExistingDailyPricingRow,
  ReservationOverlapRow,
} from "@/lib/types/bulk-room-update"
import { buildPreview } from "@/lib/utils/bulkRoomUpdatePreview"
import { buildApplyPlan, type ApplyPlan } from "@/lib/utils/bulkRoomUpdateApply"
import {
  hasBlockingErrors,
  validateBulkUpdate,
} from "@/lib/utils/bulkRoomUpdateValidation"

// ── Form data (left side of dialog) ───────────────────────────

export async function fetchBulkUpdateFormData(
  tenantId: string,
  atDate?: string,
): Promise<BulkUpdateFormData> {
  // Resolve an ISO date to look up daily pricing overrides. If the caller
  // doesn't pass one, fall back to today so the list always reflects the
  // *current* effective price — not the stale `room_types.base_price`.
  const effectiveDate =
    atDate && /^\d{4}-\d{2}-\d{2}$/.test(atDate)
      ? atDate
      : new Date().toISOString().slice(0, 10)

  const [roomRows, roomTypeRows, buildingRows, floorRows] = await Promise.all([
    db`
      SELECT
        r.id,
        r.room_number,
        r.room_type_id,
        rt.name AS room_type_name,
        COALESCE(rdp.price, rt.base_price) AS base_price,
        r.building_id,
        b.name AS building_name,
        r.floor_id,
        f.name AS floor_name,
        r.is_active,
        COALESCE(rtrans.room_name, rt.name) AS room_name
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN buildings b ON b.id = r.building_id
      LEFT JOIN floors f ON f.id = r.floor_id
      LEFT JOIN room_daily_pricing rdp
        ON rdp.room_id = r.id
        AND rdp.tenant_id = r.tenant_id
        AND rdp.date = ${effectiveDate}::date
      LEFT JOIN LATERAL (
        SELECT room_name FROM room_translations
        WHERE room_id = r.id
        ORDER BY
          CASE WHEN language_code = 'he' THEN 0 ELSE 1 END
        LIMIT 1
      ) rtrans ON TRUE
      WHERE r.tenant_id = ${tenantId}
      ORDER BY COALESCE(r.sort_order, 9999), r.room_number
    `,
    db`
      SELECT id, name FROM room_types
      WHERE tenant_id = ${tenantId} AND is_active = true
      ORDER BY sort_order, name
    `,
    db`
      SELECT id, name FROM buildings
      WHERE tenant_id = ${tenantId}
      ORDER BY sort_order, name
    `,
    db`
      SELECT id, name, building_id FROM floors
      WHERE tenant_id = ${tenantId}
      ORDER BY sort_order, name
    `,
  ])

  const rooms: BulkUpdateRoomOption[] = (roomRows as unknown as Array<{
    id: string
    room_number: string
    room_name: string | null
    room_type_id: string | null
    room_type_name: string | null
    building_id: string | null
    building_name: string | null
    floor_id: string | null
    floor_name: string | null
    base_price: number | null
    is_active: boolean
  }>).map((r) => ({
    id: r.id,
    room_number: r.room_number,
    room_name: r.room_name,
    room_type_id: r.room_type_id,
    room_type_name: r.room_type_name,
    building_id: r.building_id,
    building_name: r.building_name,
    floor_id: r.floor_id,
    floor_name: r.floor_name,
    base_price: r.base_price !== null ? Number(r.base_price) : null,
    is_active: r.is_active,
  }))

  return {
    rooms,
    roomTypes: roomTypeRows as unknown as { id: string; name: string }[],
    buildings: buildingRows as unknown as { id: string; name: string }[],
    floors: floorRows as unknown as {
      id: string
      name: string
      building_id: string | null
    }[],
  }
}

// ── Fetch context for preview/apply ───────────────────────────

interface FetchedContext {
  rooms: BulkUpdateRoomOption[]
  existingPricing: ExistingDailyPricingRow[]
  reservationOverlaps: ReservationOverlapRow[]
}

async function fetchContext(
  tenantId: string,
  input: BulkUpdateActionInput,
): Promise<FetchedContext> {
  const { scope } = input
  const roomIds = scope.roomIds
  if (!roomIds.length) {
    return { rooms: [], existingPricing: [], reservationOverlaps: [] }
  }

  const [roomRows, pricingRows, overlapRows] = await Promise.all([
    db`
      SELECT
        r.id,
        r.room_number,
        r.room_type_id,
        rt.name AS room_type_name,
        rt.base_price,
        r.building_id,
        b.name AS building_name,
        r.floor_id,
        f.name AS floor_name,
        r.is_active,
        COALESCE(rtrans.room_name, rt.name) AS room_name
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN buildings b ON b.id = r.building_id
      LEFT JOIN floors f ON f.id = r.floor_id
      LEFT JOIN LATERAL (
        SELECT room_name FROM room_translations
        WHERE room_id = r.id
        ORDER BY
          CASE WHEN language_code = 'he' THEN 0 ELSE 1 END
        LIMIT 1
      ) rtrans ON TRUE
      WHERE r.tenant_id = ${tenantId}
        AND r.id = ANY(${roomIds}::uuid[])
    `,
    db`
      SELECT
        room_id,
        to_char(date, 'YYYY-MM-DD') AS date,
        currency,
        price,
        min_nights,
        max_nights,
        min_nights_on_arrival,
        is_closed,
        closed_on_arrival,
        closed_on_departure
      FROM room_daily_pricing
      WHERE tenant_id = ${tenantId}
        AND room_id = ANY(${roomIds}::uuid[])
        AND date BETWEEN ${scope.dateFrom}::date AND ${scope.dateTo}::date
    `,
    db`
      SELECT
        rr.room_id,
        rr.reservation_id,
        to_char(rr.check_in, 'YYYY-MM-DD') AS check_in,
        to_char(rr.check_out, 'YYYY-MM-DD') AS check_out,
        res.status
      FROM reservation_rooms rr
      JOIN reservations res ON res.id = rr.reservation_id
      WHERE res.tenant_id = ${tenantId}
        AND rr.room_id = ANY(${roomIds}::uuid[])
        AND res.status IN ('confirmed', 'checked_in')
        AND rr.check_in < ${scope.dateTo}::date + INTERVAL '1 day'
        AND rr.check_out > ${scope.dateFrom}::date
    `,
  ])

  const rooms: BulkUpdateRoomOption[] = (roomRows as unknown as Array<{
    id: string
    room_number: string
    room_name: string | null
    room_type_id: string | null
    room_type_name: string | null
    building_id: string | null
    building_name: string | null
    floor_id: string | null
    floor_name: string | null
    base_price: number | null
    is_active: boolean
  }>).map((r) => ({
    id: r.id,
    room_number: r.room_number,
    room_name: r.room_name,
    room_type_id: r.room_type_id,
    room_type_name: r.room_type_name,
    building_id: r.building_id,
    building_name: r.building_name,
    floor_id: r.floor_id,
    floor_name: r.floor_name,
    base_price: r.base_price !== null ? Number(r.base_price) : null,
    is_active: r.is_active,
  }))

  const existingPricing = (pricingRows as unknown as ExistingDailyPricingRow[]).map(
    (r) => ({
      ...r,
      price: r.price !== null ? Number(r.price) : null,
    }),
  )

  return {
    rooms,
    existingPricing,
    reservationOverlaps: overlapRows as unknown as ReservationOverlapRow[],
  }
}

// ── Preview entry point ───────────────────────────────────────

export async function computeBulkUpdatePreview(
  tenantId: string,
  input: BulkUpdateActionInput,
): Promise<BulkUpdatePreview> {
  const ctx = await fetchContext(tenantId, input)
  return buildPreview(input.fields, input.scope, ctx)
}

// ── Apply entry point ─────────────────────────────────────────

export interface ExecuteBulkUpdateResult {
  success: boolean
  error?: string
  logId?: string
  affectedRecords: number
  skippedRecords: number
  warnings: BulkUpdateWarning[]
  preview: BulkUpdatePreview
}

export async function executeBulkUpdate(
  tenantId: string,
  userId: string,
  input: BulkUpdateActionInput,
): Promise<ExecuteBulkUpdateResult> {
  const started = Date.now()

  // 1. Validate — refuse blocking errors
  const validationWarnings = validateBulkUpdate(input.fields, input.scope)
  if (hasBlockingErrors(validationWarnings)) {
    const first = validationWarnings.find((w) => w.level === "error")
    return {
      success: false,
      error: first?.message ?? "קלט לא תקין",
      affectedRecords: 0,
      skippedRecords: 0,
      warnings: validationWarnings,
      preview: {
        roomsCount: 0,
        datesCount: 0,
        weekdays: input.scope.weekdays,
        fieldsToUpdate: [],
        affectedRecords: 0,
        skippedRecords: 0,
        warnings: validationWarnings,
        rows: [],
      },
    }
  }

  // 2. Fetch context (single round trip)
  const ctx = await fetchContext(tenantId, input)

  // 3. Build preview (for the result) + apply plan
  const preview = buildPreview(input.fields, input.scope, ctx)
  const plan = buildApplyPlan(input.fields, input.scope, ctx)

  // 4. Run mutation inside a transaction
  const logId = await runTransaction(tenantId, userId, input, plan, preview, started)

  return {
    success: true,
    logId,
    affectedRecords: plan.affectedCount,
    skippedRecords: plan.skippedCount,
    warnings: preview.warnings,
    preview,
  }
}

async function runTransaction(
  tenantId: string,
  userId: string,
  input: BulkUpdateActionInput,
  plan: ApplyPlan,
  preview: BulkUpdatePreview,
  startedMs: number,
): Promise<string> {
  return db.begin(async (sql) => {
    // 4a. Write the master log row
    const [logRow] = await sql`
      INSERT INTO bulk_room_update_logs (
        tenant_id, created_by, date_from, date_to,
        selected_weekdays, selected_room_ids,
        changed_fields_json, affected_records, skipped_records,
        warnings_json, execution_time_ms
      ) VALUES (
        ${tenantId}, ${userId},
        ${input.scope.dateFrom}::date, ${input.scope.dateTo}::date,
        ${input.scope.weekdays as unknown as number[]}::int[],
        ${input.scope.roomIds as unknown as string[]}::uuid[],
        ${JSON.stringify(input.fields)}::jsonb,
        ${plan.affectedCount},
        ${plan.skippedCount},
        ${JSON.stringify(preview.warnings)}::jsonb,
        ${Date.now() - startedMs}
      )
      RETURNING id
    `

    const logId = logRow.id as string

    // 4b. UPSERT each (room, date) operation
    for (const op of plan.operations) {
      if (op.skipped) continue
      const p = op.patch

      // Combine prior row with patch, fall back to sensible defaults
      const finalCurrency =
        p.currency !== undefined ? p.currency : op.previous.currency
      const finalPrice =
        p.price !== undefined ? p.price : op.previous.price
      const finalMinNights =
        p.min_nights !== undefined ? p.min_nights : op.previous.min_nights
      const finalMaxNights =
        p.max_nights !== undefined ? p.max_nights : op.previous.max_nights
      const finalMinNightsArrival =
        p.min_nights_on_arrival !== undefined
          ? p.min_nights_on_arrival
          : op.previous.min_nights_on_arrival
      const finalIsClosed =
        p.is_closed !== undefined ? p.is_closed : op.previous.is_closed
      const finalClosedOnArrival =
        p.closed_on_arrival !== undefined
          ? p.closed_on_arrival
          : op.previous.closed_on_arrival
      const finalClosedOnDeparture =
        p.closed_on_departure !== undefined
          ? p.closed_on_departure
          : op.previous.closed_on_departure

      await sql`
        INSERT INTO room_daily_pricing (
          tenant_id, room_id, date,
          currency, price,
          min_nights, max_nights, min_nights_on_arrival,
          is_closed, closed_on_arrival, closed_on_departure,
          source_type, source_id, updated_by, updated_at
        ) VALUES (
          ${tenantId}, ${op.roomId}, ${op.date}::date,
          ${finalCurrency}, ${finalPrice},
          ${finalMinNights}, ${finalMaxNights}, ${finalMinNightsArrival},
          ${finalIsClosed}, ${finalClosedOnArrival}, ${finalClosedOnDeparture},
          'bulk_update', ${logId}, ${userId}, now()
        )
        ON CONFLICT (room_id, date) DO UPDATE SET
          currency = EXCLUDED.currency,
          price = EXCLUDED.price,
          min_nights = EXCLUDED.min_nights,
          max_nights = EXCLUDED.max_nights,
          min_nights_on_arrival = EXCLUDED.min_nights_on_arrival,
          is_closed = EXCLUDED.is_closed,
          closed_on_arrival = EXCLUDED.closed_on_arrival,
          closed_on_departure = EXCLUDED.closed_on_departure,
          source_type = 'bulk_update',
          source_id = ${logId},
          updated_by = ${userId},
          updated_at = now()
      `

      // 4c. Write per-cell log item
      await sql`
        INSERT INTO bulk_room_update_log_items (
          bulk_update_log_id, room_id, date,
          previous_values_json, new_values_json
        ) VALUES (
          ${logId}, ${op.roomId}, ${op.date}::date,
          ${JSON.stringify(op.previous)}::jsonb,
          ${JSON.stringify(op.patch)}::jsonb
        )
      `
    }

    return logId
  })
}

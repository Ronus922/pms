"use server"

import { db } from "@/lib/db"
import { getEffectiveRoomDailyPricingBatch } from "@/lib/utils/effective-pricing"

export async function getCalendarData(tenantId: string, startDate: string, endDate: string) {
  // Get rooms with type info + base price + live cleaning_state (drives the
  // "dirty" / "in_progress" / "clean" portion of the room's derived status).
  const rooms = await db`
    SELECT
      r.id, r.room_number, r.name, r.status, r.cleaning_state, r.sort_order,
      r.floor_id, r.building_id, r.room_type_id,
      rt.name AS room_type_name,
      COALESCE(r.max_occupancy, rt.max_occupancy)      AS max_occupancy,
      COALESCE(r.default_guests, rt.default_occupancy) AS default_occupancy,
      COALESCE(r.max_adults,    rt.max_adults)         AS max_adults,
      COALESCE(r.max_children,  rt.max_children)       AS max_children,
      COALESCE(r.max_infants,   rt.max_infants)        AS max_infants,
      rt.base_price, rt.extra_person_price,
      f.name AS floor_name, f.sort_order AS floor_sort,
      b.name AS building_name
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    LEFT JOIN floors f ON f.id = r.floor_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE r.tenant_id = ${tenantId}
      AND r.is_active = true
    ORDER BY b.sort_order, f.sort_order, r.sort_order, r.room_number
  `

  // Get reservations that overlap the date range
  const reservations = await db`
    SELECT
      res.id, res.reservation_number, res.status, res.check_in, res.check_out,
      res.adults, res.children, res.source, res.is_vip,
      res.payment_status, res.total_price, res.balance_due,
      res.general_notes, res.internal_notes,
      res.estimated_arrival_time, res.estimated_departure_time,
      res.actual_checkin_time, res.actual_checkout_time,
      g.first_name, g.last_name, g.full_name, g.phone, g.email, g.is_vip as guest_vip,
      rr.id as segment_id,
      rr.room_id, rr.rate_per_night,
      rr.check_in as segment_check_in, rr.check_out as segment_check_out
    FROM reservations res
    JOIN guests g ON g.id = res.guest_id
    JOIN reservation_rooms rr ON rr.reservation_id = res.id
    WHERE res.tenant_id = ${tenantId}
      AND rr.check_in < ${endDate}::date
      AND rr.check_out > ${startDate}::date
      AND res.status NOT IN ('cancelled')
    ORDER BY rr.check_in
  `

  // Get rate overrides for the date range
  const rateOverrides = await db`
    SELECT ro.room_type_id, ro.date_from, ro.date_to, ro.price, ro.min_nights, ro.stop_sell, ro.reason
    FROM rate_overrides ro
    WHERE ro.tenant_id = ${tenantId}
      AND ro.date_from <= ${endDate}::date
      AND ro.date_to >= ${startDate}::date
  `

  // Get default rate plans min_nights
  const ratePlans = await db`
    SELECT rp.id, rp.min_nights, rp.type
    FROM rate_plans rp
    WHERE rp.tenant_id = ${tenantId} AND rp.is_active = true
  `

  // Get date-scoped room blocks
  const blocks = await db`
    SELECT rb.room_id, rb.block_date, rb.reason
    FROM room_blocks rb
    WHERE rb.tenant_id = ${tenantId}
      AND rb.block_date >= ${startDate}::date
      AND rb.block_date < ${endDate}::date
    ORDER BY rb.block_date
  `

  // Get tenant currency + operational times used by the board for partial-day rendering
  const [tenant] = await db`
    SELECT currency,
           default_checkin_time, default_checkout_time,
           sabbath_checkin_time, sabbath_checkout_time
    FROM tenants WHERE id = ${tenantId}
  `

  // Per-room, per-date overrides from room_daily_pricing — highest priority
  // for cell pricing/closure display. Empty array when no overrides exist.
  const roomIds = (rooms as unknown as { id: string }[]).map((r) => r.id)
  // endDate is exclusive in this API, but room_daily_pricing.date is inclusive,
  // so we query up to endDate - 1 day to avoid bleeding into the next frame.
  const lastVisibleDate = shiftIsoDate(endDate, -1)
  const dailyPricing =
    roomIds.length > 0 && startDate <= lastVisibleDate
      ? await getEffectiveRoomDailyPricingBatch(
          tenantId,
          roomIds,
          startDate,
          lastVisibleDate,
        )
      : []

  return {
    rooms,
    reservations,
    rateOverrides,
    ratePlans,
    blocks,
    dailyPricing,
    currency: tenant?.currency || "ILS",
    operationalTimes: {
      default_checkin_time: tenant?.default_checkin_time ?? null,
      default_checkout_time: tenant?.default_checkout_time ?? null,
      sabbath_checkin_time: tenant?.sabbath_checkin_time ?? null,
      sabbath_checkout_time: tenant?.sabbath_checkout_time ?? null,
    },
  }
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

export async function moveReservation(
  tenantId: string,
  reservationId: string,
  roomId: string,
  newCheckIn: string,
  newCheckOut: string
) {
  // Check availability
  const [available] = await db`
    SELECT check_room_availability(
      ${tenantId}::uuid,
      ${roomId}::uuid,
      ${newCheckIn}::date,
      ${newCheckOut}::date,
      ${reservationId}::uuid
    ) as is_available
  `

  if (!available?.is_available) {
    return { success: false, error: "החדר לא זמין בתאריכים אלו" }
  }

  // Update reservation_rooms
  await db`
    UPDATE reservation_rooms
    SET room_id = ${roomId}, check_in = ${newCheckIn}::date, check_out = ${newCheckOut}::date
    WHERE reservation_id = ${reservationId} AND tenant_id = ${tenantId}
  `

  // Update main reservation dates if single room
  const [roomCount] = await db`
    SELECT COUNT(*) as cnt FROM reservation_rooms WHERE reservation_id = ${reservationId}
  `

  if (parseInt(roomCount.cnt) === 1) {
    await db`
      UPDATE reservations
      SET check_in = ${newCheckIn}::date, check_out = ${newCheckOut}::date, updated_at = NOW()
      WHERE id = ${reservationId} AND tenant_id = ${tenantId}
    `
  }

  return { success: true }
}

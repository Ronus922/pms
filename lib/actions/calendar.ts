"use server"

import { db } from "@/lib/db"

export async function getCalendarData(tenantId: string, startDate: string, endDate: string) {
  // Get rooms with type info + base price
  const rooms = await db`
    SELECT
      r.id, r.room_number, r.name, r.status, r.sort_order,
      r.floor_id, r.building_id, r.room_type_id,
      rt.name as room_type_name, rt.max_occupancy, rt.base_price,
      f.name as floor_name, f.sort_order as floor_sort,
      b.name as building_name
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
      g.first_name, g.last_name, g.full_name, g.phone, g.email, g.is_vip as guest_vip,
      rr.room_id, rr.rate_per_night
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

  // Get tenant currency
  const [tenant] = await db`
    SELECT currency FROM tenants WHERE id = ${tenantId}
  `

  return { rooms, reservations, rateOverrides, ratePlans, currency: tenant?.currency || "ILS" }
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

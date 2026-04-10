"use server"

import { db } from "@/lib/db"

export async function getReservationFull(reservationId: string) {
  const [res] = await db`
    SELECT
      r.id, r.reservation_number, r.status, r.check_in, r.check_out,
      r.actual_checkin_time, r.actual_checkout_time,
      r.estimated_arrival_time, r.estimated_departure_time,
      r.adults, r.children, r.infants, r.source, r.channel,
      r.is_vip, r.is_early_checkin, r.is_late_checkout,
      r.meal_plan, r.special_requests, r.general_notes, r.internal_notes,
      r.reception_notes, r.cleaning_notes, r.maintenance_notes,
      r.payment_status, r.payment_method, r.total_price, r.total_paid, r.balance_due,
      r.deposit, r.discount_percent, r.discount_per_night, r.tax_exempt, r.tax_amount,
      r.subtotal, r.coupon_code, r.company, r.agent, r.ad_source,
      r.external_id, r.channel_manager_id, r.cancellation_policy,
      r.parking, r.transport, r.accessibility, r.extra_beds, r.crib, r.flight_number,
      r.created_at, r.updated_at, r.created_by, r.updated_by, r.tenant_id, r.property_id,
      g.id as guest_id, g.first_name, g.last_name, g.full_name as guest_name,
      g.email as guest_email, g.phone as guest_phone, g.is_vip as guest_vip,
      g.country as guest_country, g.id_number as guest_id_number,
      g.preferred_language as guest_language, g.tags as guest_tags
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE r.id = ${reservationId}
  `
  if (!res) return null

  const rooms = await db`
    SELECT rr.id, rr.room_id, rr.check_in, rr.check_out, rr.rate_per_night,
      rm.room_number, rm.status as room_status,
      rt.name as room_type_name, rt.max_occupancy,
      f.name as floor_name, b.name as building_name
    FROM reservation_rooms rr
    JOIN rooms rm ON rm.id = rr.room_id
    LEFT JOIN room_types rt ON rt.id = rm.room_type_id
    LEFT JOIN floors f ON f.id = rm.floor_id
    LEFT JOIN buildings b ON b.id = rm.building_id
    WHERE rr.reservation_id = ${reservationId}
    ORDER BY rm.room_number
  `

  const charges = await db`
    SELECT id, description, amount, quantity, total, charge_date, created_at
    FROM reservation_charges
    WHERE reservation_id = ${reservationId}
    ORDER BY created_at DESC
  `

  const payments = await db`
    SELECT id, amount, method, status, morning_invoice_id, notes, created_at
    FROM payments
    WHERE reservation_id = ${reservationId}
    ORDER BY created_at DESC
  `

  const logs = await db`
    SELECT al.id, al.action, al.entity_type, al.changes, al.created_at,
      u.full_name as user_name
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_id = ${reservationId}
    ORDER BY al.created_at DESC
    LIMIT 50
  `

  return { ...res, rooms, charges, payments, logs }
}

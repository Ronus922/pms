"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"

export async function getReservationFull(reservationId: string) {
  const actor = await requireActor()
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
      r.price_mode, r.manual_nightly_rate, r.manual_total,
      r.discount_mode, r.discount_value, r.vat_inclusive, r.vat_rate,
      r.currency, r.exchange_rate, r.pricing_breakdown, r.rate_plan_id,
      r.card_holder_name, r.card_last4, r.card_holder_id,
      r.card_expiry_month, r.card_expiry_year,
      r.card_approval_code, r.card_transaction_ref, r.card_installments,
      r.external_id, r.channel_manager_id, r.cancellation_policy,
      r.parking, r.transport, r.accessibility, r.extra_beds, r.crib, r.flight_number,
      r.created_at, r.updated_at, r.created_by, r.updated_by, r.tenant_id, r.property_id,
      g.id as guest_id, g.first_name, g.last_name, g.full_name as guest_name,
      g.email as guest_email, g.phone as guest_phone, g.is_vip as guest_vip,
      g.country as guest_country, g.id_number as guest_id_number,
      g.preferred_language as guest_language, g.tags as guest_tags
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE r.id = ${reservationId} AND r.tenant_id = ${actor.tenantId}
  `
  if (!res) return null

  // Merge per-room overrides with room_types defaults so the edit UI
  // mirrors Room Management's effective values. Per-row composition + guest
  // contact come from reservation_rooms columns added in migration
  // 2026-04-21_reservation_rooms_per_room_fields.sql.
  const rooms = await db`
    SELECT rr.id, rr.room_id, rr.check_in, rr.check_out, rr.rate_per_night,
      rr.adults, rr.children, rr.infants,
      rr.guest_first_name, rr.guest_last_name, rr.guest_phone, rr.guest_email, rr.guest_id_number,
      -- Per-room pricing controls (2026-07-25 pricing migration). Without these
      -- the edit panel would re-open every room in "auto" and silently discard
      -- an override the operator saved a minute earlier.
      rr.price_mode, rr.manual_nightly_rate, rr.manual_total,
      rr.discount_mode, rr.discount_value, rr.vat_inclusive,
      rr.vat_rate, rr.currency, rr.exchange_rate, rr.pricing_breakdown,
      rm.room_number, rm.status AS room_status,
      rt.name AS room_type_name,
      COALESCE(rm.max_occupancy, rt.max_occupancy) AS max_occupancy,
      COALESCE(rm.max_adults,    rt.max_adults)    AS max_adults,
      COALESCE(rm.max_children,  rt.max_children)  AS max_children,
      COALESCE(rm.max_infants,   rt.max_infants)   AS max_infants,
      rt.base_price AS base_price,
      rt.extra_person_price AS extra_person_price,
      rt.default_occupancy AS default_occupancy,
      f.name AS floor_name, b.name AS building_name
    FROM reservation_rooms rr
    JOIN rooms rm ON rm.id = rr.room_id
    LEFT JOIN room_types rt ON rt.id = rm.room_type_id
    LEFT JOIN floors f ON f.id = rm.floor_id
    LEFT JOIN buildings b ON b.id = rm.building_id
    WHERE rr.reservation_id = ${reservationId} AND rr.tenant_id = ${actor.tenantId}
    ORDER BY rm.room_number
  `

  // Every child query filters on tenant_id explicitly. Relying on the parent
  // SELECT above to have proven ownership makes each of these one refactor away
  // from leaking another tenant's rows — the predicate belongs on the query
  // that reads the data, not on a check somewhere upstream.
  const charges = await db`
    SELECT id, description, amount, quantity, total, charge_date, created_at
    FROM reservation_charges
    WHERE reservation_id = ${reservationId} AND tenant_id = ${actor.tenantId}
    ORDER BY created_at DESC
  `

  const payments = await db`
    SELECT id, amount, method, status, morning_invoice_id, notes, created_at
    FROM payments
    WHERE reservation_id = ${reservationId} AND tenant_id = ${actor.tenantId}
    ORDER BY created_at DESC
  `

  const logs = await db`
    SELECT al.id, al.action, al.entity_type, al.changes, al.created_at,
      u.full_name as user_name
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_id = ${reservationId} AND al.tenant_id = ${actor.tenantId}
    ORDER BY al.created_at DESC
    LIMIT 50
  `

  return { ...res, rooms, charges, payments, logs }
}

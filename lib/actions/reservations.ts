"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { createCleaningTasksForCheckout, cancelCleaningTasksForReservation } from "@/lib/actions/cleaning"

export async function getReservationDetails(reservationId: string) {
  const actor = await requireActor()
  const [res] = await db`
    SELECT
      r.id, r.reservation_number, r.status, r.check_in, r.check_out,
      r.adults, r.children, r.infants, r.source, r.channel,
      r.is_vip, r.is_early_checkin, r.is_late_checkout,
      r.meal_plan, r.special_requests, r.general_notes, r.internal_notes,
      r.payment_status, r.payment_method, r.total_price, r.total_paid, r.balance_due,
      r.deposit, r.discount_percent, r.tax_exempt,
      r.created_at, r.updated_at,
      g.id as guest_id, g.first_name, g.last_name, g.full_name as guest_name,
      g.email as guest_email, g.phone as guest_phone, g.is_vip as guest_vip,
      g.country as guest_country
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE r.id = ${reservationId} AND r.tenant_id = ${actor.tenantId}
  `

  if (!res) return null

  const rooms = await db`
    SELECT rr.room_id, rr.check_in, rr.check_out, rr.rate_per_night,
      rm.room_number, rt.name as room_type_name
    FROM reservation_rooms rr
    JOIN rooms rm ON rm.id = rr.room_id
    LEFT JOIN room_types rt ON rt.id = rm.room_type_id
    WHERE rr.reservation_id = ${reservationId}
    ORDER BY rm.room_number
  `

  return { ...res, rooms }
}

export async function updateReservationStatus(reservationId: string, _tenantId: string, status: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  await db`
    UPDATE reservations SET status = ${status}, updated_at = NOW()
    WHERE id = ${reservationId} AND tenant_id = ${tenantId}
  `

  // Room occupancy is DERIVED from reservation_rooms + reservations.status
  // (see lib/actions/rooms-status.ts). Do NOT write rooms.status for occupancy.

  // On check-out: auto-create cleaning tasks + flip rooms.cleaning_state='dirty'
  if (status === "checked_out") {
    await createCleaningTasksForCheckout(tenantId, reservationId, "manual_checkout")
  }

  return { success: true }
}

export async function toggleVip(reservationId: string, _tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  await db`
    UPDATE reservations SET is_vip = NOT is_vip, updated_at = NOW()
    WHERE id = ${reservationId} AND tenant_id = ${tenantId}
  `
  return { success: true }
}

export async function cancelReservation(reservationId: string, _tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  await db`
    UPDATE reservations SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${reservationId} AND tenant_id = ${tenantId}
  `
  // Cancel any pending cleaning tasks tied to this reservation
  await cancelCleaningTasksForReservation(tenantId, reservationId)
  return { success: true }
}

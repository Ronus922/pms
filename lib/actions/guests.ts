"use server"

import { db } from "@/lib/db"

export async function getGuestsList(tenantId: string) {
  const guests = await db`
    SELECT g.id, g.first_name, g.last_name, g.full_name, g.phone, g.email,
      g.is_vip, g.is_blocked, g.source, g.company, g.country,
      g.total_reservations, g.total_revenue, g.total_cancellations, g.total_no_shows,
      g.created_at
    FROM guests g
    WHERE g.tenant_id = ${tenantId}
    ORDER BY g.created_at DESC
    LIMIT 200
  `
  return guests
}

export async function getReservationsList(tenantId: string) {
  const reservations = await db`
    SELECT r.id, r.reservation_number, r.status, r.check_in, r.check_out,
      r.adults, r.children, r.source, r.is_vip,
      r.payment_status, r.total_price, r.total_paid, r.balance_due,
      r.created_at,
      g.full_name as guest_name, g.phone as guest_phone,
      (SELECT string_agg(rm.room_number, ', ')
       FROM reservation_rooms rr JOIN rooms rm ON rm.id = rr.room_id
       WHERE rr.reservation_id = r.id) as room_numbers
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE r.tenant_id = ${tenantId}
    ORDER BY r.check_in DESC
    LIMIT 200
  `
  return reservations
}

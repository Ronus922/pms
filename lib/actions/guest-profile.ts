"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

export async function getGuestProfile(guestId: string) {
  let tenantId: string
  try {
    const actor = await requirePermission("guests", "view")
    tenantId = actor.tenantId
  } catch (err) {
    if (err instanceof AuthorizationError) return null
    throw err
  }

  const [guest] = await db`
    SELECT id, first_name, last_name, full_name, email, phone, id_number,
      date_of_birth, preferred_language, country, zip_code,
      general_notes, internal_notes, is_vip, is_blocked, source,
      company, agent, special_preferences, cleaning_notes, kitchen_notes, maintenance_notes,
      tags, custom_fields, total_reservations, total_revenue, total_cancellations, total_no_shows,
      preferred_room_type_id, preferred_payment_method,
      created_at
    FROM guests WHERE id = ${guestId} AND tenant_id = ${tenantId}
  `
  if (!guest) return null

  const reservations = await db`
    SELECT r.id, r.reservation_number, r.status, r.check_in, r.check_out,
      r.adults, r.children, r.source, r.total_price, r.payment_status, r.is_vip,
      rr.room_id,
      rm.room_number,
      rt.name as room_type_name
    FROM reservations r
    LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
    LEFT JOIN rooms rm ON rm.id = rr.room_id
    LEFT JOIN room_types rt ON rt.id = rm.room_type_id
    WHERE r.guest_id = ${guestId} AND r.tenant_id = ${tenantId}
    ORDER BY r.check_in DESC
    LIMIT 20
  `

  // Compute stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalNights = (reservations as any[]).reduce((sum: number, r: any) => {
    if (r.status === "cancelled") return sum
    const ci = new Date(r.check_in)
    const co = new Date(r.check_out)
    return sum + Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000))
  }, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (reservations as any[]).filter((r: any) => r.status !== "cancelled")
  const avgNights = active.length > 0 ? Math.round(totalNights / active.length) : 0

  return { ...guest, reservations, totalNights, avgNights }
}

"use server"

import { db } from "@/lib/db"
import { validateRoomCapacity } from "@/lib/utils/room-capacity"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

/**
 * Segment-level move — updates ONLY the given `reservation_rooms` row.
 * Sibling segments of the same parent reservation are left untouched.
 *
 * After the segment update, the parent reservation's top-level dates are
 * re-derived as MIN(check_in) / MAX(check_out) across all segments, so
 * downstream consumers that still read `reservations.check_in/check_out`
 * see the full span of the reservation.
 *
 * Security:
 *   - `_tenantId` parameter is IGNORED. The real tenantId is derived from
 *     the server session via `requirePermission("reservations", "edit")`.
 *     Every SELECT / UPDATE below uses the session-derived tenantId so
 *     a hostile caller cannot read or mutate another tenant's data.
 *   - Unauthenticated / insufficient-permission callers are rejected
 *     before any DB work happens.
 */
export async function moveReservationSegment(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  segmentId: string,
  roomId: string,
  newCheckIn: string,
  newCheckOut: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("reservations", "edit")
    const tenantId = actor.tenantId

    if (!segmentId || !roomId || !newCheckIn || !newCheckOut)
      return { success: false, error: "פרמטרים חסרים" }

    const [segment] = await db<{ reservation_id: string }[]>`
      SELECT reservation_id FROM reservation_rooms
      WHERE id = ${segmentId} AND tenant_id = ${tenantId}
    `
    if (!segment) return { success: false, error: "סגמנט לא נמצא" }
    const reservationId = segment.reservation_id

    // CORE RULE — target room capacity against reservation's guest composition.
    // See project_room_capacity_pricing_core.md §C.
    const [target] = await db<
      {
        room_type_id: string | null
        max_occupancy: number
        max_adults: number | null
        max_children: number | null
        max_infants: number | null
      }[]
    >`
      SELECT rt.id AS room_type_id,
        COALESCE(r.max_occupancy, rt.max_occupancy) AS max_occupancy,
        COALESCE(r.max_adults,    rt.max_adults)    AS max_adults,
        COALESCE(r.max_children,  rt.max_children)  AS max_children,
        COALESCE(r.max_infants,   rt.max_infants)   AS max_infants
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ${roomId} AND r.tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "חדר לא נמצא" }
    if (target.max_occupancy != null) {
      const [res] = await db<{ adults: number; children: number; infants: number }[]>`
        SELECT adults, children, infants FROM reservations
        WHERE id = ${reservationId} AND tenant_id = ${tenantId}
      `
      if (res) {
        const check = validateRoomCapacity(target, res)
        if (!check.ok) return { success: false, error: check.reason }
      }
    }

    // Availability check — excludes the parent reservation to avoid self-collision.
    // Safe for multi-segment reservations because UNIQUE(reservation_id, room_id)
    // prevents two segments of the same reservation sharing a room.
    const [availCheck] = await db`
      SELECT check_room_availability(
        ${tenantId}::uuid,
        ${roomId}::uuid,
        ${newCheckIn}::date,
        ${newCheckOut}::date,
        ${reservationId}::uuid
      ) as is_available
    `
    if (!availCheck?.is_available) return { success: false, error: "החדר לא זמין בטווח המבוקש" }

    await db`
      UPDATE reservation_rooms
      SET room_id = ${roomId}::uuid,
          check_in = ${newCheckIn}::date,
          check_out = ${newCheckOut}::date
      WHERE id = ${segmentId} AND tenant_id = ${tenantId}
    `

    // Re-derive parent reservation dates from the full set of segments.
    await db`
      UPDATE reservations
      SET check_in  = (SELECT MIN(check_in)  FROM reservation_rooms WHERE reservation_id = ${reservationId}),
          check_out = (SELECT MAX(check_out) FROM reservation_rooms WHERE reservation_id = ${reservationId}),
          updated_at = NOW()
      WHERE id = ${reservationId} AND tenant_id = ${tenantId}
    `

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה בהעברת סגמנט"
    return { success: false, error: message }
  }
}

/**
 * Segment-level resize — updates ONLY the given segment's dates. Room stays the same.
 * Mirrors `moveReservationSegment` but keeps `room_id` intact.
 *
 * Security: `_tenantId` is IGNORED; real tenant comes from the server
 * session via `requirePermission("reservations", "edit")`.
 */
export async function resizeReservationSegment(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  segmentId: string,
  newCheckIn: string,
  newCheckOut: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("reservations", "edit")
    const tenantId = actor.tenantId

    if (!segmentId || !newCheckIn || !newCheckOut)
      return { success: false, error: "פרמטרים חסרים" }

    const [segment] = await db<{ reservation_id: string; room_id: string }[]>`
      SELECT reservation_id, room_id FROM reservation_rooms
      WHERE id = ${segmentId} AND tenant_id = ${tenantId}
    `
    if (!segment) return { success: false, error: "סגמנט לא נמצא" }

    const [check] = await db`
      SELECT check_room_availability(
        ${tenantId}::uuid,
        ${segment.room_id}::uuid,
        ${newCheckIn}::date,
        ${newCheckOut}::date,
        ${segment.reservation_id}::uuid
      ) as is_available
    `
    if (!check?.is_available) return { success: false, error: "החדר לא זמין בטווח המבוקש" }

    await db`
      UPDATE reservation_rooms
      SET check_in = ${newCheckIn}::date,
          check_out = ${newCheckOut}::date
      WHERE id = ${segmentId} AND tenant_id = ${tenantId}
    `

    await db`
      UPDATE reservations
      SET check_in  = (SELECT MIN(check_in)  FROM reservation_rooms WHERE reservation_id = ${segment.reservation_id}),
          check_out = (SELECT MAX(check_out) FROM reservation_rooms WHERE reservation_id = ${segment.reservation_id}),
          updated_at = NOW()
      WHERE id = ${segment.reservation_id} AND tenant_id = ${tenantId}
    `

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה בעדכון שהות"
    return { success: false, error: message }
  }
}

/**
 * @deprecated — reservation-level resize. Retained for backwards compat in case
 * any caller outside the calendar board still uses it. Prefer
 * `resizeReservationSegment` for all new callers.
 *
 * Security: delegates to `resizeReservationSegment` so the same permission
 * gate + session-derived tenant applies. The `tenantId` arg is used ONLY
 * to look up the segment id candidate — and the downstream call ignores
 * it again in favour of the actor's session tenant. Belt + suspenders.
 */
export async function resizeReservation(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  reservationId: string,
  newCheckIn: string,
  newCheckOut: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("reservations", "edit")
    const tenantId = actor.tenantId

    const rows = await db<{ id: string }[]>`
      SELECT id FROM reservation_rooms
      WHERE reservation_id = ${reservationId} AND tenant_id = ${tenantId}
    `
    if (rows.length === 0) return { success: false, error: "הזמנה לא נמצאה" }
    if (rows.length > 1)
      return { success: false, error: "הזמנה מרובת חדרים — השתמש בשינוי ברמת הסגמנט" }

    return resizeReservationSegment("", rows[0].id, newCheckIn, newCheckOut)
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה בעדכון הזמנה"
    return { success: false, error: message }
  }
}

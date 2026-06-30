"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

export async function getRoomTypesList(_tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  return db`
    SELECT rt.*,
      (SELECT COUNT(*)::int FROM rooms r WHERE r.room_type_id = rt.id AND r.is_active = true) as room_count
    FROM room_types rt
    WHERE rt.tenant_id = ${tenantId}
    ORDER BY rt.sort_order, rt.name
  `
}

export async function createRoomType(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  data: {
    name: string
    base_price: number
    default_occupancy: number
    extra_person_price: number
    max_occupancy: number
    max_adults: number
    max_children: number
    max_infants: number
    is_accessible: boolean
    description: string
    amenities: string[]
  },
) {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    const rows = await db`
      INSERT INTO room_types (
        tenant_id, name, base_price, default_occupancy, extra_person_price,
        max_occupancy, max_adults, max_children, max_infants,
        is_accessible, description, amenities
      )
      VALUES (
        ${tenantId}, ${data.name}, ${data.base_price},
        ${data.default_occupancy}, ${data.extra_person_price},
        ${data.max_occupancy}, ${data.max_adults}, ${data.max_children}, ${data.max_infants},
        ${data.is_accessible}, ${data.description}, ${data.amenities}
      )
      RETURNING id
    `
    return { id: rows[0].id }
  } catch (err) {
    if (err instanceof AuthorizationError) return { error: err.message }
    throw err
  }
}

export async function updateRoomType(
  id: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  data: {
    name: string
    base_price: number
    default_occupancy: number
    extra_person_price: number
    max_occupancy: number
    max_adults: number
    max_children: number
    max_infants: number
    is_accessible: boolean
    is_active: boolean
    description: string
  },
) {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    await db`
      UPDATE room_types
      SET name = ${data.name},
          base_price = ${data.base_price},
          default_occupancy = ${data.default_occupancy},
          extra_person_price = ${data.extra_person_price},
          max_occupancy = ${data.max_occupancy},
          max_adults = ${data.max_adults},
          max_children = ${data.max_children},
          max_infants = ${data.max_infants},
          is_accessible = ${data.is_accessible},
          is_active = ${data.is_active},
          description = ${data.description}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    throw err
  }
}

export async function deleteRoomType(
  id: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
) {
  try {
    const actor = await requirePermission("rooms", "delete")
    const tenantId = actor.tenantId

    // Check if rooms are assigned to this type (scoped to actor tenant)
    const rooms = await db`
      SELECT COUNT(*)::int as count FROM rooms WHERE room_type_id = ${id} AND tenant_id = ${tenantId}
    `
    if (rooms[0].count > 0) {
      return { error: `לא ניתן למחוק — ${rooms[0].count} חדרים משויכים לסוג זה` }
    }

    await db`DELETE FROM room_types WHERE id = ${id} AND tenant_id = ${tenantId}`
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) return { error: err.message }
    throw err
  }
}

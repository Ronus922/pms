"use server"

import { db } from "@/lib/db"

export async function getRoomTypesList(tenantId: string) {
  return db`
    SELECT rt.*,
      (SELECT COUNT(*)::int FROM rooms r WHERE r.room_type_id = rt.id AND r.is_active = true) as room_count
    FROM room_types rt
    WHERE rt.tenant_id = ${tenantId}
    ORDER BY rt.sort_order, rt.name
  `
}

export async function createRoomType(
  tenantId: string,
  data: {
    name: string
    base_price: number
    max_occupancy: number
    max_adults: number
    max_children: number
    max_infants: number
    is_accessible: boolean
    description: string
    amenities: string[]
  },
) {
  const rows = await db`
    INSERT INTO room_types (tenant_id, name, base_price, max_occupancy, max_adults, max_children, max_infants, is_accessible, description, amenities)
    VALUES (${tenantId}, ${data.name}, ${data.base_price}, ${data.max_occupancy}, ${data.max_adults}, ${data.max_children}, ${data.max_infants}, ${data.is_accessible}, ${data.description}, ${data.amenities})
    RETURNING id
  `
  return { id: rows[0].id }
}

export async function updateRoomType(
  id: string,
  tenantId: string,
  data: {
    name: string
    base_price: number
    max_occupancy: number
    max_adults: number
    max_children: number
    max_infants: number
    is_accessible: boolean
    is_active: boolean
    description: string
  },
) {
  await db`
    UPDATE room_types
    SET name = ${data.name}, base_price = ${data.base_price}, max_occupancy = ${data.max_occupancy},
        max_adults = ${data.max_adults}, max_children = ${data.max_children}, max_infants = ${data.max_infants},
        is_accessible = ${data.is_accessible}, is_active = ${data.is_active}, description = ${data.description}
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `
  return { success: true }
}

export async function deleteRoomType(id: string, tenantId: string) {
  // Check if rooms are assigned to this type
  const rooms = await db`
    SELECT COUNT(*)::int as count FROM rooms WHERE room_type_id = ${id} AND tenant_id = ${tenantId}
  `
  if (rooms[0].count > 0) {
    return { error: `לא ניתן למחוק — ${rooms[0].count} חדרים משויכים לסוג זה` }
  }

  await db`DELETE FROM room_types WHERE id = ${id} AND tenant_id = ${tenantId}`
  return { success: true }
}

"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"

export async function getRoomsList(_tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  return db`
    SELECT r.id, r.room_number, r.status,
      rt.name AS room_type_name,
      COALESCE(r.max_occupancy, rt.max_occupancy) AS max_occupancy,
      f.name AS floor_name, b.name AS building_name
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    LEFT JOIN floors f ON f.id = r.floor_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE r.tenant_id = ${tenantId} AND r.is_active = true
    ORDER BY b.sort_order, f.sort_order, r.room_number
  `
}

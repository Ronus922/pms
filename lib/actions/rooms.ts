"use server"

import { db } from "@/lib/db"

export async function getRoomsList(tenantId: string) {
  return db`
    SELECT r.id, r.room_number, r.status,
      rt.name as room_type_name, rt.max_occupancy,
      f.name as floor_name, b.name as building_name
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    LEFT JOIN floors f ON f.id = r.floor_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE r.tenant_id = ${tenantId} AND r.is_active = true
    ORDER BY b.sort_order, f.sort_order, r.room_number
  `
}

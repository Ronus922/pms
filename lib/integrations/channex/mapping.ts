/**
 * Helpers for mapping between PMS entities and Channex entities.
 *
 * Kept separate from the orchestrator so that:
 *  - the Mapping UI can call these directly (auto-map button)
 *  - unit tests can exercise them without DB
 */

import "server-only"
import { db } from "@/lib/db"

export interface LocalRoomTypeSnapshot {
  id: string
  name: string
  max_adults: number
  max_children: number
  room_count: number
  base_price: number
}

export interface ChannexRoomTypeSnapshot {
  id: string
  title: string
  count_of_rooms: number
  occ_adults: number
  occ_children: number
}

/** Load our room types with physical room count, for initial sync. */
export async function loadLocalRoomTypes(
  tenantId: string,
): Promise<LocalRoomTypeSnapshot[]> {
  const rows = (await db`
    SELECT
      rt.id,
      rt.name,
      COALESCE(rt.max_adults, rt.max_occupancy, 2) AS max_adults,
      COALESCE(rt.max_children, 0) AS max_children,
      COALESCE(rt.base_price, 0) AS base_price,
      (SELECT COUNT(*) FROM rooms r
       WHERE r.room_type_id = rt.id
         AND r.tenant_id = ${tenantId}::uuid
         AND r.is_active = true) AS room_count
    FROM room_types rt
    WHERE rt.tenant_id = ${tenantId}::uuid
      AND rt.is_active = true
    ORDER BY rt.sort_order, rt.name
  `) as unknown as Array<{
    id: string
    name: string
    max_adults: number
    max_children: number
    base_price: string | number
    room_count: string | number
  }>

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    max_adults: Number(r.max_adults),
    max_children: Number(r.max_children),
    base_price: Number(r.base_price),
    room_count: Number(r.room_count),
  }))
}

/**
 * Auto-map local room types against a list of Channex room types,
 * by exact name (case-insensitive) and then by occupancy.
 */
export function autoMapRoomTypes(
  locals: LocalRoomTypeSnapshot[],
  channex: ChannexRoomTypeSnapshot[],
): Array<{ localId: string; channexId: string | null; reason: string }> {
  const byTitle = new Map<string, ChannexRoomTypeSnapshot>()
  for (const c of channex) byTitle.set(c.title.trim().toLowerCase(), c)

  const used = new Set<string>()
  return locals.map((l) => {
    const exact = byTitle.get(l.name.trim().toLowerCase())
    if (exact && !used.has(exact.id)) {
      used.add(exact.id)
      return { localId: l.id, channexId: exact.id, reason: "exact_name_match" }
    }
    // Fall back to occupancy + first unused
    const byOcc = channex.find(
      (c) =>
        !used.has(c.id) &&
        c.occ_adults === l.max_adults &&
        c.occ_children >= l.max_children,
    )
    if (byOcc) {
      used.add(byOcc.id)
      return { localId: l.id, channexId: byOcc.id, reason: "occupancy_match" }
    }
    return { localId: l.id, channexId: null, reason: "no_match" }
  })
}

/** Look up the rate_plan_link that maps our (tenant, room_type) → channex rate_plan. */
export async function findDefaultRatePlanLink(
  tenantId: string,
  roomTypeId: string,
): Promise<{
  ratePlanLinkId: string
  channexRatePlanId: string
  channexPropertyId: string
  channexRoomTypeId: string
  currency: string
  connectionId: string
  propertyLinkId: string
} | null> {
  const [row] = (await db`
    SELECT
      rpl.id            AS rate_plan_link_id,
      rpl.channex_rate_plan_id,
      rpl.currency,
      rpl.connection_id,
      rtl.channex_room_type_id,
      rtl.property_link_id,
      pl.channex_property_id
    FROM channel_rate_plan_links rpl
    JOIN channel_room_type_links rtl ON rtl.id = rpl.room_type_link_id
    JOIN channel_property_links pl ON pl.id = rtl.property_link_id
    WHERE rpl.tenant_id = ${tenantId}::uuid
      AND rtl.room_type_id = ${roomTypeId}::uuid
      AND rpl.is_default = true
      AND rpl.is_active = true
    LIMIT 1
  `) as unknown as Array<{
    rate_plan_link_id: string
    channex_rate_plan_id: string
    currency: string
    connection_id: string
    channex_room_type_id: string
    property_link_id: string
    channex_property_id: string
  }>

  if (!row) return null
  return {
    ratePlanLinkId: row.rate_plan_link_id,
    channexRatePlanId: row.channex_rate_plan_id,
    channexPropertyId: row.channex_property_id,
    channexRoomTypeId: row.channex_room_type_id,
    currency: row.currency,
    connectionId: row.connection_id,
    propertyLinkId: row.property_link_id,
  }
}

/** Resolve the room_type for a single physical room. */
export async function getRoomTypeId(
  tenantId: string,
  roomId: string,
): Promise<string | null> {
  const [row] = (await db`
    SELECT room_type_id FROM rooms
    WHERE id = ${roomId}::uuid AND tenant_id = ${tenantId}::uuid
    LIMIT 1
  `) as unknown as Array<{ room_type_id: string | null }>
  return row?.room_type_id ?? null
}

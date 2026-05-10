"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

// ── Type exports ──────────────────────────────────────────────

export interface RoomTypeOption {
  id: string
  name: string
  max_occupancy: number
  max_adults: number
  max_children: number
  max_infants: number
  base_price: number
  amenities: string[] | null
}

export interface BuildingOption {
  id: string
  name: string
}

export interface FloorOption {
  id: string
  building_id: string
  name: string
}

export interface EquipmentItem {
  id: string
  name: string
  category: string
  icon: string | null
}

interface RoomTranslationInput {
  room_name: string
  description_html: string
  meta_search_summary: string
  seo_title: string
  seo_description: string
}

interface SaveRoomInput {
  room_number: string
  wing: string
  room_type_id: string
  is_active: boolean
  is_listed: boolean
  sort_order: number
  building_id: string
  floor_id: string
  /** Long-lived lifecycle state. Only 'available' | 'inactive' | 'out_of_order'
   *  are writeable from the new UI; legacy 'blocked' / 'maintenance' rows are
   *  preserved if the form does not change them. */
  status?: string
  max_occupancy: number
  default_guests: number
  max_adults: number
  max_children: number
  max_infants: number
  single_beds: number
  double_beds: number
  queen_beds: number
  sofa_beds: number
  cribs: number
  sleeping_arrangement_note: string
  translations: Record<string, RoomTranslationInput>
  equipment_ids: string[]
  primary_image_id: string
}

interface ImageInput {
  file_url: string
  file_name: string
  file_size: number
  width: number
  height: number
  sort_order: number
  is_primary: boolean
}

// ── Form Options ──────────────────────────────────────────────

export async function getRoomFormOptions(tenantId: string) {
  const [roomTypes, buildings, floors] = await Promise.all([
    db`SELECT id, name, max_occupancy, max_adults, max_children, max_infants, base_price, amenities
       FROM room_types WHERE tenant_id = ${tenantId} AND is_active = true ORDER BY sort_order, name`,
    db`SELECT id, name FROM buildings WHERE tenant_id = ${tenantId} ORDER BY sort_order, name`,
    db`SELECT id, building_id, name FROM floors WHERE tenant_id = ${tenantId} ORDER BY sort_order, name`,
  ])

  return {
    roomTypes: roomTypes as unknown as RoomTypeOption[],
    buildings: buildings as unknown as BuildingOption[],
    floors: floors as unknown as FloorOption[],
  }
}

// ── Equipment List ────────────────────────────────────────────

export async function getEquipmentList(tenantId: string) {
  const rows = await db`
    SELECT id, name, category, icon
    FROM equipment
    WHERE tenant_id = ${tenantId} AND is_active = true
    ORDER BY category, sort_order, name
  `
  return rows as unknown as EquipmentItem[]
}

// ── Get Room by ID ────────────────────────────────────────────

interface RoomRow {
  id: string
  tenant_id: string
  property_id: string
  room_number: string
  wing: string | null
  is_active: boolean
  is_listed: boolean
  /** Long-lived lifecycle state. New values: 'available' | 'inactive' | 'out_of_order'.
   *  Legacy rows may still hold 'blocked' | 'maintenance' | 'unavailable'. */
  status: string
  room_type_id: string | null
  building_id: string | null
  floor_id: string | null
  sort_order: number
  /** Per-room occupancy caps — NULL = inherit from room_types. getRoomById
   *  merges these with the type row before returning to the UI. */
  max_occupancy: number | null
  default_guests: number | null
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
  single_beds: number
  double_beds: number
  queen_beds: number
  sofa_beds: number
  cribs: number
  sleeping_arrangement_note: string | null
  primary_image_id: string | null
  created_at: string
  updated_at: string
}

interface RoomImageRow {
  id: string
  file_url: string
  file_name: string
  file_size: number
  width: number
  height: number
  sort_order: number
  is_primary: boolean
}

export async function getRoomById(roomId: string, tenantId: string) {
  const [rooms, translations, equipment, images] = await Promise.all([
    // Merge per-room overrides with room_types. Per-room NULL → inherit type.
    // Reservation-form + Room-Management UI now read the same effective values.
    db`
      SELECT r.*,
        COALESCE(r.max_occupancy, rt.max_occupancy) AS effective_max_occupancy,
        COALESCE(r.default_guests, rt.default_occupancy) AS effective_default_guests,
        COALESCE(r.max_adults, rt.max_adults) AS effective_max_adults,
        COALESCE(r.max_children, rt.max_children) AS effective_max_children,
        COALESCE(r.max_infants, rt.max_infants) AS effective_max_infants
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ${roomId} AND r.tenant_id = ${tenantId}
      LIMIT 1
    `,
    db`
      SELECT language_code AS language, room_name, description_html, meta_search_summary, seo_title, seo_description
      FROM room_translations
      WHERE room_id = ${roomId}
    `,
    db`
      SELECT equipment_id
      FROM room_equipment
      WHERE room_id = ${roomId}
    `,
    db`
      SELECT id, file_url, file_name, file_size, width, height, sort_order, is_primary
      FROM room_images
      WHERE room_id = ${roomId}
      ORDER BY sort_order
    `,
  ])

  if (rooms.length === 0) return null

  const raw = rooms[0] as unknown as RoomRow & {
    effective_max_occupancy: number | null
    effective_default_guests: number | null
    effective_max_adults: number | null
    effective_max_children: number | null
    effective_max_infants: number | null
  }

  // UI binds to the same field names as before; substitute the effective
  // (merged) values so the form reflects what reservations will actually see.
  const room: RoomRow = {
    ...raw,
    max_occupancy: raw.effective_max_occupancy,
    default_guests: raw.effective_default_guests,
    max_adults: raw.effective_max_adults,
    max_children: raw.effective_max_children,
    max_infants: raw.effective_max_infants,
  }

  const translationsMap: Record<string, RoomTranslationInput> = {}
  for (const t of translations) {
    const row = t as unknown as { language: string } & RoomTranslationInput
    translationsMap[row.language] = {
      room_name: row.room_name,
      description_html: row.description_html,
      meta_search_summary: row.meta_search_summary,
      seo_title: row.seo_title,
      seo_description: row.seo_description,
    }
  }

  return {
    ...room,
    translations: translationsMap,
    equipment_ids: (equipment as unknown as { equipment_id: string }[]).map(
      (e) => e.equipment_id
    ),
    images: images as unknown as RoomImageRow[],
  }
}

// ── Create Room ───────────────────────────────────────────────

export async function createRoom(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  propertyId: string,
  data: SaveRoomInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    // Normalise status: only the new enum is writeable from this action.
    // If the caller passes a legacy value (blocked / maintenance / unavailable)
    // we drop it to 'available' — moving a room between operational closures
    // must go through the room_blocks model, not this form.
    const nextStatus = (() => {
      const s = (data.status || "available").trim()
      return s === "inactive" || s === "out_of_order" ? s : "available"
    })()

    const result = await db`
      INSERT INTO rooms (
        tenant_id, property_id, room_number, wing, is_active, is_listed, status,
        room_type_id, building_id, floor_id, sort_order,
        max_occupancy, default_guests, max_adults, max_children, max_infants,
        single_beds, double_beds, queen_beds, sofa_beds, cribs,
        sleeping_arrangement_note, primary_image_id
      ) VALUES (
        ${tenantId}, ${propertyId}, ${data.room_number}, ${data.wing || null},
        ${data.is_active}, ${data.is_listed}, ${nextStatus},
        ${data.room_type_id || null}, ${data.building_id || null}, ${data.floor_id || null},
        ${data.sort_order},
        ${data.max_occupancy}, ${data.default_guests}, ${data.max_adults},
        ${data.max_children}, ${data.max_infants},
        ${data.single_beds}, ${data.double_beds}, ${data.queen_beds},
        ${data.sofa_beds}, ${data.cribs},
        ${data.sleeping_arrangement_note || null}, ${data.primary_image_id || null}
      ) RETURNING id
    `
    const roomId = (result[0] as unknown as { id: string }).id

    // Insert translations
    await saveTranslations(roomId, data.translations)

    // Insert equipment links
    await syncEquipment(roomId, data.equipment_ids)

    return { success: true, id: roomId }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה ביצירת החדר"
    return { success: false, error: message }
  }
}

// ── Update Room ───────────────────────────────────────────────

export async function updateRoom(
  roomId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  data: SaveRoomInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    // Verify the room belongs to the actor's tenant.
    const [owner] = await db`
      SELECT id FROM rooms WHERE id = ${roomId} AND tenant_id = ${tenantId} LIMIT 1
    `
    if (!owner) {
      throw new AuthorizationError("חדר לא נמצא")
    }

    // Only write `status` when the caller sent a NEW-enum value. Legacy
    // values coming back from the form (user just clicked Save without
    // changing the dropdown) are ignored so we don't corrupt legacy rows.
    const writableStatus =
      data.status === "available" || data.status === "inactive" || data.status === "out_of_order"
        ? data.status
        : null

    await db`
      UPDATE rooms SET
        room_number = ${data.room_number},
        wing = ${data.wing || null},
        is_active = ${data.is_active},
        is_listed = ${data.is_listed},
        status = COALESCE(${writableStatus}, status),
        room_type_id = ${data.room_type_id || null},
        building_id = ${data.building_id || null},
        floor_id = ${data.floor_id || null},
        sort_order = ${data.sort_order},
        max_occupancy = ${data.max_occupancy},
        default_guests = ${data.default_guests},
        max_adults = ${data.max_adults},
        max_children = ${data.max_children},
        max_infants = ${data.max_infants},
        single_beds = ${data.single_beds},
        double_beds = ${data.double_beds},
        queen_beds = ${data.queen_beds},
        sofa_beds = ${data.sofa_beds},
        cribs = ${data.cribs},
        sleeping_arrangement_note = ${data.sleeping_arrangement_note || null},
        primary_image_id = ${data.primary_image_id || null},
        updated_at = now()
      WHERE id = ${roomId} AND tenant_id = ${tenantId}
    `

    // Upsert translations
    await saveTranslations(roomId, data.translations)

    // Sync equipment
    await syncEquipment(roomId, data.equipment_ids)

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה בעדכון החדר"
    return { success: false, error: message }
  }
}

// ── Room Images ───────────────────────────────────────────────

export async function saveRoomImage(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  roomId: string,
  imageData: ImageInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    // Verify the room belongs to the actor's tenant.
    const [owner] = await db`
      SELECT id FROM rooms WHERE id = ${roomId} AND tenant_id = ${tenantId} LIMIT 1
    `
    if (!owner) {
      throw new AuthorizationError("חדר לא נמצא")
    }

    const result = await db`
      INSERT INTO room_images (
        tenant_id, room_id, file_url, file_name, file_size,
        width, height, sort_order, is_primary
      ) VALUES (
        ${tenantId}, ${roomId}, ${imageData.file_url}, ${imageData.file_name},
        ${imageData.file_size}, ${imageData.width}, ${imageData.height},
        ${imageData.sort_order}, ${imageData.is_primary}
      ) RETURNING id
    `
    return { success: true, id: (result[0] as unknown as { id: string }).id }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message =
      err instanceof Error ? err.message : "שגיאה בשמירת התמונה"
    return { success: false, error: message }
  }
}

export async function deleteRoomImage(
  imageId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    await db`
      DELETE FROM room_images
      WHERE id = ${imageId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message =
      err instanceof Error ? err.message : "שגיאה במחיקת התמונה"
    return { success: false, error: message }
  }
}

export async function reorderRoomImages(
  roomId: string,
  imageIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    // Verify the room belongs to the actor's tenant before mutating images.
    const [owner] = await db`
      SELECT id FROM rooms WHERE id = ${roomId} AND tenant_id = ${tenantId} LIMIT 1
    `
    if (!owner) {
      throw new AuthorizationError("חדר לא נמצא")
    }

    await db.begin(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await tx`
          UPDATE room_images
          SET sort_order = ${i}
          WHERE id = ${imageIds[i]} AND room_id = ${roomId} AND tenant_id = ${tenantId}
        `
      }
    })
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message =
      err instanceof Error ? err.message : "שגיאה בסידור התמונות"
    return { success: false, error: message }
  }
}

// ── Internal Helpers ──────────────────────────────────────────

async function saveTranslations(
  roomId: string,
  translations: Record<string, RoomTranslationInput>
) {
  for (const [lang, t] of Object.entries(translations)) {
    if (!t.room_name && !t.description_html && !t.seo_title) continue

    await db`
      INSERT INTO room_translations (
        room_id, language_code, room_name, description_html,
        meta_search_summary, seo_title, seo_description
      ) VALUES (
        ${roomId}, ${lang}, ${t.room_name}, ${t.description_html},
        ${t.meta_search_summary}, ${t.seo_title}, ${t.seo_description}
      )
      ON CONFLICT (room_id, language_code) DO UPDATE SET
        room_name = EXCLUDED.room_name,
        description_html = EXCLUDED.description_html,
        meta_search_summary = EXCLUDED.meta_search_summary,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description
    `
  }
}

async function syncEquipment(roomId: string, equipmentIds: string[]) {
  await db`DELETE FROM room_equipment WHERE room_id = ${roomId}`

  if (equipmentIds.length > 0) {
    const rows = equipmentIds.map((eqId) => ({
      room_id: roomId,
      equipment_id: eqId,
    }))
    await db`INSERT INTO room_equipment ${db(rows, "room_id", "equipment_id")}`
  }
}

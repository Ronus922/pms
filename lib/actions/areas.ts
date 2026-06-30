"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type { Area, AreaCreateInput, AreaUpdateInput, AreaPickerItem } from "@/lib/types/area"

/* ── Get All Areas ────────────────────────────────────────── */

export async function getAreas(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  activeOnly = false
): Promise<Area[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT
      a.id, a.tenant_id, a.property_id,
      a.name, a.code, a.area_type,
      a.building_id, a.floor_id,
      a.is_active, a.cleaning_relevant, a.maintenance_relevant,
      a.sort_order, a.notes,
      a.created_at, a.updated_at,
      b.name AS building_name,
      f.name AS floor_name,
      li.label AS area_type_label,
      li.icon AS area_type_icon
    FROM areas a
    LEFT JOIN buildings b ON b.id = a.building_id
    LEFT JOIN floors f ON f.id = a.floor_id
    LEFT JOIN lookup_items li
      ON li.category = 'area_type'
      AND li.value = a.area_type
      AND li.tenant_id = a.tenant_id
    WHERE a.tenant_id = ${tenantId}
      ${activeOnly ? db`AND a.is_active = true` : db``}
    ORDER BY b.sort_order NULLS LAST, f.sort_order NULLS LAST, a.sort_order, a.name
  `
  return rows as unknown as Area[]
}

/* ── Get Area by ID ───────────────────────────────────────── */

export async function getAreaById(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  areaId: string
): Promise<Area | null> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT
      a.id, a.tenant_id, a.property_id,
      a.name, a.code, a.area_type,
      a.building_id, a.floor_id,
      a.is_active, a.cleaning_relevant, a.maintenance_relevant,
      a.sort_order, a.notes,
      a.created_at, a.updated_at,
      b.name AS building_name,
      f.name AS floor_name,
      li.label AS area_type_label,
      li.icon AS area_type_icon
    FROM areas a
    LEFT JOIN buildings b ON b.id = a.building_id
    LEFT JOIN floors f ON f.id = a.floor_id
    LEFT JOIN lookup_items li
      ON li.category = 'area_type'
      AND li.value = a.area_type
      AND li.tenant_id = a.tenant_id
    WHERE a.id = ${areaId} AND a.tenant_id = ${tenantId}
    LIMIT 1
  `
  return (row as unknown as Area) ?? null
}

/* ── Create Area ──────────────────────────────────────────── */

export async function createArea(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  propertyId: string,
  input: AreaCreateInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    const result = await db`
      INSERT INTO areas (
        tenant_id, property_id, name, code, area_type,
        building_id, floor_id, is_active,
        cleaning_relevant, maintenance_relevant,
        sort_order, notes
      ) VALUES (
        ${tenantId}, ${propertyId},
        ${input.name}, ${input.code ?? ""},
        ${input.area_type},
        ${input.building_id ?? null}, ${input.floor_id ?? null},
        ${input.is_active ?? true},
        ${input.cleaning_relevant ?? false},
        ${input.maintenance_relevant ?? true},
        ${input.sort_order ?? 0},
        ${input.notes ?? null}
      ) RETURNING id
    `
    const id = (result[0] as unknown as { id: string }).id
    return { success: true, id }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה ביצירת האזור"
    return { success: false, error: message }
  }
}

/* ── Update Area ──────────────────────────────────────────── */

export async function updateArea(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  areaId: string,
  input: AreaUpdateInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const tenantId = actor.tenantId

    // Verify the area belongs to the actor's tenant.
    const [owner] = await db`
      SELECT id FROM areas WHERE id = ${areaId} AND tenant_id = ${tenantId} LIMIT 1
    `
    if (!owner) {
      throw new AuthorizationError("אזור לא נמצא")
    }

    const sets: Record<string, unknown> = {}
    if (input.name !== undefined) sets.name = input.name
    if (input.code !== undefined) sets.code = input.code
    if (input.area_type !== undefined) sets.area_type = input.area_type
    if (input.building_id !== undefined) sets.building_id = input.building_id || null
    if (input.floor_id !== undefined) sets.floor_id = input.floor_id || null
    if (input.is_active !== undefined) sets.is_active = input.is_active
    if (input.cleaning_relevant !== undefined) sets.cleaning_relevant = input.cleaning_relevant
    if (input.maintenance_relevant !== undefined) sets.maintenance_relevant = input.maintenance_relevant
    if (input.sort_order !== undefined) sets.sort_order = input.sort_order
    if (input.notes !== undefined) sets.notes = input.notes

    await db`
      UPDATE areas
      SET ${db(sets, ...Object.keys(sets))}, updated_at = NOW()
      WHERE id = ${areaId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה בעדכון האזור"
    return { success: false, error: message }
  }
}

/* ── Lightweight Picker Lists ─────────────────────────────── */

export async function getAreasForPicker(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  opts?: { cleaningRelevant?: boolean; maintenanceRelevant?: boolean }
): Promise<AreaPickerItem[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT
      a.id, a.name, a.code,
      COALESCE(li.label, a.area_type) AS area_type_label,
      li.icon AS area_type_icon
    FROM areas a
    LEFT JOIN lookup_items li
      ON li.category = 'area_type'
      AND li.value = a.area_type
      AND li.tenant_id = a.tenant_id
    WHERE a.tenant_id = ${tenantId}
      AND a.is_active = true
      ${opts?.cleaningRelevant ? db`AND a.cleaning_relevant = true` : db``}
      ${opts?.maintenanceRelevant ? db`AND a.maintenance_relevant = true` : db``}
    ORDER BY a.sort_order, a.name
  `
  return rows as unknown as AreaPickerItem[]
}

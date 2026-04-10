"use server"

import { db } from "@/lib/db"
import type { LookupCategory, LookupItem, LookupCategoryId, LookupItemInput } from "@/lib/types/lookup"

/* ── Read ───────────────────────────────────────────────── */

export async function getCategories(): Promise<LookupCategory[]> {
  const rows = await db`
    SELECT id, label, description, sort_order
    FROM lookup_categories
    ORDER BY sort_order
  `
  return rows as unknown as LookupCategory[]
}

export async function getLookupItems(
  tenantId: string,
  category: LookupCategoryId,
  activeOnly = false
): Promise<LookupItem[]> {
  if (activeOnly) {
    const rows = await db`
      SELECT * FROM lookup_items
      WHERE tenant_id = ${tenantId} AND category = ${category} AND is_active = TRUE
      ORDER BY sort_order, label
    `
    return rows as unknown as LookupItem[]
  }
  const rows = await db`
    SELECT * FROM lookup_items
    WHERE tenant_id = ${tenantId} AND category = ${category}
    ORDER BY sort_order, label
  `
  return rows as unknown as LookupItem[]
}

export async function getAllLookups(
  tenantId: string,
  categories: LookupCategoryId[]
): Promise<Record<string, LookupItem[]>> {
  const rows = await db`
    SELECT * FROM lookup_items
    WHERE tenant_id = ${tenantId} AND category = ANY(${categories}) AND is_active = TRUE
    ORDER BY category, sort_order, label
  `

  const result: Record<string, LookupItem[]> = {}
  for (const cat of categories) result[cat] = []
  for (const row of rows) {
    const item = row as unknown as LookupItem
    if (!result[item.category]) result[item.category] = []
    result[item.category].push(item)
  }
  return result
}

/* ── Create ─────────────────────────────────────────────── */

export async function createLookupItem(
  tenantId: string,
  input: LookupItemInput
): Promise<{ success: boolean; error?: string; item?: LookupItem }> {
  try {
    // Get max sort_order for this category
    const [maxRow] = await db`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
      FROM lookup_items
      WHERE tenant_id = ${tenantId} AND category = ${input.category}
    `

    const [item] = await db`
      INSERT INTO lookup_items (tenant_id, category, value, label, color, icon, is_default, is_active, sort_order, metadata)
      VALUES (
        ${tenantId}, ${input.category}, ${input.value}, ${input.label},
        ${input.color ?? null}, ${input.icon ?? null},
        ${input.is_default ?? false}, ${input.is_active ?? true},
        ${input.sort_order ?? maxRow.next_order}, ${JSON.stringify(input.metadata ?? {})}
      )
      RETURNING *
    `
    return { success: true, item: item as unknown as LookupItem }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת ערך"
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { success: false, error: "ערך זה כבר קיים בקטגוריה" }
    }
    return { success: false, error: msg }
  }
}

/* ── Update ─────────────────────────────────────────────── */

export async function updateLookupItem(
  tenantId: string,
  itemId: string,
  updates: Partial<LookupItemInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db`
      UPDATE lookup_items SET
        label = COALESCE(${updates.label ?? null}, label),
        color = COALESCE(${updates.color ?? null}, color),
        icon = COALESCE(${updates.icon ?? null}, icon),
        is_default = COALESCE(${updates.is_default ?? null}, is_default),
        is_active = COALESCE(${updates.is_active ?? null}, is_active),
        sort_order = COALESCE(${updates.sort_order ?? null}, sort_order),
        updated_at = NOW()
      WHERE id = ${itemId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה בעדכון"
    return { success: false, error: msg }
  }
}

/* ── Toggle Active ──────────────────────────────────────── */

export async function toggleLookupItem(
  tenantId: string,
  itemId: string
): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  try {
    const [row] = await db`
      UPDATE lookup_items SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = ${itemId} AND tenant_id = ${tenantId}
      RETURNING is_active
    `
    return { success: true, is_active: row.is_active }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ── Delete ─────────────────────────────────────────────── */

export async function deleteLookupItem(
  tenantId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db`
      DELETE FROM lookup_items
      WHERE id = ${itemId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

/* ── Reorder ────────────────────────────────────────────── */

export async function reorderLookupItems(
  tenantId: string,
  category: LookupCategoryId,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db`
        UPDATE lookup_items SET sort_order = ${i + 1}, updated_at = NOW()
        WHERE id = ${orderedIds[i]} AND tenant_id = ${tenantId} AND category = ${category}
      `
    }
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בסידור" }
  }
}

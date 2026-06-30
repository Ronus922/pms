"use server"

import { db } from "@/lib/db"
import { requireActor, requireAdmin } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
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
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  category: LookupCategoryId,
  activeOnly = false
): Promise<LookupItem[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
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
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  categories: LookupCategoryId[]
): Promise<Record<string, LookupItem[]>> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
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
  _tenantId: string,
  input: LookupItemInput
): Promise<{ success: boolean; error?: string; item?: LookupItem }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

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
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת ערך"
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { success: false, error: "ערך זה כבר קיים בקטגוריה" }
    }
    return { success: false, error: msg }
  }
}

/* ── Update ─────────────────────────────────────────────── */

export async function updateLookupItem(
  _tenantId: string,
  itemId: string,
  updates: Partial<LookupItemInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

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
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה בעדכון"
    return { success: false, error: msg }
  }
}

/* ── Toggle Active ──────────────────────────────────────── */

export async function toggleLookupItem(
  _tenantId: string,
  itemId: string
): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

    const [row] = await db`
      UPDATE lookup_items SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = ${itemId} AND tenant_id = ${tenantId}
      RETURNING is_active
    `
    return { success: true, is_active: row.is_active }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ── Delete ─────────────────────────────────────────────── */

export async function deleteLookupItem(
  _tenantId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

    await db`
      DELETE FROM lookup_items
      WHERE id = ${itemId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

/* ── Tenant Settings ───────────────────────────────────── */

function timeToHHMM(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v.slice(0, 5)
  // postgres.js may return time as string; guard anyway
  return String(v).slice(0, 5)
}

export async function getTenantSettings(_tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [row] = await db`
    SELECT notification_email,
           default_checkin_time, default_checkout_time,
           sabbath_checkin_time, sabbath_checkout_time,
           vat_rate
    FROM tenants WHERE id = ${tenantId}
  `
  return {
    notificationEmail: row?.notification_email || "",
    defaultCheckinTime: timeToHHMM(row?.default_checkin_time) || "15:00",
    defaultCheckoutTime: timeToHHMM(row?.default_checkout_time) || "11:00",
    sabbathCheckinTime: timeToHHMM(row?.sabbath_checkin_time),
    sabbathCheckoutTime: timeToHHMM(row?.sabbath_checkout_time),
    vatRate: row?.vat_rate != null ? Number(row.vat_rate) : 17,
  }
}

export async function updateTenantSettings(
  _tenantId: string,
  settings: {
    notificationEmail?: string
    defaultCheckinTime?: string
    defaultCheckoutTime?: string
    sabbathCheckinTime?: string | null
    sabbathCheckoutTime?: string | null
    vatRate?: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

    if (settings.notificationEmail !== undefined) {
      await db`
        UPDATE tenants SET notification_email = ${settings.notificationEmail || null}
        WHERE id = ${tenantId}
      `
    }

    if (settings.defaultCheckinTime !== undefined && settings.defaultCheckinTime) {
      await db`
        UPDATE tenants SET default_checkin_time = ${settings.defaultCheckinTime}::time
        WHERE id = ${tenantId}
      `
    }
    if (settings.defaultCheckoutTime !== undefined && settings.defaultCheckoutTime) {
      await db`
        UPDATE tenants SET default_checkout_time = ${settings.defaultCheckoutTime}::time
        WHERE id = ${tenantId}
      `
    }
    if (settings.sabbathCheckinTime !== undefined) {
      const v = settings.sabbathCheckinTime
      await db`
        UPDATE tenants SET sabbath_checkin_time = ${v ? v : null}::time
        WHERE id = ${tenantId}
      `
    }
    if (settings.sabbathCheckoutTime !== undefined) {
      const v = settings.sabbathCheckoutTime
      await db`
        UPDATE tenants SET sabbath_checkout_time = ${v ? v : null}::time
        WHERE id = ${tenantId}
      `
    }
    if (settings.vatRate !== undefined) {
      const clamped = Math.max(0, Math.min(100, Number(settings.vatRate) || 0))
      await db`
        UPDATE tenants SET vat_rate = ${clamped}
        WHERE id = ${tenantId}
      `
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון" }
  }
}

/* ── Reorder ────────────────────────────────────────────── */

export async function reorderLookupItems(
  _tenantId: string,
  category: LookupCategoryId,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const tenantId = actor.tenantId

    for (let i = 0; i < orderedIds.length; i++) {
      await db`
        UPDATE lookup_items SET sort_order = ${i + 1}, updated_at = NOW()
        WHERE id = ${orderedIds[i]} AND tenant_id = ${tenantId} AND category = ${category}
      `
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בסידור" }
  }
}

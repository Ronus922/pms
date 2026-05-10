"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { PHONE_REGEX, EMAIL_REGEX, SUPPLIER_TYPE_OPTIONS } from "@/lib/constants/suppliers"
import type {
  Supplier,
  SupplierDocument,
  SupplierActivity,
  SupplierLink,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierFilters,
  SupplierActivityAction,
  SupplierStatus,
} from "@/lib/types/suppliers"
import type { LookupItem } from "@/lib/types/lookup"

/* ── Helpers ───────────────────────────────────────────────── */

async function insertActivity(
  tenantId: string,
  supplierId: string,
  action: SupplierActivityAction,
  changedBy: string | null,
  changedByName: string | null,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db`
    INSERT INTO supplier_activity_log
      (tenant_id, supplier_id, action_type, changed_by, changed_by_name, message, metadata_json)
    VALUES
      (${tenantId}, ${supplierId}, ${action}, ${changedBy}, ${changedByName}, ${message}, ${JSON.stringify(metadata)})
  `
}

function validateSupplierInput(data: SupplierCreateInput): string | null {
  if (!data.display_name?.trim()) return "חובה להזין שם תצוגה"
  if (data.phone && !PHONE_REGEX.test(data.phone)) return "מספר טלפון לא תקין (7-20 ספרות)"
  if (data.mobile && !PHONE_REGEX.test(data.mobile)) return "מספר נייד לא תקין (7-20 ספרות)"
  if (data.email && !EMAIL_REGEX.test(data.email)) return "כתובת אימייל לא תקינה"
  return null
}

/* ── Read: List ────────────────────────────────────────────── */

export async function getSupplierList(
  tenantId: string,
  filters?: SupplierFilters,
): Promise<Supplier[]> {
  const search = filters?.search?.trim() ?? ""
  const status = filters?.status === "all" ? "" : (filters?.status ?? "")
  const type = filters?.type === "all" ? "" : (filters?.type ?? "")

  const rows = await db`
    SELECT
      s.*,
      (SELECT COUNT(*) FROM supplier_documents d WHERE d.supplier_id = s.id) AS documents_count,
      (SELECT COUNT(*) FROM supplier_links l WHERE l.supplier_id = s.id) AS links_count
    FROM suppliers s
    WHERE s.tenant_id = ${tenantId}
      AND s.deleted_at IS NULL
      AND (${status === ""}::boolean OR s.status = ${status})
      AND (${type === ""}::boolean OR s.supplier_type = ${type})
      AND (${search === ""}::boolean OR
        s.display_name ILIKE '%' || ${search} || '%' OR
        s.company_name ILIKE '%' || ${search} || '%' OR
        s.contact_person ILIKE '%' || ${search} || '%' OR
        s.phone ILIKE '%' || ${search} || '%' OR
        s.mobile ILIKE '%' || ${search} || '%' OR
        s.email ILIKE '%' || ${search} || '%'
      )
    ORDER BY
      CASE s.status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
      s.display_name
  `
  return rows as unknown as Supplier[]
}

/* ── Read: Single ──────────────────────────────────────────── */

export async function getSupplier(
  tenantId: string,
  supplierId: string,
): Promise<Supplier | null> {
  const [row] = await db`
    SELECT
      s.*,
      (SELECT COUNT(*) FROM supplier_documents d WHERE d.supplier_id = s.id) AS documents_count,
      (SELECT COUNT(*) FROM supplier_links l WHERE l.supplier_id = s.id) AS links_count
    FROM suppliers s
    WHERE s.id = ${supplierId}
      AND s.tenant_id = ${tenantId}
      AND s.deleted_at IS NULL
  `
  return (row as unknown as Supplier) ?? null
}

/* ── Read: Activity Log ────────────────────────────────────── */

export async function getSupplierActivityLog(
  tenantId: string,
  supplierId: string,
): Promise<SupplierActivity[]> {
  const rows = await db`
    SELECT * FROM supplier_activity_log
    WHERE supplier_id = ${supplierId} AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `
  return rows as unknown as SupplierActivity[]
}

/* ── Read: Documents ───────────────────────────────────────── */

export async function getSupplierDocuments(
  tenantId: string,
  supplierId: string,
): Promise<SupplierDocument[]> {
  const rows = await db`
    SELECT * FROM supplier_documents
    WHERE supplier_id = ${supplierId} AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `
  return rows as unknown as SupplierDocument[]
}

/* ── Read: Links ───────────────────────────────────────────── */

export async function getSupplierLinks(
  tenantId: string,
  supplierId: string,
): Promise<SupplierLink[]> {
  const rows = await db`
    SELECT * FROM supplier_links
    WHERE supplier_id = ${supplierId} AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `
  return rows as unknown as SupplierLink[]
}

/* ── Write: Create ─────────────────────────────────────────── */

export async function createSupplier(
  // tenantId / userId / userName are IGNORED — derived from server session.
  // Kept in signature for backwards compatibility with existing UI.
  _tenantId: string,
  data: SupplierCreateInput,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string; supplierId?: string }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const err = validateSupplierInput(data)
    if (err) return { success: false, error: err }

    const [row] = await db`
      INSERT INTO suppliers (
        tenant_id, display_name, company_name, contact_person, supplier_type,
        phone, mobile, email, website, address, city,
        tax_id, bank_name, bank_branch, bank_account, payment_terms,
        notes, internal_notes, rating,
        created_by, created_by_name
      ) VALUES (
        ${tenantId}, ${data.display_name.trim()},
        ${data.company_name?.trim() ?? ""}, ${data.contact_person?.trim() ?? ""},
        ${data.supplier_type ?? "general"},
        ${data.phone?.trim() ?? ""}, ${data.mobile?.trim() ?? ""},
        ${data.email?.trim() ?? ""}, ${data.website?.trim() ?? ""},
        ${data.address?.trim() ?? ""}, ${data.city?.trim() ?? ""},
        ${data.tax_id?.trim() ?? ""}, ${data.bank_name?.trim() ?? ""},
        ${data.bank_branch?.trim() ?? ""}, ${data.bank_account?.trim() ?? ""},
        ${data.payment_terms ?? "net_30"},
        ${data.notes?.trim() ?? ""}, ${data.internal_notes?.trim() ?? ""},
        ${data.rating ?? null},
        ${userId}, ${userName}
      )
      RETURNING id
    `

    const supplierId = row.id as string
    await insertActivity(tenantId, supplierId, "created", userId, userName, `ספק "${data.display_name}" נוצר`)

    return { success: true, supplierId }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת ספק" }
  }
}

/* ── Write: Update ─────────────────────────────────────────── */

export async function updateSupplier(
  _tenantId: string,
  supplierId: string,
  data: SupplierUpdateInput,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    if (data.display_name !== undefined && !data.display_name?.trim()) {
      return { success: false, error: "חובה להזין שם תצוגה" }
    }
    if (data.phone && !PHONE_REGEX.test(data.phone)) return { success: false, error: "מספר טלפון לא תקין" }
    if (data.mobile && !PHONE_REGEX.test(data.mobile)) return { success: false, error: "מספר נייד לא תקין" }
    if (data.email && !EMAIL_REGEX.test(data.email)) return { success: false, error: "אימייל לא תקין" }

    const existing = await getSupplier(tenantId, supplierId)
    if (!existing) return { success: false, error: "ספק לא נמצא" }

    // Build changes for audit
    const changes: string[] = []
    if (data.display_name && data.display_name !== existing.display_name) changes.push("שם תצוגה")
    if (data.phone !== undefined && data.phone !== existing.phone) changes.push("טלפון")
    if (data.mobile !== undefined && data.mobile !== existing.mobile) changes.push("נייד")
    if (data.email !== undefined && data.email !== existing.email) changes.push("אימייל")
    if (data.status && data.status !== existing.status) changes.push("סטטוס")

    await db`
      UPDATE suppliers SET
        display_name = ${data.display_name?.trim() ?? existing.display_name},
        company_name = ${data.company_name?.trim() ?? existing.company_name},
        contact_person = ${data.contact_person?.trim() ?? existing.contact_person},
        supplier_type = ${data.supplier_type ?? existing.supplier_type},
        status = ${data.status ?? existing.status},
        phone = ${data.phone?.trim() ?? existing.phone},
        mobile = ${data.mobile?.trim() ?? existing.mobile},
        email = ${data.email?.trim() ?? existing.email},
        website = ${data.website?.trim() ?? existing.website},
        address = ${data.address?.trim() ?? existing.address},
        city = ${data.city?.trim() ?? existing.city},
        tax_id = ${data.tax_id?.trim() ?? existing.tax_id},
        bank_name = ${data.bank_name?.trim() ?? existing.bank_name},
        bank_branch = ${data.bank_branch?.trim() ?? existing.bank_branch},
        bank_account = ${data.bank_account?.trim() ?? existing.bank_account},
        payment_terms = ${data.payment_terms ?? existing.payment_terms},
        notes = ${data.notes?.trim() ?? existing.notes},
        internal_notes = ${data.internal_notes?.trim() ?? existing.internal_notes},
        rating = ${data.rating ?? existing.rating}
      WHERE id = ${supplierId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
    `

    // Status change gets its own activity
    if (data.status && data.status !== existing.status) {
      await insertActivity(tenantId, supplierId, "status_changed", userId, userName,
        `סטטוס שונה מ-"${existing.status}" ל-"${data.status}"`,
        { old_status: existing.status, new_status: data.status })
    }

    if (changes.length > 0) {
      await insertActivity(tenantId, supplierId, "updated", userId, userName,
        `עודכנו: ${changes.join(", ")}`)
    }

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון ספק" }
  }
}

/* ── Write: Archive (soft delete) ──────────────────────────── */

export async function archiveSupplier(
  _tenantId: string,
  supplierId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    await db`
      UPDATE suppliers SET status = 'archived', updated_at = NOW()
      WHERE id = ${supplierId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
    `
    await insertActivity(tenantId, supplierId, "archived", userId, userName, "הספק הועבר לארכיון")
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בארכיון" }
  }
}

/* ── Write: Delete (permanent soft delete) ─────────────────── */

export async function deleteSupplier(
  _tenantId: string,
  supplierId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "delete")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    await db`
      UPDATE suppliers SET deleted_at = NOW()
      WHERE id = ${supplierId} AND tenant_id = ${tenantId}
    `
    await insertActivity(tenantId, supplierId, "status_changed", userId, userName, "הספק נמחק")
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

/* ── Write: Upload Document ────────────────────────────────── */

export async function uploadSupplierDocument(
  _tenantId: string,
  supplierId: string,
  file: { url: string; name: string; mime: string; size: number },
  docType: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string; docId?: string }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const [row] = await db`
      INSERT INTO supplier_documents
        (tenant_id, supplier_id, file_name, file_url, file_size_bytes, mime_type, doc_type, uploaded_by, uploaded_by_name)
      VALUES
        (${tenantId}, ${supplierId}, ${file.name}, ${file.url}, ${file.size}, ${file.mime}, ${docType}, ${userId}, ${userName})
      RETURNING id
    `
    await insertActivity(tenantId, supplierId, "document_uploaded", userId, userName,
      `מסמך "${file.name}" הועלה`, { file_name: file.name, doc_type: docType })
    return { success: true, docId: row.id as string }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהעלאה" }
  }
}

/* ── Write: Delete Document ────────────────────────────────── */

export async function deleteSupplierDocument(
  _tenantId: string,
  docId: string,
  _userId: string,
  _userName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "delete")
    const tenantId = actor.tenantId
    const userId = actor.userId
    const userName = actor.fullName

    const [doc] = await db`
      SELECT supplier_id, file_name FROM supplier_documents
      WHERE id = ${docId} AND tenant_id = ${tenantId}
    `
    if (!doc) return { success: false, error: "מסמך לא נמצא" }

    await db`DELETE FROM supplier_documents WHERE id = ${docId} AND tenant_id = ${tenantId}`

    await insertActivity(tenantId, doc.supplier_id as string, "document_deleted", userId, userName,
      `מסמך "${doc.file_name}" הוסר`)
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקה" }
  }
}

/* ── Read: User Name ───────────────────────────────────────── */

export async function getUserFullNameForSuppliers(
  tenantId: string,
  userId: string,
): Promise<string> {
  const [row] = await db`
    SELECT full_name FROM users WHERE id = ${userId} AND tenant_id = ${tenantId}
  `
  return (row?.full_name as string) ?? ""
}

/* ══════════════════════════════════════════════════════════════
   SUPPLIER TYPE CATEGORIES (lookup_items)
   ══════════════════════════════════════════════════════════════ */

interface SupplierTypeItem {
  id: string
  value: string
  label: string
  icon: string | null
  supplier_count: number
}

export async function getSupplierTypes(
  tenantId: string,
): Promise<SupplierTypeItem[]> {
  const rows = await db`
    SELECT
      li.id,
      li.value,
      li.label,
      li.icon,
      COUNT(s.id)::int AS supplier_count
    FROM lookup_items li
    LEFT JOIN suppliers s
      ON s.supplier_type = li.value
      AND s.tenant_id = li.tenant_id
      AND s.deleted_at IS NULL
    WHERE li.tenant_id = ${tenantId}
      AND li.category = 'supplier_type'
      AND li.is_active = TRUE
    GROUP BY li.id, li.value, li.label, li.icon
    ORDER BY li.sort_order, li.label
  `

  if (rows.length > 0) {
    return rows as unknown as SupplierTypeItem[]
  }

  // Fallback: return hardcoded defaults with zero counts
  return SUPPLIER_TYPE_OPTIONS.map((o) => ({
    id: o.value,
    value: o.value,
    label: o.label,
    icon: o.icon,
    supplier_count: 0,
  }))
}

export async function addSupplierType(
  _tenantId: string,
  label: string,
  _userId: string,
): Promise<{ success: boolean; error?: string; item?: LookupItem }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId

    if (!label.trim()) return { success: false, error: "חובה להזין שם תחום" }

    const value = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\u0590-\u05FF]/g, "")

    const [existing] = await db`
      SELECT id FROM lookup_items
      WHERE tenant_id = ${tenantId} AND category = 'supplier_type' AND (value = ${value} OR label = ${label.trim()})
    `
    if (existing) return { success: false, error: "תחום בשם זה כבר קיים" }

    const [maxRow] = await db`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
      FROM lookup_items
      WHERE tenant_id = ${tenantId} AND category = 'supplier_type'
    `

    const [item] = await db`
      INSERT INTO lookup_items (tenant_id, category, value, label, icon, is_active, sort_order, metadata)
      VALUES (${tenantId}, 'supplier_type', ${value}, ${label.trim()}, 'business', TRUE, ${maxRow.next_order}, '{}')
      RETURNING *
    `

    return { success: true, item: item as unknown as LookupItem }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת תחום" }
  }
}

export async function updateSupplierType(
  _tenantId: string,
  id: string,
  label: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "edit")
    const tenantId = actor.tenantId

    if (!label.trim()) return { success: false, error: "חובה להזין שם תחום" }

    await db`
      UPDATE lookup_items SET label = ${label.trim()}, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} AND category = 'supplier_type'
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון תחום" }
  }
}

export async function deleteSupplierType(
  _tenantId: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requirePermission("suppliers", "delete")
    const tenantId = actor.tenantId

    // Get the value first
    const [item] = await db`
      SELECT value FROM lookup_items
      WHERE id = ${id} AND tenant_id = ${tenantId} AND category = 'supplier_type'
    `
    if (!item) return { success: false, error: "תחום לא נמצא" }

    // Check if any supplier uses this type
    const [countRow] = await db`
      SELECT COUNT(*)::int AS cnt FROM suppliers
      WHERE tenant_id = ${tenantId} AND supplier_type = ${item.value} AND deleted_at IS NULL
    `
    if ((countRow.cnt as number) > 0) {
      return { success: false, error: "לא ניתן למחוק תחום המקושר לספקים" }
    }

    await db`
      DELETE FROM lookup_items
      WHERE id = ${id} AND tenant_id = ${tenantId} AND category = 'supplier_type'
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה במחיקת תחום" }
  }
}

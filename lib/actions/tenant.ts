"use server"

import { createServerSupabase } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import type { Role, ModulePermission } from "@/lib/permissions/constants"

export async function getTenantForUser(): Promise<{
  tenantId: string
  propertyId: string
  userId: string
  role: Role
  permissions: ModulePermission[]
} | null> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const rows = await db`
    SELECT u.tenant_id, u.role, p.id as property_id
    FROM users u
    LEFT JOIN properties p ON p.tenant_id = u.tenant_id AND p.is_active = true
    WHERE u.id = ${user.id}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const role = (rows[0].role as Role) || "receptionist"

  // Load permissions for receptionists and cleaners (both use user_permissions)
  let permissions: ModulePermission[] = []
  if (role === "receptionist" || role === "cleaner") {
    const perms = await db`
      SELECT module, can_view, can_edit, can_delete
      FROM user_permissions
      WHERE user_id = ${user.id} AND tenant_id = ${rows[0].tenant_id}
    `
    permissions = (perms as unknown as { module: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]).map((p) => ({
      module: p.module,
      canView: p.can_view,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
    }))
  }

  return {
    tenantId: rows[0].tenant_id,
    propertyId: rows[0].property_id,
    userId: user.id,
    role,
    permissions,
  }
}

"use server"

import { db } from "@/lib/db"
import { createAdminSupabase } from "@/lib/supabase/server"
import type { Role, ModulePermission } from "@/lib/permissions/constants"
import { DEFAULT_RECEPTIONIST, DEFAULT_CLEANER, MODULES } from "@/lib/permissions/constants"

/* ── Types ──────────────────────────────────────────────────── */

interface StaffMember {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
  invited_by: string | null
}

interface UserWithPermissions extends StaffMember {
  permissions: ModulePermission[]
}

/* ── Get Staff List ─────────────────────────────────────────── */

export async function getStaffList(tenantId: string): Promise<StaffMember[]> {
  const rows = await db`
    SELECT id, email, full_name, phone, role, is_active, last_login, created_at, invited_by
    FROM users
    WHERE tenant_id = ${tenantId}
    ORDER BY
      CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      full_name
  `
  return rows as unknown as StaffMember[]
}

/* ── Get User With Permissions ──────────────────────────────── */

export async function getUserWithPermissions(
  userId: string,
  tenantId: string
): Promise<UserWithPermissions | null> {
  const [user] = await db`
    SELECT id, email, full_name, phone, role, is_active, last_login, created_at, invited_by
    FROM users
    WHERE id = ${userId} AND tenant_id = ${tenantId}
  `
  if (!user) return null

  const perms = await db`
    SELECT module, can_view, can_edit, can_delete
    FROM user_permissions
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
  `

  return {
    ...(user as unknown as StaffMember),
    permissions: (perms as unknown as { module: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]).map((p) => ({
      module: p.module,
      canView: p.can_view,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
    })),
  }
}

/* ── Get Permissions for Current User ───────────────────────── */

export async function getMyPermissions(
  userId: string,
  tenantId: string
): Promise<{ role: Role; permissions: ModulePermission[] }> {
  const [user] = await db`
    SELECT role FROM users WHERE id = ${userId} AND tenant_id = ${tenantId}
  `
  if (!user) return { role: "receptionist", permissions: [] }

  const role = (user.role as Role) || "receptionist"

  if (role === "super_admin" || role === "admin") {
    return { role, permissions: [] }
  }

  const perms = await db`
    SELECT module, can_view, can_edit, can_delete
    FROM user_permissions
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
  `

  return {
    role,
    permissions: (perms as unknown as { module: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]).map((p) => ({
      module: p.module,
      canView: p.can_view,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
    })),
  }
}

/* ── Invite User ────────────────────────────────────────────── */

export async function inviteUser(
  tenantId: string,
  invitedById: string,
  data: {
    email: string
    fullName: string
    phone: string
    role: Role
    password: string
  }
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // Check if email already in use for this tenant
    const [existing] = await db`
      SELECT id FROM users WHERE tenant_id = ${tenantId} AND email = ${data.email}
    `
    if (existing) {
      return { success: false, error: "משתמש עם אימייל זה כבר קיים" }
    }

    // Create Supabase auth user
    const supabase = createAdminSupabase()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || "שגיאה ביצירת המשתמש" }
    }

    // Create user record
    await db`
      INSERT INTO users (id, tenant_id, email, full_name, phone, role, is_active, invited_by)
      VALUES (${authData.user.id}, ${tenantId}, ${data.email}, ${data.fullName},
        ${data.phone || ""}, ${data.role}, true, ${invitedById})
    `

    // Insert default permissions based on role
    const defaultPerms =
      data.role === "receptionist" ? DEFAULT_RECEPTIONIST :
      data.role === "cleaner"      ? DEFAULT_CLEANER :
      null

    if (defaultPerms) {
      for (const mod of MODULES) {
        const def = defaultPerms[mod.key] || { canView: false, canEdit: false, canDelete: false }
        await db`
          INSERT INTO user_permissions (tenant_id, user_id, module, can_view, can_edit, can_delete)
          VALUES (${tenantId}, ${authData.user.id}, ${mod.key}, ${def.canView}, ${def.canEdit}, ${def.canDelete})
        `
      }
    }

    return { success: true, userId: authData.user.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת המשתמש" }
  }
}

/* ── Update Role ────────────────────────────────────────────── */

export async function updateUserRole(
  userId: string,
  tenantId: string,
  newRole: Role
): Promise<{ success: boolean; error?: string }> {
  try {
    await db`
      UPDATE users SET role = ${newRole}, updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `

    // If changed to receptionist/cleaner and no permissions exist, insert defaults
    const defaultPerms =
      newRole === "receptionist" ? DEFAULT_RECEPTIONIST :
      newRole === "cleaner"      ? DEFAULT_CLEANER :
      null

    if (defaultPerms) {
      const [count] = await db`
        SELECT COUNT(*) as cnt FROM user_permissions
        WHERE user_id = ${userId} AND tenant_id = ${tenantId}
      `
      if (parseInt(count.cnt) === 0) {
        for (const mod of MODULES) {
          const def = defaultPerms[mod.key] || { canView: false, canEdit: false, canDelete: false }
          await db`
            INSERT INTO user_permissions (tenant_id, user_id, module, can_view, can_edit, can_delete)
            VALUES (${tenantId}, ${userId}, ${mod.key}, ${def.canView}, ${def.canEdit}, ${def.canDelete})
            ON CONFLICT (user_id, module) DO NOTHING
          `
        }
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון תפקיד" }
  }
}

/* ── Update Permissions ─────────────────────────────────────── */

export async function updateUserPermissions(
  userId: string,
  tenantId: string,
  permissions: ModulePermission[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const perm of permissions) {
      await db`
        INSERT INTO user_permissions (tenant_id, user_id, module, can_view, can_edit, can_delete)
        VALUES (${tenantId}, ${userId}, ${perm.module}, ${perm.canView}, ${perm.canEdit}, ${perm.canDelete})
        ON CONFLICT (user_id, module) DO UPDATE SET
          can_view = ${perm.canView},
          can_edit = ${perm.canEdit},
          can_delete = ${perm.canDelete},
          updated_at = NOW()
      `
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון הרשאות" }
  }
}

/* ── Toggle User Active ─────────────────────────────────────── */

export async function toggleUserActive(
  userId: string,
  tenantId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db`
      UPDATE users SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון סטטוס" }
  }
}

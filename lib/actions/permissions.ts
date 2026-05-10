"use server"

import { db } from "@/lib/db"
import { createAdminSupabase } from "@/lib/supabase/server"
import type { Role, ModulePermission } from "@/lib/permissions/constants"
import { DEFAULT_RECEPTIONIST, DEFAULT_CLEANER, MODULES, getDefaultPermissions } from "@/lib/permissions/constants"
import { requireActor } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { canManageRole } from "@/lib/permissions/check"
import crypto from "crypto"

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
    return { role, permissions: [] as ModulePermission[] }
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

/**
 * Generate a cryptographically strong temporary password.
 * The user is expected to reset it via "forgot password" on first login.
 */
function generateTempPassword(): string {
  // 24 random bytes -> 32-char base64, URL-safe
  return crypto.randomBytes(24).toString("base64url")
}

export async function inviteUser(
  // tenantId / invitedById are IGNORED — derived from server session.
  // Kept in signature for backwards compatibility with existing UI calls.
  _tenantId: string,
  _invitedById: string,
  data: {
    email: string
    fullName: string
    phone: string
    role: Role
    // password field is now IGNORED — server generates a temp password.
    // Kept in signature for backwards compatibility.
    password?: string
  }
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // ── AUTHORIZATION ────────────────────────────────────────
    // Caller must be authenticated, and caller must be allowed to
    // assign the requested target role.
    const actor = await requireActor()
    if (!canManageRole(actor.role, data.role)) {
      throw new AuthorizationError("אין הרשאה ליצור משתמש בתפקיד זה")
    }

    const tenantId = actor.tenantId
    const invitedById = actor.userId

    // Check if email already in use for this tenant
    const [existing] = await db`
      SELECT id FROM users WHERE tenant_id = ${tenantId} AND email = ${data.email}
    `
    if (existing) {
      return { success: false, error: "משתמש עם אימייל זה כבר קיים" }
    }

    // Server-generated temp password — never accept from client.
    const tempPassword = generateTempPassword()

    // Create Supabase auth user
    const supabase = createAdminSupabase()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
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
    const defaultPerms = getDefaultPermissions(data.role)

    if (defaultPerms) {
      for (const mod of MODULES) {
        const def = defaultPerms[mod.key] || { canView: false, canEdit: false, canDelete: false }
        await db`
          INSERT INTO user_permissions (tenant_id, user_id, module, can_view, can_edit, can_delete)
          VALUES (${tenantId}, ${authData.user.id}, ${mod.key}, ${def.canView}, ${def.canEdit}, ${def.canDelete})
        `
      }
    }

    // Trigger password reset email so the new user sets their own password.
    // This avoids any plaintext password ever being held by the inviter.
    try {
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
      })
    } catch {
      // Non-fatal: account is created, user can use forgot-password manually.
    }

    return { success: true, userId: authData.user.id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה ביצירת המשתמש" }
  }
}

/* ── Update Role ────────────────────────────────────────────── */

export async function updateUserRole(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  newRole: Role
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── AUTHORIZATION ────────────────────────────────────────
    const actor = await requireActor()
    const tenantId = actor.tenantId

    // Look up the target's CURRENT role (server side, not from client).
    const [target] = await db`
      SELECT id, role FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "משתמש לא נמצא" }

    const targetCurrentRole = (target.role as Role) ?? "receptionist"

    // Caller cannot change THEIR OWN role (no self-promotion).
    if (target.id === actor.userId) {
      throw new AuthorizationError("לא ניתן לשנות את התפקיד של עצמך")
    }

    // Caller must be able to manage BOTH the current role AND the new role.
    if (!canManageRole(actor.role, targetCurrentRole)) {
      throw new AuthorizationError("אין הרשאה לנהל את התפקיד הנוכחי של המשתמש")
    }
    if (!canManageRole(actor.role, newRole)) {
      throw new AuthorizationError("אין הרשאה להעניק את התפקיד המבוקש")
    }

    await db`
      UPDATE users SET role = ${newRole}, updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `

    // If changed to receptionist/cleaner and no permissions exist, insert defaults
    const defaultPerms = getDefaultPermissions(newRole)

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
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון תפקיד" }
  }
}

/* ── Update Permissions ─────────────────────────────────────── */

export async function updateUserPermissions(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  permissions: ModulePermission[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── AUTHORIZATION ────────────────────────────────────────
    const actor = await requireActor()
    const tenantId = actor.tenantId

    // Look up the target's role (server side).
    const [target] = await db`
      SELECT id, role FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "משתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"

    // No one can edit super_admin permissions through this path.
    if (targetRole === "super_admin") {
      throw new AuthorizationError("לא ניתן לערוך הרשאות של סופר אדמין")
    }

    // Caller must be able to manage the target's role.
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לערוך הרשאות של משתמש זה")
    }

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
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון הרשאות" }
  }
}

/* ── Toggle User Active ─────────────────────────────────────── */

export async function toggleUserActive(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── AUTHORIZATION ────────────────────────────────────────
    const actor = await requireActor()
    const tenantId = actor.tenantId

    // Look up target role (server side).
    const [target] = await db`
      SELECT id, role FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "משתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"

    // No one can deactivate themselves (lockout protection).
    if (target.id === actor.userId) {
      throw new AuthorizationError("לא ניתן להשבית את עצמך")
    }
    // No one can deactivate super_admin via this action.
    if (targetRole === "super_admin") {
      throw new AuthorizationError("לא ניתן לשנות סטטוס של סופר אדמין")
    }
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לשנות סטטוס של משתמש זה")
    }

    await db`
      UPDATE users SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בעדכון סטטוס" }
  }
}

"use server"

import { db } from "@/lib/db"
import { createAdminSupabase } from "@/lib/supabase/server"
import type { Role, ModulePermission } from "@/lib/permissions/constants"
import { DEFAULT_RECEPTIONIST, DEFAULT_CLEANER, MODULES, getDefaultPermissions } from "@/lib/permissions/constants"
import { requireActor } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { canManageRole } from "@/lib/permissions/check"
import { sendCredentialsEmail } from "@/lib/services/email"
import crypto from "crypto"

/* ── Types ──────────────────────────────────────────────────── */

interface StaffMember {
  id: string
  email: string
  username: string | null
  full_name: string
  phone: string
  role: string
  is_active: boolean
  allow_google_auth: boolean
  can_assign_maintenance: boolean
  last_login: string | null
  created_at: string
  invited_by: string | null
}

interface UserWithPermissions extends StaffMember {
  permissions: ModulePermission[]
}

/* ── Get Staff List ─────────────────────────────────────────── */

export async function getStaffList(_tenantId: string): Promise<StaffMember[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const rows = await db`
    SELECT id, email, username, full_name, phone, role, is_active,
           allow_google_auth, can_assign_maintenance,
           last_login, created_at, invited_by
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
  _tenantId: string
): Promise<UserWithPermissions | null> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const [user] = await db`
    SELECT id, email, username, full_name, phone, role, is_active,
           allow_google_auth, can_assign_maintenance,
           last_login, created_at, invited_by
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
  _userId: string,
  _tenantId: string
): Promise<{ role: Role; permissions: ModulePermission[] }> {
  const actor = await requireActor()
  const userId = actor.userId
  const tenantId = actor.tenantId
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
    password: string
    username?: string | null
    allowGoogleAuth?: boolean
    sendCredentials?: boolean
  }
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const actor = await requireActor()
    if (!canManageRole(actor.role, data.role)) {
      throw new AuthorizationError("אין הרשאה ליצור משתמש בתפקיד זה")
    }

    const tenantId = actor.tenantId
    const invitedById = actor.userId

    const realEmail = data.email?.trim() || null
    const cleanedUsername = data.username?.trim() || null

    /* Server-side guard: at least one identifier. If no real email, the user
     * must have a username so they can log in. */
    if (!realEmail && !cleanedUsername) {
      return { success: false, error: "נדרש אימייל או שם משתמש" }
    }
    /* Synthetic email keeps the auth.users + public.users NOT NULL constraint
     * satisfied for users created without a real address (cleaners with no
     * inbox). Domain is reserved and unroutable. */
    const effectiveEmail =
      realEmail ?? `${cleanedUsername}-${Date.now()}@no-email.local`

    if (realEmail) {
      const [existingByEmail] = await db`
        SELECT id FROM users WHERE tenant_id = ${tenantId} AND email = ${realEmail}
      `
      if (existingByEmail) {
        return { success: false, error: "משתמש עם אימייל זה כבר קיים" }
      }
    }

    if (cleanedUsername) {
      const [existingByUsername] = await db`
        SELECT id FROM users
        WHERE tenant_id = ${tenantId}
          AND lower(username) = ${cleanedUsername.toLowerCase()}
      `
      if (existingByUsername) {
        return { success: false, error: "שם המשתמש כבר תפוס" }
      }
    }

    const manualPassword = data.password?.trim() || ""
    if (manualPassword && manualPassword.length < 8) {
      return { success: false, error: "סיסמה חייבת להכיל לפחות 8 תווים" }
    }
    const password = manualPassword || generateTempPassword()

    const supabase = createAdminSupabase()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: effectiveEmail,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || "שגיאה ביצירת המשתמש" }
    }

    await db`
      INSERT INTO users (
        id, tenant_id, email, username, full_name, phone,
        role, is_active, allow_google_auth, invited_by
      )
      VALUES (
        ${authData.user.id}, ${tenantId}, ${effectiveEmail}, ${cleanedUsername},
        ${data.fullName}, ${data.phone || ""}, ${data.role}, true,
        ${data.allowGoogleAuth ?? false}, ${invitedById}
      )
    `

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

    /* Only attempt delivery to a real address. Synthetic @no-email.local
     * addresses are unroutable and would just bounce. */
    if (data.sendCredentials && realEmail) {
      // Non-fatal: account is created even if email delivery fails.
      await sendCredentialsEmail({
        to: realEmail,
        fullName: data.fullName,
        username: cleanedUsername,
        password,
      })
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

    // When deactivating a cleaning-role user, release their active
    // housekeeping tasks back to the unassigned pool so another cleaner
    // can be assigned. Done before the users UPDATE so the actor's last
    // observed state can't leave dangling assignments on a deactivated user.
    if (!isActive && targetRole === "cleaner") {
      await db`
        UPDATE housekeeping_tasks
        SET assigned_to = NULL, updated_at = NOW()
        WHERE assigned_to = ${userId}
          AND tenant_id = ${tenantId}
          AND status IN ('pending', 'in_progress')
      `
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

/* ── Delete Employee ────────────────────────────────────────── */

/**
 * Soft-delete an employee. Why soft and not hard:
 * - Other tables (reservations, tasks, hours, audit logs) FK to users with
 *   NO CASCADE, so a hard DELETE would either fail or orphan historical data.
 *
 * What happens:
 * 1. is_active flipped to false.
 * 2. username cleared (frees the per-tenant unique index for reuse).
 * 3. email suffixed with "_deleted_<unix>" (frees the unique index).
 * 4. The Supabase auth.users record is hard-deleted — this revokes any open
 *    sessions and prevents future logins via password or Google.
 */
export async function deleteEmployee(
  userId: string,
  _tenantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [target] = await db`
      SELECT id, role, email, username FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "המשתמש לא נמצא" }

    if (target.id === actor.userId) {
      throw new AuthorizationError("לא ניתן למחוק את עצמך")
    }

    const targetRole = (target.role as Role) ?? "receptionist"
    if (targetRole === "super_admin") {
      throw new AuthorizationError("לא ניתן למחוק סופר אדמין")
    }
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה למחוק משתמש זה")
    }

    const stamp = Date.now()
    const suffixedEmail = `${target.email}_deleted_${stamp}`

    await db`
      UPDATE users
      SET is_active = false,
          username = NULL,
          email = ${suffixedEmail},
          updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `

    // Best-effort: revoke auth so the user is locked out immediately. We
    // don't fail the whole operation if Supabase returns an error here —
    // the DB row is already deactivated and emails freed.
    const supabase = createAdminSupabase()
    await supabase.auth.admin.deleteUser(userId).catch(() => {})

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה במחיקת המשתמש",
    }
  }
}

/* ── Update Auth Settings (username + Google flag) ──────────── */

export async function updateUserAuthSettings(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  data: {
    username?: string | null
    allowGoogleAuth?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [target] = await db`
      SELECT id, role FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "משתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לעדכן הגדרות התחברות של משתמש זה")
    }

    const cleaned =
      data.username === undefined ? undefined : data.username?.trim() || null

    if (cleaned !== undefined && cleaned !== null) {
      const [conflict] = await db`
        SELECT id FROM users
        WHERE tenant_id = ${tenantId}
          AND id <> ${userId}
          AND lower(username) = ${cleaned.toLowerCase()}
      `
      if (conflict) {
        return { success: false, error: "שם המשתמש כבר תפוס" }
      }
    }

    if (cleaned !== undefined && data.allowGoogleAuth !== undefined) {
      await db`
        UPDATE users
        SET username = ${cleaned},
            allow_google_auth = ${data.allowGoogleAuth},
            updated_at = NOW()
        WHERE id = ${userId} AND tenant_id = ${tenantId}
      `
    } else if (cleaned !== undefined) {
      await db`
        UPDATE users
        SET username = ${cleaned}, updated_at = NOW()
        WHERE id = ${userId} AND tenant_id = ${tenantId}
      `
    } else if (data.allowGoogleAuth !== undefined) {
      await db`
        UPDATE users
        SET allow_google_auth = ${data.allowGoogleAuth}, updated_at = NOW()
        WHERE id = ${userId} AND tenant_id = ${tenantId}
      `
    }

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון הגדרות התחברות",
    }
  }
}

/* ── Reset Password (admin) ──────────────────────────────────── */

export async function resetUserPassword(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  newPassword: string,
  options?: { sendEmail?: boolean }
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "סיסמה חייבת להכיל לפחות 8 תווים" }
  }

  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [target] = await db`
      SELECT id, role, email, username, full_name
      FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "המשתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לאפס סיסמה של משתמש זה")
    }

    const supabase = createAdminSupabase()
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )
    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await db`
      UPDATE users SET updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `

    if (options?.sendEmail) {
      await sendCredentialsEmail({
        to: target.email as string,
        fullName: target.full_name as string,
        username: target.username as string | null,
        password: newPassword,
      })
    }

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה באיפוס הסיסמה",
    }
  }
}

/* ── Resend Credentials Email (magic link) ──────────────────── */

export async function resendCredentialsToUser(
  userId: string,
  // tenantId IGNORED — derived from server session.
  _tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [target] = await db`
      SELECT id, role, email FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "המשתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לשלוח קישור התחברות למשתמש זה")
    }

    const supabase = createAdminSupabase()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const { error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: target.email as string,
      options: {
        redirectTo: `${appUrl}/auth/callback?type=recovery`,
      },
    })

    if (linkError) {
      return { success: false, error: linkError.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בשליחת הקישור",
    }
  }
}

/* ── Toggle Maintenance Assign Capability ───────────────────── */

export async function updateUserCanAssignMaintenance(
  userId: string,
  _tenantId: string,
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [target] = await db`
      SELECT id, role FROM users
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    if (!target) return { success: false, error: "משתמש לא נמצא" }

    const targetRole = (target.role as Role) ?? "receptionist"
    if (targetRole === "super_admin" || targetRole === "admin") {
      return {
        success: false,
        error: "אדמין וסופר־אדמין מקבלים את ההרשאה הזו אוטומטית",
      }
    }
    if (!canManageRole(actor.role, targetRole)) {
      throw new AuthorizationError("אין הרשאה לעדכן משתמש זה")
    }

    await db`
      UPDATE users
      SET can_assign_maintenance = ${value}, updated_at = NOW()
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון ההרשאה",
    }
  }
}

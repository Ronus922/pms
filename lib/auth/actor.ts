"use server"

/**
 * ──────────────────────────────────────────────────────────────────
 * Server-side actor helper — single source of truth for who is
 * calling a server action and what they are allowed to do.
 *
 * NEVER trust userId / role / tenantId passed from the client.
 * ALWAYS derive them from the Supabase session via this helper.
 * ──────────────────────────────────────────────────────────────────
 */

import { db } from "@/lib/db"
import { createServerSupabase } from "@/lib/supabase/server"
import { hasPermission, canManageRole } from "@/lib/permissions/check"
import { AuthorizationError } from "@/lib/auth/errors"
import type { Role, Action, ModulePermission } from "@/lib/permissions/constants"

export interface Actor {
  userId: string
  tenantId: string
  fullName: string
  role: Role
  permissions: ModulePermission[]
  isAuthenticated: true
}

/**
 * Get the current actor from the Supabase session.
 * Returns null if not authenticated.
 */
export async function getCurrentActor(): Promise<Actor | null> {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const [row] = await db`
      SELECT id, tenant_id, full_name, role, is_active
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `
    if (!row) return null
    if (row.is_active === false) return null

    const role = (row.role as Role) || "receptionist"
    let permissions: ModulePermission[] = []

    if (role !== "super_admin" && role !== "admin") {
      const perms = await db`
        SELECT module, can_view, can_edit, can_delete
        FROM user_permissions
        WHERE user_id = ${row.id} AND tenant_id = ${row.tenant_id}
      `
      permissions = (perms as unknown as { module: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]).map((p) => ({
        module: p.module,
        canView: p.can_view,
        canEdit: p.can_edit,
        canDelete: p.can_delete,
      }))
    }

    return {
      userId: row.id as string,
      tenantId: row.tenant_id as string,
      fullName: (row.full_name as string) ?? "",
      role,
      permissions,
      isAuthenticated: true,
    }
  } catch {
    return null
  }
}

/**
 * Require an authenticated actor. Throws AuthorizationError if not.
 * Use at the very top of every mutation server action.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor()
  if (!actor) throw new AuthorizationError("לא מחובר")
  return actor
}

/**
 * Require an authenticated actor with a specific permission.
 * Throws AuthorizationError if not authorized.
 *
 * Example:
 *   const actor = await requirePermission("suppliers", "edit")
 */
export async function requirePermission(
  module: string,
  action: Action,
): Promise<Actor> {
  const actor = await requireActor()
  if (!hasPermission(actor.role, actor.permissions, module, action)) {
    throw new AuthorizationError(`אין הרשאה לבצע פעולה זו במודול ${module}`)
  }
  return actor
}

/**
 * Require super_admin role specifically.
 * Used for system-level modules like automations.
 */
export async function requireSuperAdmin(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== "super_admin") {
    throw new AuthorizationError("פעולה זו זמינה לסופר אדמין בלבד")
  }
  return actor
}

/**
 * Require admin or super_admin role.
 * Used for modules like settings, permissions.
 */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AuthorizationError("פעולה זו זמינה למנהלים בלבד")
  }
  return actor
}

/**
 * Require that the actor can manage another user's role.
 * Used in updateUserRole / updateUserPermissions.
 */
export async function requireCanManageRole(targetRole: Role): Promise<Actor> {
  const actor = await requireActor()
  if (!canManageRole(actor.role, targetRole)) {
    throw new AuthorizationError("אין הרשאה לנהל תפקיד זה")
  }
  return actor
}

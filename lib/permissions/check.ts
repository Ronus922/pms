import type { Role, Action, ModulePermission } from "./constants"
import { SUPER_ADMIN_ONLY, ADMIN_ONLY } from "./constants"

/**
 * Check if a user with a given role and permissions can perform an action on a module.
 * - super_admin: full access (everything)
 * - admin: full operational access (except SUPER_ADMIN_ONLY modules)
 * - receptionist: check user_permissions table
 */
export function hasPermission(
  role: Role,
  permissions: ModulePermission[],
  module: string,
  action: Action
): boolean {
  // super_admin can do everything
  if (role === "super_admin") return true

  // admin can do everything except super_admin-only modules
  if (role === "admin") {
    return !SUPER_ADMIN_ONLY.includes(module)
  }

  // receptionist: check per-module permissions
  const perm = permissions.find((p) => p.module === module)
  if (!perm) return false

  switch (action) {
    case "view":
      return perm.canView
    case "edit":
      return perm.canEdit
    case "delete":
      return perm.canDelete
    default:
      return false
  }
}

/**
 * Check if a role can manage (assign/change) another role.
 * super_admin can manage all. admin can manage receptionist only.
 */
export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  if (managerRole === "super_admin") return true
  if (managerRole === "admin" && targetRole === "receptionist") return true
  return false
}

/**
 * Check if a module is visible in sidebar for a given role + permissions.
 */
export function canViewModule(
  role: Role,
  permissions: ModulePermission[],
  module: string
): boolean {
  return hasPermission(role, permissions, module, "view")
}

/**
 * Get the list of modules a user cannot access at all (for filtering sidebar).
 */
export function getHiddenModules(
  role: Role,
  permissions: ModulePermission[]
): string[] {
  if (role === "super_admin") return []
  if (role === "admin") return [...SUPER_ADMIN_ONLY]

  const { MODULES } = require("./constants")
  return (MODULES as { key: string }[])
    .filter((m) => !hasPermission(role, permissions, m.key, "view"))
    .map((m) => m.key)
}

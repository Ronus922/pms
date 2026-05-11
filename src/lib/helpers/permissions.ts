// ============================================================
// Permission checking helpers (server-side)
// ============================================================

/**
 * Build a permission key from module + action.
 * @example getPermissionKey('tasks', 'edit') => 'tasks:edit'
 */
export function getPermissionKey(module: string, action: string): string {
  return `${module}:${action}`
}

/**
 * Check if user has a specific module:action permission.
 */
export function hasPermission(
  userPermissions: string[],
  module: string,
  action: string,
): boolean {
  const key = getPermissionKey(module, action)
  return userPermissions.includes(key) || userPermissions.includes(`${module}:manage`)
}

/**
 * Check if user has at least one of the listed permissions.
 */
export function hasAnyPermission(
  userPermissions: string[],
  permissions: string[],
): boolean {
  return permissions.some((p) => userPermissions.includes(p))
}

/**
 * Check if user has ALL listed permissions.
 */
export function hasAllPermissions(
  userPermissions: string[],
  permissions: string[],
): boolean {
  return permissions.every((p) => userPermissions.includes(p))
}

/**
 * Filter a list of items that have an optional `permission` field,
 * keeping only those the user is allowed to see.
 * Items without a `permission` field pass through.
 */
export function filterByPermission<T extends { permission?: string }>(
  items: T[],
  userPermissions: string[],
): T[] {
  return items.filter(
    (item) => !item.permission || userPermissions.includes(item.permission),
  )
}

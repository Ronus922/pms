// ============================================================
// Permission module constants & role hierarchy
// ============================================================

import type { UserRole, PermissionAction } from '../types'

// ── Module Permission Strings ───────────────────────────────

type ModulePermissions = Record<PermissionAction, string>

function buildModule(name: string): ModulePermissions {
  return {
    view: `${name}:view`,
    create: `${name}:create`,
    edit: `${name}:edit`,
    delete: `${name}:delete`,
    export: `${name}:export`,
    manage: `${name}:manage`,
  } as const
}

export const MODULES = {
  users: buildModule('users'),
  tasks: buildModule('tasks'),
  files: buildModule('files'),
  categories: buildModule('categories'),
  tags: buildModule('tags'),
  settings: buildModule('settings'),
  notifications: buildModule('notifications'),
  audit: buildModule('audit'),
  reports: buildModule('reports'),
  lookups: buildModule('lookups'),
} as const

// ── Role Hierarchy ──────────────────────────────────────────

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  staff: 40,
  viewer: 20,
} as const

// ── Helpers ─────────────────────────────────────────────────

/**
 * Check if a role meets or exceeds the minimum required level.
 */
export function isRoleAtLeast(
  role: UserRole,
  minimumRole: UserRole,
): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole]
}

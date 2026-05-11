// ============================================================
// Auth & Permission types
// ============================================================

import type { BaseEntity, SoftDelete } from './common'

// ── Roles & Permissions ─────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'viewer'

export type PermissionScope = 'all' | 'own' | 'department' | 'assigned'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'manage'

// ── User ────────────────────────────────────────────────────

export type UserStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending_verification'

export type User = BaseEntity & {
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role_id: string | null
  department: string | null
  status: UserStatus
  language: string
  timezone: string
  last_login_at: string | null
} & SoftDelete

// ── Role ────────────────────────────────────────────────────

export type Role = BaseEntity & {
  name: string
  label: string
  description: string | null
  level: number
  is_system: boolean
  color: string | null
}

// ── Permission ──────────────────────────────────────────────

export type Permission = {
  id: string
  module: string
  action: string
  label: string
  created_at: string
}

export type PermissionCheck = {
  allowed: boolean
  scope: PermissionScope
}

// ── Session ─────────────────────────────────────────────────

export type AuthSession = {
  user: User
  role: Role
  permissions: string[]
}

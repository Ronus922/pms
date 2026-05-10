'use server'

// ============================================================
// Auth service — wraps Supabase Auth for server-side use
// ============================================================

import { createServerClient, createAdminClient } from './supabase'
import type { User, AuthSession, PermissionCheck } from '../types/auth'
import type { ActionResult } from '../types/common'

/**
 * Get the currently authenticated Supabase user.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch the full user profile from the users table
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile ?? null
}

/**
 * Get the full auth session: user, role, and flattened permissions array.
 * Returns null if not authenticated.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('users')
    .select('*, role:roles(*)')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Fetch permissions for this role
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', profile.role_id)

  const permissions: string[] = (rolePermissions ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rp: Record<string, any>) => {
      const p = rp.permissions
      return `${p.module}:${p.action}`
    },
  )

  return {
    user: profile,
    role: profile.role,
    permissions,
  }
}

/**
 * Sign in with email and password.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: undefined }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
}

/**
 * Check whether a user has a specific permission.
 * Returns `{ allowed, scope }`.
 */
export async function checkPermission(
  userId: string,
  module: string,
  action: string,
): Promise<PermissionCheck> {
  const admin = createAdminClient()

  // Get the user's role
  const { data: user } = await admin
    .from('users')
    .select('role_id')
    .eq('id', userId)
    .single()

  if (!user?.role_id) {
    return { allowed: false, scope: 'own' }
  }

  // Check if this role has the requested permission
  const { data: permission } = await admin
    .from('role_permissions')
    .select('scope, permissions!inner(module, action)')
    .eq('role_id', user.role_id)
    .eq('permissions.module', module)
    .eq('permissions.action', action)
    .single()

  if (!permission) {
    // Check for "manage" wildcard on the module
    const { data: managePermission } = await admin
      .from('role_permissions')
      .select('scope, permissions!inner(module, action)')
      .eq('role_id', user.role_id)
      .eq('permissions.module', module)
      .eq('permissions.action', 'manage')
      .single()

    if (!managePermission) {
      return { allowed: false, scope: 'own' }
    }

    return {
      allowed: true,
      scope: (managePermission.scope as PermissionCheck['scope']) ?? 'all',
    }
  }

  return {
    allowed: true,
    scope: (permission.scope as PermissionCheck['scope']) ?? 'all',
  }
}

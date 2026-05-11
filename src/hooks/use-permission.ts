'use client'

import { useMemo } from 'react'
// TODO: Replace with your actual auth context import
// import { useAuth } from '@/contexts/auth-context'

/**
 * Placeholder hook — in production, replace with your AuthContext
 * that exposes `session: AuthSession | null`.
 */
function useAuthSession(): { permissions: string[] } | null {
  // TODO: Wire up to real auth context
  // const { session } = useAuth()
  // return session
  return null
}

// ── Permission format: "module:action" ─────────────────────

function hasPermission(
  permissions: string[],
  module: string,
  action: string,
): boolean {
  const key = `${module}:${action}`
  return (
    permissions.includes(key) ||
    permissions.includes(`${module}:manage`) ||
    permissions.includes('*:*')
  )
}

/**
 * Check whether the current user has a specific permission.
 * Returns false if no session is available.
 */
export function usePermission(module: string, action: string): boolean {
  const session = useAuthSession()

  return useMemo(() => {
    if (!session) return false
    return hasPermission(session.permissions, module, action)
  }, [session, module, action])
}

/** Shorthand — can the user view this module? */
export function useCanView(module: string): boolean {
  return usePermission(module, 'view')
}

/** Shorthand — can the user edit in this module? */
export function useCanEdit(module: string): boolean {
  return usePermission(module, 'edit')
}

/** Shorthand — can the user create in this module? */
export function useCanCreate(module: string): boolean {
  return usePermission(module, 'create')
}

/** Shorthand — can the user delete in this module? */
export function useCanDelete(module: string): boolean {
  return usePermission(module, 'delete')
}

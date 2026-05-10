'use server'

// ============================================================
// Audit log service — tracks who did what, when
// ============================================================

import { createAdminClient } from './supabase'

// ── Types ──────────────────────────────────────────────────

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'permission_change'
  | 'status_change'

type ChangeEntry = {
  old: unknown
  new: unknown
}

type AuditLogParams = {
  userId: string | null
  action: AuditActionType
  entityType: string
  entityId?: string
  changes?: Record<string, ChangeEntry>
  metadata?: Record<string, unknown>
}

// ── Service ────────────────────────────────────────────────

/**
 * Write an audit log entry to the `audit_logs` table.
 * Uses the admin client (service role) to bypass RLS.
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const { userId, action, entityType, entityId, changes, metadata } = params

  const admin = createAdminClient()

  const { error } = await admin.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    changes: changes ?? null,
    metadata: metadata ?? null,
    created_at: new Date().toISOString(),
  })

  if (error) {
    // Log but don't throw — audit failures should not break the main operation
    // TODO: Replace with your error reporting service (Sentry, etc.)
    // eslint-disable-next-line no-console
    console.error('[audit] Failed to create audit log:', error.message)
  }
}

/**
 * Compare an original object with an updated partial and return
 * only the fields that actually changed.
 *
 * @example
 * ```ts
 * const changes = buildChanges(
 *   { name: 'old', status: 'active' },
 *   { name: 'new', status: 'active' },
 * )
 * // => { name: { old: 'old', new: 'new' } }
 * ```
 */
export function buildChanges<T extends Record<string, unknown>>(
  original: T,
  updated: Partial<T>,
): Record<string, ChangeEntry> {
  const changes: Record<string, ChangeEntry> = {}

  for (const key of Object.keys(updated) as Array<keyof T & string>) {
    const oldVal = original[key]
    const newVal = updated[key]

    // Simple deep-ish comparison via JSON serialisation
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal }
    }
  }

  return changes
}

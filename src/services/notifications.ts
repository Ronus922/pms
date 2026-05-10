'use server'

// ============================================================
// Notification service — in-app notifications
// ============================================================

import { createAdminClient, createServerClient } from './supabase'

// ── Types ──────────────────────────────────────────────────

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'task'
  | 'reminder'
  | 'system'

type NotificationParams = {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  entityType?: string
  entityId?: string
}

// ── Service ────────────────────────────────────────────────

/**
 * Create a single notification for a user.
 */
export async function createNotification(params: NotificationParams): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[notifications] Failed to create notification:', error.message)
  }
}

/**
 * Send the same notification to multiple users at once.
 */
export async function notifyUsers(
  userIds: string[],
  notification: Omit<NotificationParams, 'userId'>,
): Promise<void> {
  if (userIds.length === 0) return

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
    entity_type: notification.entityType ?? null,
    entity_id: notification.entityId ?? null,
    is_read: false,
    created_at: now,
  }))

  const { error } = await admin.from('notifications').insert(rows)

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[notifications] Failed to notify users:', error.message)
  }
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = await createServerClient()

  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const admin = createAdminClient()

  await admin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const admin = createAdminClient()

  const { count } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  return count ?? 0
}

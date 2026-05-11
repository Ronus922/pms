// ============================================================
// Notification helpers — icons, colors, grouping
// ============================================================

import type { Notification, NotificationType } from '../../types/entities'
import { formatRelativeTime, isToday } from './date'

// ── Icon mapping (Lucide icon names) ───────────────────────

const ICON_MAP: Record<NotificationType, string> = {
  info: 'Info',
  warning: 'AlertTriangle',
  error: 'AlertCircle',
  success: 'CheckCircle2',
  reminder: 'Bell',
}

export function getNotificationIcon(type: NotificationType): string {
  return ICON_MAP[type] ?? 'Bell'
}

// ── Color mapping (Tailwind classes) ───────────────────────

type NotificationColor = { bg: string; text: string; border: string }

const COLOR_MAP: Record<NotificationType, NotificationColor> = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  reminder: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
}

export function getNotificationColor(type: NotificationType): NotificationColor {
  return COLOR_MAP[type] ?? COLOR_MAP.info
}

// ── Time formatting ────────────────────────────────────────

export function formatNotificationTime(createdAt: string): string {
  return formatRelativeTime(createdAt)
}

// ── Grouping ───────────────────────────────────────────────

/**
 * Group notifications into today / yesterday / older buckets.
 */
export function groupNotifications(notifications: Notification[]): {
  today: Notification[]
  yesterday: Notification[]
  older: Notification[]
} {
  const today: Notification[] = []
  const yesterday: Notification[] = []
  const older: Notification[] = []

  const now = new Date()
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)

  for (const n of notifications) {
    if (isToday(n.created_at)) {
      today.push(n)
    } else {
      const d = new Date(n.created_at)
      if (
        d.getDate() === yesterdayDate.getDate() &&
        d.getMonth() === yesterdayDate.getMonth() &&
        d.getFullYear() === yesterdayDate.getFullYear()
      ) {
        yesterday.push(n)
      } else {
        older.push(n)
      }
    }
  }

  return { today, yesterday, older }
}

// ── Badge helpers ──────────────────────────────────────────

export function shouldShowBadge(unreadCount: number): boolean {
  return unreadCount > 0
}

export function formatBadgeCount(count: number): string {
  if (count <= 0) return ''
  if (count > 99) return '99+'
  return String(count)
}

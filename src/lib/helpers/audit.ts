// ============================================================
// Audit log helpers — labels, icons, change formatting
// ============================================================

import type { AuditActionType, AuditLog } from '../../types/entities'
import { formatDate } from './date'

// ── Hebrew labels ──────────────────────────────────────────

const ACTION_LABELS: Record<AuditActionType, string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
  restore: 'שחזור',
  login: 'התחברות',
  logout: 'התנתקות',
  export: 'ייצוא',
  import: 'ייבוא',
  status_change: 'שינוי סטטוס',
}

export function getAuditActionLabel(action: AuditActionType): string {
  return ACTION_LABELS[action] ?? action
}

// ── Lucide icon names ──────────────────────────────────────

const ACTION_ICONS: Record<AuditActionType, string> = {
  create: 'Plus',
  update: 'Pencil',
  delete: 'Trash2',
  restore: 'RotateCcw',
  login: 'LogIn',
  logout: 'LogOut',
  export: 'Download',
  import: 'Upload',
  status_change: 'ArrowRightLeft',
}

export function getAuditActionIcon(action: AuditActionType): string {
  return ACTION_ICONS[action] ?? 'Activity'
}

// ── Tailwind color classes ─────────────────────────────────

const ACTION_COLORS: Record<AuditActionType, string> = {
  create: 'text-emerald-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
  restore: 'text-amber-600',
  login: 'text-indigo-600',
  logout: 'text-slate-500',
  export: 'text-violet-600',
  import: 'text-teal-600',
  status_change: 'text-orange-600',
}

export function getAuditActionColor(action: AuditActionType): string {
  return ACTION_COLORS[action] ?? 'text-slate-600'
}

// ── Change diff formatting ─────────────────────────────────

/**
 * Convert raw change records { field: { old, new } } into display rows.
 */
export function formatAuditChanges(
  changes: Record<string, { old: unknown; new: unknown }>,
): { field: string; oldValue: string; newValue: string }[] {
  return Object.entries(changes).map(([field, diff]) => ({
    field,
    oldValue: formatChangeValue(diff.old),
    newValue: formatChangeValue(diff.new),
  }))
}

function formatChangeValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'כן' : 'לא'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// ── Timeline grouping (by date) ────────────────────────────

/**
 * Group audit logs by calendar date for timeline display.
 */
export function formatAuditTimeline(
  logs: AuditLog[],
): { date: string; logs: AuditLog[] }[] {
  const groups = new Map<string, AuditLog[]>()

  for (const log of logs) {
    const dateKey = formatDate(log.created_at)
    const existing = groups.get(dateKey)
    if (existing) {
      existing.push(log)
    } else {
      groups.set(dateKey, [log])
    }
  }

  return Array.from(groups.entries()).map(([date, groupLogs]) => ({
    date,
    logs: groupLogs,
  }))
}

// ============================================================
// Status maps — Hebrew labels + Sapphire palette colors
// ============================================================

import type { TaskStatus, TaskPriority, UserStatus } from '../types'

type StatusStyle = {
  label: string
  color: string
  borderColor: string
  bgColor: string
  textColor: string
}

// ── Task Status ─────────────────────────────────────────────

export const TASK_STATUS_MAP: Record<TaskStatus, StatusStyle> = {
  pending: {
    label: 'ממתין',
    color: 'bg-slate-400',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  in_progress: {
    label: 'בביצוע',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  completed: {
    label: 'הושלם',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  cancelled: {
    label: 'בוטל',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  on_hold: {
    label: 'בהמתנה',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
} as const

// ── Task Priority ───────────────────────────────────────────

export const TASK_PRIORITY_MAP: Record<TaskPriority, StatusStyle> = {
  low: {
    label: 'נמוך',
    color: 'bg-slate-400',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  medium: {
    label: 'בינוני',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  high: {
    label: 'גבוה',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  urgent: {
    label: 'דחוף',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
} as const

// ── Entity Status (generic active/inactive/archived) ────────

export type EntityStatus = 'active' | 'inactive' | 'archived' | 'draft'

export const ENTITY_STATUS_MAP: Record<EntityStatus, StatusStyle> = {
  active: {
    label: 'פעיל',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  inactive: {
    label: 'לא פעיל',
    color: 'bg-slate-400',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  archived: {
    label: 'בארכיון',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  draft: {
    label: 'טיוטה',
    color: 'bg-blue-400',
    borderColor: 'border-blue-400',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
  },
} as const

// ── User Status ─────────────────────────────────────────────

export const USER_STATUS_MAP: Record<UserStatus, StatusStyle> = {
  active: {
    label: 'פעיל',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  inactive: {
    label: 'לא פעיל',
    color: 'bg-slate-400',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  suspended: {
    label: 'מושהה',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  pending_verification: {
    label: 'ממתין לאימות',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
} as const

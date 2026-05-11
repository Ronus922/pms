'use client'

import { cn } from '../../lib/utils'

type StatusBadgeSize = 'sm' | 'md'

interface StatusColorConfig {
  bg: string
  text: string
  border?: string
}

interface StatusBadgeProps {
  status: string
  statusMap: Record<string, StatusColorConfig>
  size?: StatusBadgeSize
  className?: string
}

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
}

/** Fallback for unknown statuses */
const fallbackConfig: StatusColorConfig = {
  bg: 'bg-gray-100 dark:bg-gray-800',
  text: 'text-gray-600 dark:text-gray-400',
  border: 'border-gray-200 dark:border-gray-700',
}

export function StatusBadge({
  status,
  statusMap,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = statusMap[status] ?? fallbackConfig

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border whitespace-nowrap',
        config.bg,
        config.text,
        config.border ?? 'border-transparent',
        sizeClasses[size],
        className,
      )}
    >
      {status}
    </span>
  )
}

/** Pre-built status maps for common PMS use-cases */
export const reservationStatusMap: Record<string, StatusColorConfig> = {
  'מאושר': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'ממתין': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'מבוטל': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'checked_in': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'checked_out': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
}

export const cleaningStatusMap: Record<string, StatusColorConfig> = {
  'נקי': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'מלוכלך': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'בניקיון': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'בבדיקה': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
}

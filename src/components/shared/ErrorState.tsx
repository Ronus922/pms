'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ErrorStateProps {
  title?: string
  details?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'אירעה שגיאה',
  details,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 p-6',
        className,
      )}
      dir="rtl"
      role="alert"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
            {title}
          </h3>
          {details && (
            <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
              {details}
            </p>
          )}
        </div>
      </div>

      {onRetry && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onRetry}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium',
              'rounded-xl border border-red-300 dark:border-red-800',
              'text-red-700 dark:text-red-300',
              'hover:bg-red-100 dark:hover:bg-red-900/40',
              'transition-colors min-h-[44px]',
            )}
          >
            <RefreshCw size={14} />
            נסה שוב
          </button>
        </div>
      )}
    </div>
  )
}

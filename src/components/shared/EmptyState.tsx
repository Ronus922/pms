'use client'

import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
      dir="rtl"
    >
      <div className="mb-4 text-muted-foreground/30">
        {icon ?? <Inbox size={64} strokeWidth={1} />}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {subtitle}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        className,
      )}
      dir="rtl"
    >
      <div className="space-y-1">
        <h1 className="text-[28px] max-sm:text-[22px] font-extrabold tracking-tight text-right">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground text-right">{subtitle}</p>
        )}
      </div>

      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}

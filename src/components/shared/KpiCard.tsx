'use client'

import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

type TrendDirection = 'up' | 'down' | 'neutral'

interface KpiCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: number
    direction: TrendDirection
    label?: string
  }
  className?: string
}

const trendConfig: Record<TrendDirection, { icon: typeof TrendingUp; color: string }> = {
  up: { icon: TrendingUp, color: 'text-emerald-600' },
  down: { icon: TrendingDown, color: 'text-red-500' },
  neutral: { icon: Minus, color: 'text-muted-foreground' },
}

export function KpiCard({ label, value, icon, trend, className }: KpiCardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null

  return (
    <div
      className={cn(
        'rounded-[20px] border border-border/40 bg-card p-5 shadow-sm',
        'transition-shadow hover:shadow-md',
        className,
      )}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-medium truncate">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>

          {trend && TrendIcon && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trendConfig[trend.direction].color,
              )}
            >
              <TrendIcon size={14} />
              <span>{trend.value}%</span>
              {trend.label && (
                <span className="text-muted-foreground mr-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

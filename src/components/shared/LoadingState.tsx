'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type LoadingVariant = 'page' | 'table' | 'card' | 'inline'

interface LoadingStateProps {
  variant?: LoadingVariant
  rows?: number
  columns?: number
  className?: string
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} />
}

function PageSkeleton() {
  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28 rounded-[20px]" />
        ))}
      </div>
      {/* Table */}
      <SkeletonBlock className="h-64 rounded-[20px]" />
    </div>
  )
}

function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-[20px] border border-border/40 overflow-hidden">
      {/* Header */}
      <div className="bg-accent/50 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBlock key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 border-t border-border/20">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBlock key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-[20px] border border-border/40 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonBlock className="h-20 rounded-lg" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-20 rounded-xl" />
        <SkeletonBlock className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  )
}

function InlineSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Loader2 size={20} className="animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">טוען...</span>
    </div>
  )
}

export function LoadingState({
  variant = 'page',
  rows,
  columns,
  className,
}: LoadingStateProps) {
  return (
    <div className={className}>
      {variant === 'page' && <PageSkeleton />}
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'card' && <CardSkeleton />}
      {variant === 'inline' && <InlineSkeleton />}
    </div>
  )
}

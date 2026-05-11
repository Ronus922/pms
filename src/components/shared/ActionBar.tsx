'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ActionBarProps {
  selectedCount: number
  onClear: () => void
  children: ReactNode
  className?: string
}

export function ActionBar({
  selectedCount,
  onClear,
  children,
  className,
}: ActionBarProps) {
  if (selectedCount <= 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-5 py-3',
        'bg-primary/5 border border-primary/20 rounded-xl',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        className,
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="בטל בחירה"
        >
          <X size={16} className="text-primary" />
        </button>
        <span className="text-sm font-medium text-primary">
          {selectedCount} נבחרו
        </span>
      </div>

      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '../../lib/utils'

interface NotificationBellProps {
  unreadCount: number
  onClick?: () => void
  className?: string
}

export function NotificationBell({
  unreadCount,
  onClick,
  className,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      setIsOpen((prev) => !prev)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={handleClick}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          'hover:bg-accent min-w-[44px] min-h-[44px]',
          'flex items-center justify-center',
        )}
        aria-label={`התראות${unreadCount > 0 ? ` (${unreadCount} חדשות)` : ''}`}
      >
        <Bell
          size={20}
          className={cn(
            'transition-colors',
            unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 flex items-center justify-center',
              'min-w-[18px] h-[18px] px-1 rounded-full',
              'bg-red-500 text-white text-[10px] font-bold',
              'animate-in zoom-in duration-200',
            )}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel (only if no external onClick) */}
      {!onClick && isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 w-80 max-sm:w-72',
            'bg-card border border-border/40 rounded-xl shadow-lg',
            'overflow-hidden z-50',
          )}
          dir="rtl"
        >
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <h3 className="text-sm font-bold">התראות</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-primary font-medium">
                {unreadCount} חדשות
              </span>
            )}
          </div>
          <div className="p-4 text-center text-sm text-muted-foreground min-h-[80px] flex items-center justify-center">
            אין התראות חדשות
          </div>
        </div>
      )}
    </div>
  )
}

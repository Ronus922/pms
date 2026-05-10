'use client'

import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  noPadding?: boolean
}

const WIDTH_MAP: Record<string, string> = {
  sm: 'w-[40%]',
  md: 'w-[55%]',
  lg: 'w-[70%]',
  full: 'w-full',
}

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  noPadding,
}: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null)

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, handleKey])

  // Focus trap: focus the panel on open
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus()
    }
  }, [open])

  if (!open) return null

  const widthClass = WIDTH_MAP[width] ?? width

  return (
    <div className="fixed inset-0 z-50" dir="rtl">
      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel -- slides from LEFT in RTL */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 left-0 flex flex-col',
          'shadow-2xl rounded-tr-[0.65rem] rounded-br-[0.65rem]',
          'bg-card/95 backdrop-blur-xl',
          'transition-transform duration-300 ease-out',
          'max-sm:w-full',
          widthClass,
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header -- Sapphire gradient */}
        <div className="relative bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4 rounded-tr-[0.65rem] shrink-0">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 z-10 p-1.5 rounded-xl bg-white/20 hover:bg-white/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="סגור"
          >
            <X size={20} className="text-white" />
          </button>

          <h2 className="text-lg font-bold text-white text-right">{title}</h2>
          {subtitle && (
            <p className="text-sm text-blue-100 mt-1 text-right">{subtitle}</p>
          )}
        </div>

        {/* Content */}
        <div
          className={cn(
            'flex-1 min-h-0 text-right',
            noPadding ? 'overflow-hidden' : 'overflow-y-auto p-6',
          )}
        >
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && <div className="shrink-0 border-t p-4">{footer}</div>}
      </aside>
    </div>
  )
}

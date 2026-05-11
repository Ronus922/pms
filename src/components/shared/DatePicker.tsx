'use client'

import { useRef } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DatePickerProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  label?: string
  min?: string
  max?: string
  className?: string
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'בחר תאריך',
  disabled,
  error,
  label,
  min,
  max,
  className,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.showPicker?.()
      inputRef.current.focus()
    }
  }

  const computedMin = min === 'today' ? new Date().toISOString().slice(0, 10) : min

  return (
    <div className={cn('space-y-2', className)} dir="rtl">
      {label && (
        <label className="block text-sm font-bold text-muted-foreground mr-1">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Hidden native date input */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={computedMin}
          max={max}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />

        {/* Styled trigger button */}
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className={cn(
            'w-full bg-accent border rounded-xl px-5 py-3 text-sm text-right',
            'flex items-center justify-between gap-2',
            'transition-all outline-none min-h-[48px]',
            'focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
            error
              ? 'border-destructive/60 ring-1 ring-destructive/20'
              : 'border-border/40',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          <span className={cn(!value && 'text-muted-foreground')}>
            {value ? formatDisplay(value) : placeholder}
          </span>

          <span className="flex items-center gap-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                className="p-1 rounded-lg hover:bg-muted transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label="נקה תאריך"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
            <CalendarDays size={16} className="text-muted-foreground shrink-0" />
          </span>
        </button>
      </div>
    </div>
  )
}

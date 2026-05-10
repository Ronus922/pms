'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SelectOption {
  value: string
  label: string
  icon?: string
  disabled?: boolean
}

interface SelectProps {
  options: SelectOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  searchable?: boolean
  multiple?: boolean
  disabled?: boolean
  error?: boolean
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'בחר...',
  searchable,
  multiple,
  disabled,
  error,
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const showSearch = searchable !== false && options.length > 10

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : options

  const selectedValues = Array.isArray(value) ? value : value ? [value] : []
  const selectedLabels = selectedValues
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)

  const handleSelect = useCallback(
    (optValue: string) => {
      if (multiple) {
        const arr = Array.isArray(value) ? value : value ? [value] : []
        const next = arr.includes(optValue)
          ? arr.filter((v) => v !== optValue)
          : [...arr, optValue]
        onChange(next)
      } else {
        onChange(optValue)
        setIsOpen(false)
      }
      setSearch('')
    },
    [multiple, value, onChange],
  )

  const removeChip = (optValue: string) => {
    if (multiple && Array.isArray(value)) {
      onChange(value.filter((v) => v !== optValue))
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search on open
  useEffect(() => {
    if (isOpen && showSearch) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [isOpen, showSearch])

  return (
    <div ref={containerRef} className={cn('relative', className)} dir="rtl">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
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
        <span className={cn('flex-1 truncate', !selectedValues.length && 'text-muted-foreground')}>
          {multiple && selectedLabels.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedLabels.map((label, i) => (
                <span
                  key={selectedValues[i]}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeChip(selectedValues[i])
                    }}
                    className="hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </span>
          ) : selectedLabels.length > 0 ? (
            selectedLabels[0]
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border/40 rounded-xl shadow-lg overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-border/30">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש..."
                  className="w-full bg-accent rounded-lg pr-8 pl-3 py-2 text-sm outline-none border border-border/30 focus:border-primary/40 min-h-[40px]"
                />
              </div>
            </div>
          )}

          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground text-center">
                לא נמצאו תוצאות
              </li>
            ) : (
              filtered.map((opt) => {
                const isSelected = selectedValues.includes(opt.value)
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'px-4 py-3 text-sm cursor-pointer transition-colors',
                      'hover:bg-accent/60',
                      isSelected && 'bg-primary/5 font-medium text-primary',
                      opt.disabled && 'opacity-40 cursor-not-allowed',
                    )}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                  >
                    {opt.label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

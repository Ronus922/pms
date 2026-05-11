'use client'

import { Search, X, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/utils'

type FilterConfigType = 'select' | 'search' | 'toggle' | 'multi-select'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  type: FilterConfigType
  label: string
  placeholder?: string
  options?: FilterOption[]
}

type FilterValues = Record<string, string | string[] | boolean>

interface FilterBarProps {
  filters: FilterConfig[]
  values: FilterValues
  onChange: (key: string, value: string | string[] | boolean) => void
  onReset?: () => void
  resultCount?: number
  className?: string
}

function hasActiveFilters(values: FilterValues): boolean {
  return Object.values(values).some((v) => {
    if (typeof v === 'boolean') return v
    if (Array.isArray(v)) return v.length > 0
    return !!v
  })
}

export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  resultCount,
  className,
}: FilterBarProps) {
  const active = hasActiveFilters(values)

  return (
    <div className={cn('space-y-3', className)} dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        {filters.map((filter) => {
          switch (filter.type) {
            case 'search':
              return (
                <div key={filter.key} className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={(values[filter.key] as string) ?? ''}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    placeholder={filter.placeholder ?? filter.label}
                    className={cn(
                      'w-full bg-accent border border-border/40 rounded-xl',
                      'pr-9 pl-3 py-2.5 text-sm text-right',
                      'focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
                      'transition-all outline-none min-h-[44px]',
                    )}
                  />
                  {(values[filter.key] as string) && (
                    <button
                      type="button"
                      onClick={() => onChange(filter.key, '')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )

            case 'select':
              return (
                <select
                  key={filter.key}
                  value={(values[filter.key] as string) ?? ''}
                  onChange={(e) => onChange(filter.key, e.target.value)}
                  className={cn(
                    'bg-accent border border-border/40 rounded-xl',
                    'px-4 py-2.5 text-sm text-right',
                    'focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
                    'transition-all outline-none appearance-none cursor-pointer min-h-[44px]',
                  )}
                >
                  <option value="">{filter.placeholder ?? filter.label}</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )

            case 'toggle':
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => onChange(filter.key, !values[filter.key])}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-xl border transition-colors min-h-[44px]',
                    values[filter.key]
                      ? 'bg-primary text-white border-primary'
                      : 'bg-accent border-border/40 text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {filter.label}
                </button>
              )

            default:
              return null
          }
        })}

        {/* Reset button */}
        {active && onReset && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-sm',
              'text-muted-foreground hover:text-foreground',
              'rounded-xl border border-border/40 hover:border-primary/30',
              'transition-colors min-h-[44px]',
            )}
          >
            <RotateCcw size={14} />
            איפוס
          </button>
        )}
      </div>

      {/* Result count */}
      {resultCount !== undefined && (
        <p className="text-xs text-muted-foreground">
          {resultCount} תוצאות
        </p>
      )}
    </div>
  )
}

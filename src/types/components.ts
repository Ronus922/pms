// ============================================================
// Shared component prop types
// ============================================================

import type { ReactNode } from 'react'
import type { SelectOption, FilterValue } from './common'

// Re-export for backward compat with consumers importing from components
export type { FilterValue }

// ── SidePanel ───────────────────────────────────────────────

export type SidePanelVariant = 'default' | 'narrow' | 'wide' | 'full'

export type SidePanelProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
  variant?: SidePanelVariant
}

// ── DataTable ───────────────────────────────────────────────

export type DataTableColumnAlign = 'start' | 'center' | 'end'

export type DataTableColumn<T> = {
  id: string
  header: string
  accessorKey?: keyof T & string
  cell?: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: DataTableColumnAlign
}

// ── Filters ─────────────────────────────────────────────────

export type FilterConfigType =
  | 'select'
  | 'date-range'
  | 'search'
  | 'toggle'
  | 'multi-select'

export type FilterConfig = {
  key: string
  type: FilterConfigType
  label: string
  placeholder?: string
  options?: SelectOption[]
}

// ── Empty & Error States ────────────────────────────────────

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}

export type ErrorStateProps = {
  title: string
  details?: string
  onRetry?: () => void
}

// ── KPI Card ────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'neutral'

export type KpiCardProps = {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: number
    direction: TrendDirection
    label?: string
  }
}

// ── Page Header ─────────────────────────────────────────────

export type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

// ── Status Badge ────────────────────────────────────────────

export type StatusBadgeSize = 'sm' | 'md' | 'lg'
export type StatusBadgeVariant = 'solid' | 'outline' | 'subtle'

export type StatusBadgeProps = {
  status: string
  size?: StatusBadgeSize
  variant?: StatusBadgeVariant
}

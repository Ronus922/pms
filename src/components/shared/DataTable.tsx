'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

type SortDirection = 'asc' | 'desc' | null

interface DataTableColumn<T> {
  id: string
  header: string
  accessorKey?: keyof T & string
  cell?: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'start' | 'center' | 'end'
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
  pageSize?: number
  page?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  onSort?: (columnId: string, direction: SortDirection) => void
  rowKey?: (row: T) => string
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border/30">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted animate-pulse rounded-md" />
        </td>
      ))}
    </tr>
  )
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  pageSize = 10,
  page = 1,
  totalCount,
  onPageChange,
  onSort,
  rowKey,
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const handleSort = (colId: string) => {
    let next: SortDirection
    if (sortCol !== colId) {
      next = 'asc'
    } else if (sortDir === 'asc') {
      next = 'desc'
    } else {
      next = null
    }
    setSortCol(next ? colId : null)
    setSortDir(next)
    onSort?.(colId, next)
  }

  const total = totalCount ?? data.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showPagination = totalPages > 1

  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'end' ? 'text-left' : 'text-right'

  return (
    <div className="rounded-[20px] border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          {/* Header */}
          <thead className="bg-accent/50 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    'px-4 py-3 font-bold text-muted-foreground whitespace-nowrap',
                    alignClass(col.align),
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col">
                        {sortCol === col.id && sortDir === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : sortCol === col.id && sortDir === 'desc' ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronsUpDown size={14} className="opacity-40" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  {emptyState ?? (
                    <p className="text-muted-foreground">אין נתונים להצגה</p>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row) : idx}
                  className={cn(
                    'border-b border-border/20 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-accent/40',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn('px-4 py-3', alignClass(col.align))}
                    >
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                          ? String(row[col.accessorKey] ?? '')
                          : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 text-sm text-muted-foreground" dir="rtl">
          <span>
            {total} תוצאות | עמוד {page} מתוך {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="עמוד קודם"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="עמוד הבא"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

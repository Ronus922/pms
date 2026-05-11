// ============================================================
// DataTable helpers — sort, filter, paginate, column builder
// ============================================================

import type { ReactNode } from 'react'

export type DataTableColumn<T> = {
  id: string
  header: string
  accessorKey?: keyof T & string
  cell?: (value: T[keyof T], row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'start' | 'center' | 'end'
}

/**
 * Sort an array by a given key in asc/desc order.
 * Handles string, number, boolean, null, and Date values.
 */
export function sortData<T>(
  data: T[],
  sortBy: keyof T,
  sortDir: 'asc' | 'desc',
): T[] {
  const multiplier = sortDir === 'asc' ? 1 : -1

  return [...data].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]

    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal, 'he') * multiplier
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier
    }
    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      return (Number(aVal) - Number(bVal)) * multiplier
    }

    return String(aVal).localeCompare(String(bVal), 'he') * multiplier
  })
}

/**
 * Filter data by a free-text search across specified fields.
 * Case-insensitive, Hebrew-aware.
 */
export function filterData<T>(
  data: T[],
  search: string,
  searchFields: (keyof T)[],
): T[] {
  const term = search.trim().toLowerCase()
  if (!term) return data

  return data.filter((row) =>
    searchFields.some((field) => {
      const val = row[field]
      if (val == null) return false
      return String(val).toLowerCase().includes(term)
    }),
  )
}

/**
 * Slice data for a given page. Returns the page slice + metadata.
 */
export function paginateData<T>(
  data: T[],
  page: number,
  pageSize: number,
): { data: T[]; totalPages: number; count: number } {
  const count = data.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    data: data.slice(start, start + pageSize),
    totalPages,
    count,
  }
}

/**
 * Build a column definition object for DataTable.
 */
export function buildColumnDef<T>(config: {
  id: string
  header: string
  accessorKey: keyof T & string
  sortable?: boolean
  width?: string
  cell?: (value: T[keyof T], row: T) => ReactNode
}): DataTableColumn<T> {
  return {
    id: config.id,
    header: config.header,
    accessorKey: config.accessorKey,
    sortable: config.sortable ?? false,
    width: config.width,
    cell: config.cell,
  }
}

// ============================================================
// Filter helpers — active detection, serialization, application
// ============================================================

import type { FilterValue, FilterConfig } from '../../types/components'

/**
 * Check whether a single filter value is considered "active" (non-empty).
 */
export function isFilterActive(value: FilterValue): boolean {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object' && 'from' in value) {
    return value.from.length > 0 || value.to.length > 0
  }
  return false
}

/**
 * Count how many filters in a record are active.
 */
export function countActiveFilters(
  filters: Record<string, FilterValue>,
): number {
  return Object.values(filters).filter(isFilterActive).length
}

/**
 * Serialize filter state to URLSearchParams.
 * Arrays are joined with commas; date-range objects become from~to.
 */
export function serializeFilters(
  filters: Record<string, FilterValue>,
): URLSearchParams {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (!isFilterActive(value)) continue

    if (typeof value === 'string') {
      params.set(key, value)
    } else if (typeof value === 'boolean') {
      params.set(key, String(value))
    } else if (Array.isArray(value)) {
      params.set(key, value.join(','))
    } else if (value && typeof value === 'object' && 'from' in value) {
      if (value.from) params.set(`${key}_from`, value.from)
      if (value.to) params.set(`${key}_to`, value.to)
    }
  }

  return params
}

/**
 * Deserialize URLSearchParams back into a filter record
 * using the provided filter configs for type awareness.
 */
export function deserializeFilters(
  params: URLSearchParams,
  config: FilterConfig[],
): Record<string, FilterValue> {
  const result: Record<string, FilterValue> = {}

  for (const filterDef of config) {
    const { key, type } = filterDef

    switch (type) {
      case 'search':
      case 'select': {
        const val = params.get(key)
        result[key] = val ?? ''
        break
      }
      case 'multi-select': {
        const raw = params.get(key)
        result[key] = raw ? raw.split(',') : []
        break
      }
      case 'toggle': {
        const raw = params.get(key)
        result[key] = raw === 'true'
        break
      }
      case 'date-range': {
        const from = params.get(`${key}_from`) ?? ''
        const to = params.get(`${key}_to`) ?? ''
        result[key] = { from, to }
        break
      }
    }
  }

  return result
}

/**
 * Apply a set of active filters to a data array.
 * Each filter key maps to a predicate function.
 */
export function applyFilters<T>(
  data: T[],
  filters: Record<string, FilterValue>,
  filterFns: Record<string, (item: T, value: FilterValue) => boolean>,
): T[] {
  const activeEntries = Object.entries(filters).filter(([, v]) =>
    isFilterActive(v),
  )

  if (activeEntries.length === 0) return data

  return data.filter((item) =>
    activeEntries.every(([key, value]) => {
      const fn = filterFns[key]
      if (!fn) return true
      return fn(item, value)
    }),
  )
}

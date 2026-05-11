'use client'

import {
  useQueryStates,
  parseAsString,
  parseAsArrayOf,
  parseAsBoolean,
  type UseQueryStatesKeysMap,
} from 'nuqs'
import { useCallback, useMemo } from 'react'
import type { FilterValue } from '../types/common'

/**
 * Filter state synced to URL query params.
 * Each filter key becomes a URL param (e.g. `?status=active&department=sales`).
 *
 * For simplicity, all filter values are serialised as strings in the URL.
 * Complex values (arrays, date ranges) use comma-separated format.
 */
export function useFilters<T extends Record<string, FilterValue>>(
  defaultValues: T,
) {
  // Build nuqs parsers from the default values
  const parsers = useMemo(() => {
    const result: UseQueryStatesKeysMap = {}
    for (const key of Object.keys(defaultValues)) {
      const defaultVal = defaultValues[key]
      if (Array.isArray(defaultVal)) {
        result[key] = parseAsArrayOf(parseAsString).withDefault(defaultVal)
      } else if (typeof defaultVal === 'boolean') {
        result[key] = parseAsBoolean.withDefault(defaultVal)
      } else {
        result[key] = parseAsString.withDefault(
          defaultVal === null ? '' : String(defaultVal),
        )
      }
    }
    return result
    // Default values should be stable -- passed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [urlState, setUrlState] = useQueryStates(parsers)

  const filters = urlState as unknown as T

  const setFilter = useCallback(
    (key: keyof T, value: FilterValue) => {
      void setUrlState({ [key]: value } as Record<string, unknown>)
    },
    [setUrlState],
  )

  const resetFilters = useCallback(() => {
    const reset: Record<string, null> = {}
    for (const key of Object.keys(defaultValues)) {
      reset[key] = null
    }
    void setUrlState(reset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUrlState])

  const activeFilterCount = useMemo(() => {
    let count = 0
    for (const key of Object.keys(defaultValues)) {
      const current = filters[key]
      const def = defaultValues[key]
      if (current !== def && current !== null && current !== '' && current !== undefined) {
        count++
      }
    }
    return count
  }, [filters, defaultValues])

  const hasActiveFilters = activeFilterCount > 0

  return {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
  }
}

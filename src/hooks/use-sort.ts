'use client'

import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useCallback } from 'react'
import type { SortDirection } from '../types/common'

const SORT_DIRECTIONS = ['asc', 'desc'] as const

/**
 * Sort state synced to URL query params (`?sortBy=name&sortDir=asc`).
 */
export function useSort(defaultSortBy = 'created_at', defaultDir: SortDirection = 'desc') {
  const [sortBy, setSortByRaw] = useQueryState(
    'sortBy',
    { defaultValue: defaultSortBy },
  )
  const [sortDir, setSortDirRaw] = useQueryState(
    'sortDir',
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault(defaultDir),
  )

  /** Toggle sort direction on a column, or switch to that column ascending. */
  const toggleSort = useCallback(
    (column: string) => {
      if (column === sortBy) {
        void setSortDirRaw(sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        void setSortByRaw(column)
        void setSortDirRaw('asc')
      }
    },
    [sortBy, sortDir, setSortByRaw, setSortDirRaw],
  )

  /** Set sort column and direction explicitly. */
  const setSort = useCallback(
    (column: string, dir: SortDirection) => {
      void setSortByRaw(column)
      void setSortDirRaw(dir)
    },
    [setSortByRaw, setSortDirRaw],
  )

  return {
    sortBy,
    sortDir,
    toggleSort,
    setSort,
  }
}

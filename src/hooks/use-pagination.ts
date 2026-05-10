'use client'

import { useQueryState, parseAsInteger } from 'nuqs'
import { useCallback, useMemo } from 'react'

const DEFAULT_PAGE_SIZE = 25

/**
 * Pagination state synced to URL query params (`?page=1&pageSize=25`).
 * Uses nuqs for type-safe URL state management.
 */
export function usePagination(defaultPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPageRaw] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )
  const [pageSize, setPageSizeRaw] = useQueryState(
    'pageSize',
    parseAsInteger.withDefault(defaultPageSize),
  )

  const setPage = useCallback(
    (newPage: number) => {
      void setPageRaw(Math.max(1, newPage))
    },
    [setPageRaw],
  )

  const setPageSize = useCallback(
    (newSize: number) => {
      void setPageSizeRaw(newSize)
      // Reset to first page when page size changes
      void setPageRaw(1)
    },
    [setPageSizeRaw, setPageRaw],
  )

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize])

  const totalPages = useCallback(
    (count: number) => Math.max(1, Math.ceil(count / pageSize)),
    [pageSize],
  )

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    offset,
    totalPages,
  }
}

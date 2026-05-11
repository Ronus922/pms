// ============================================================
// Common utility types — used across all modules
// ============================================================

/** Standard DB timestamp columns */
export type Timestamps = {
  created_at: string
  updated_at: string
}

/** Soft-delete marker */
export type SoftDelete = {
  deleted_at: string | null
}

/** Audit trail fields */
export type AuditFields = {
  created_by: string
  updated_by: string | null
}

/** Base entity — every DB row has at least id + timestamps */
export type BaseEntity = { id: string } & Timestamps

// ── Pagination ──────────────────────────────────────────────

export type PaginationParams = {
  page: number
  pageSize: number
}

export type PaginatedResult<T> = {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Server Action Response ──────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fields?: Record<string, string[]> }

// ── Sorting ─────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export type SortParams = {
  sortBy: string
  sortDir: SortDirection
}

// ── Filtering ───────────────────────────────────────────────

export type FilterValue =
  | string
  | string[]
  | boolean
  | null
  | { from: string; to: string }

export type FilterParams = Record<string, FilterValue>

// ── Select / Dropdown ───────────────────────────────────────

export type SelectOption = {
  value: string
  label: string
  icon?: string
  description?: string
  disabled?: boolean
  group?: string
}

// ── Date Range ──────────────────────────────────────────────

export type DateRange = {
  from: Date | null
  to: Date | null
}

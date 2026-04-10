/* ── Guest Query Engine — Type Definitions ─────────────────── */

// --- Core guest row returned from server ---
export interface GuestRow {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string | null
  email: string | null
  id_number: string | null

  country: string | null
  preferred_language: string | null
  is_vip: boolean
  is_blocked: boolean
  source: string | null
  company: string | null
  agent: string | null
  tags: string[] | null
  total_reservations: number
  total_revenue: number
  total_cancellations: number
  total_no_shows: number
  created_at: string
  // Computed by query subqueries:
  last_check_in: string | null
  last_check_out: string | null
  next_check_in: string | null
  has_active_reservation: boolean
  has_future_reservation: boolean
  has_open_balance: boolean
  open_balance_total: number
  latest_room_number: string | null
  row_total: number // COUNT(*) OVER() for pagination
}

// --- Filter operators ---
export type FilterOperator =
  // Text
  | "contains"
  | "not_contains"
  | "eq"
  | "neq"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  // Number
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "not_between"
  // Date
  | "on"
  | "before"
  | "after"
  | "date_between"
  | "today"
  | "tomorrow"
  | "this_week"
  | "this_month"
  | "last_7_days"
  | "last_30_days"
  // Boolean
  | "is_true"
  | "is_false"
  // Enum / List
  | "in"
  | "not_in"

// --- Filter field types ---
export type FilterFieldType = "text" | "number" | "date" | "boolean" | "select" | "multi_select"

// --- Filter field definition (for UI rendering) ---
export interface FilterFieldDef {
  key: string
  label: string
  type: FilterFieldType
  category: "guest" | "booking" | "computed"
  operators: FilterOperator[]
  options?: { value: string; label: string }[]
}

// --- Single filter condition ---
export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string | number | boolean | string[] | [string, string]
}

// --- Filter group (AND/OR with nesting) ---
export interface FilterGroup {
  id: string
  logic: "and" | "or"
  conditions: FilterCondition[]
  groups: FilterGroup[]
}

// --- Quick filter keys ---
export type QuickFilterKey =
  | "vip"
  | "blocked"
  | "active_now"
  | "future_bookings"
  | "returning"
  | "open_balance"
  | "missing_phone"
  | "missing_email"
  | "missing_id"
  | "missing_details"

// --- Sort config ---
export interface SortConfig {
  field: string
  direction: "asc" | "desc"
}

// --- Pagination config ---
export interface PaginationConfig {
  page: number
  pageSize: number
}

// --- Full query state (maps 1:1 to URL) ---
export interface GuestQueryState {
  search: string
  quickFilters: QuickFilterKey[]
  advancedFilters: FilterGroup | null
  sort: SortConfig
  pagination: PaginationConfig
  savedViewId: string | null
}

// --- Server response ---
export interface GuestsQueryResult {
  rows: GuestRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Saved views ---
export interface SavedView {
  id: string
  name: string
  is_shared: boolean
  is_default: boolean
  query_state: Omit<GuestQueryState, "pagination" | "savedViewId">
  visible_columns: string[]
  column_order: string[]
  created_by: string
  created_at: string
}

// --- Column definition ---
export interface GuestColumnDef {
  key: string
  label: string
  defaultVisible: boolean
  sortable: boolean
  width?: string
  align?: "right" | "center" | "left"
}

// --- Filter options (for dropdowns) ---
export interface GuestFilterOptions {
  sources: { value: string; label: string }[]
  countries: { value: string; label: string }[]
  roomTypes: { value: string; label: string }[]
  languages: { value: string; label: string }[]
}

// --- Export request ---
export interface GuestExportRequest {
  queryState: GuestQueryState
  selectedIds?: string[]
  format: "csv" | "excel"
  columns: string[]
}

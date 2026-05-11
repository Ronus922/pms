/**
 * Bulk Room Update — shared types
 * ──────────────────────────────────────────────────────────────
 * Used by client hook, server action, service, and pure utils.
 * Keep this file client-safe (no DB / server imports).
 */

export type BulkCurrency = "ILS" | "USD" | "EUR" | "GBP" | "AED"

export const BULK_CURRENCIES: BulkCurrency[] = ["ILS", "USD", "EUR", "GBP", "AED"]

export type PriceMode =
  | "replace"
  | "add"
  | "subtract"
  | "percent_add"
  | "percent_subtract"

export interface PriceFieldState {
  enabled: boolean
  mode: PriceMode
  value: number | ""
}

export interface NumberFieldState {
  enabled: boolean
  value: number | ""
}

export interface CurrencyFieldState {
  enabled: boolean
  value: BulkCurrency
}

export interface OpenClosedFieldState {
  enabled: boolean
  /** true = closed, false = open */
  closed: boolean
}

/** Section 1 — what to update */
export interface BulkUpdateFields {
  price: PriceFieldState
  currency: CurrencyFieldState
  availability: OpenClosedFieldState
  min_nights: NumberFieldState
  max_nights: NumberFieldState
  min_nights_on_arrival: NumberFieldState
  closed_on_arrival: OpenClosedFieldState
  closed_on_departure: OpenClosedFieldState
}

/** 0 = Sunday … 6 = Saturday (Hebrew week starts Sunday) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export const WEEKDAY_LABELS_HE: Record<Weekday, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
}

/** Section 2 — which rooms/dates */
export interface BulkUpdateScope {
  dateFrom: string // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
  weekdays: Weekday[]
  roomIds: string[]
}

/** Full form state held by the hook */
export interface BulkUpdateFormState {
  fields: BulkUpdateFields
  scope: BulkUpdateScope
}

/** Shape of rooms shown in the left-side picker */
export interface BulkUpdateRoomOption {
  id: string
  room_number: string
  room_name: string | null
  room_type_id: string | null
  room_type_name: string | null
  building_id: string | null
  building_name: string | null
  floor_id: string | null
  floor_name: string | null
  base_price: number | null
  is_active: boolean
}

export interface BulkUpdateFilterOption {
  id: string
  name: string
}

export interface BulkUpdateFormData {
  rooms: BulkUpdateRoomOption[]
  roomTypes: BulkUpdateFilterOption[]
  buildings: BulkUpdateFilterOption[]
  floors: { id: string; name: string; building_id: string | null }[]
}

/** Warning surfaced in preview / apply */
export interface BulkUpdateWarning {
  code:
    | "reservation_overlap"
    | "close_blocked_by_reservation"
    | "min_gt_max"
    | "negative_price"
    | "no_rooms"
    | "no_dates"
    | "no_fields"
    | "invalid_date_range"
    | "large_operation"
    | "room_closed"
  level: "info" | "warning" | "error"
  message: string
  roomId?: string
  date?: string
}

/** Small preview row shown in the section 3 table */
export interface BulkUpdatePreviewRow {
  roomId: string
  roomNumber: string
  roomName: string | null
  dateFrom: string
  dateTo: string
  changedFields: string[]
  sampleFinal: Record<string, string | number | boolean | null>
}

export interface BulkUpdatePreview {
  roomsCount: number
  datesCount: number
  weekdays: Weekday[]
  fieldsToUpdate: string[]
  affectedRecords: number
  skippedRecords: number
  warnings: BulkUpdateWarning[]
  rows: BulkUpdatePreviewRow[]
}

/** Input sent to the server action */
export interface BulkUpdateActionInput {
  fields: BulkUpdateFields
  scope: BulkUpdateScope
}

export interface BulkUpdateActionResult {
  success: boolean
  error?: string
  logId?: string
  affectedRecords?: number
  skippedRecords?: number
  warnings?: BulkUpdateWarning[]
  preview?: BulkUpdatePreview
}

/** Existing daily pricing row fetched from DB */
export interface ExistingDailyPricingRow {
  room_id: string
  date: string
  currency: BulkCurrency
  price: number | null
  min_nights: number | null
  max_nights: number | null
  min_nights_on_arrival: number | null
  is_closed: boolean
  closed_on_arrival: boolean
  closed_on_departure: boolean
}

/** Reservation overlap row used for warnings */
export interface ReservationOverlapRow {
  room_id: string
  reservation_id: string
  check_in: string
  check_out: string
  status: string
}

export function emptyBulkUpdateFields(): BulkUpdateFields {
  return {
    price: { enabled: false, mode: "replace", value: "" },
    currency: { enabled: false, value: "ILS" },
    availability: { enabled: false, closed: false },
    min_nights: { enabled: false, value: "" },
    max_nights: { enabled: false, value: "" },
    min_nights_on_arrival: { enabled: false, value: "" },
    closed_on_arrival: { enabled: false, closed: false },
    closed_on_departure: { enabled: false, closed: false },
  }
}

export function emptyBulkUpdateScope(): BulkUpdateScope {
  const today = new Date().toISOString().slice(0, 10)
  return {
    dateFrom: today,
    dateTo: today,
    weekdays: [...ALL_WEEKDAYS],
    roomIds: [],
  }
}

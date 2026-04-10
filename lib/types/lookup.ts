/* ── Lookup / Settings Types ─────────────────────────────── */

export interface LookupCategory {
  id: string
  label: string
  description: string | null
  sort_order: number
}

export interface LookupItem {
  id: string
  tenant_id: string
  category: string
  value: string
  label: string
  color: string | null
  icon: string | null
  is_default: boolean
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LookupCategoryId =
  | "reservation_source"
  | "reservation_status"
  | "payment_status"
  | "payment_method"
  | "board_type"
  | "language"
  | "country"
  | "currency"
  | "guest_tag"
  | "room_tag"
  | "cancellation_policy"
  | "attachment_category"

export interface LookupItemInput {
  category: LookupCategoryId
  value: string
  label: string
  color?: string | null
  icon?: string | null
  is_default?: boolean
  is_active?: boolean
  sort_order?: number
  metadata?: Record<string, unknown>
}

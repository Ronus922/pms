/**
 * TypeScript interfaces mirroring the Channex.io v1 API payload shapes.
 * Curated from https://docs.channex.io — not every optional field is
 * represented, only those the PMS needs.
 */

/* ── Connection (our row) ──────────────────────────────────── */

export type ChannexEnvironment = "staging" | "production"

export type ChannelConnectionStatus =
  | "pending"
  | "connected"
  | "disabled"
  | "error"

export interface ChannelConnectionRow {
  id: string
  tenantId: string
  provider: string
  environment: ChannexEnvironment
  baseUrl: string
  apiKeyFingerprint: string
  webhookId: string | null
  webhookSecret: string
  status: ChannelConnectionStatus
  statusDetail: string | null
  lastTestAt: string | null
  lastSuccessfulPushAt: string | null
  lastSuccessfulPullAt: string | null
  createdAt: string
}

/** Minimal "shape" passed to API client functions. */
export interface ChannexCallContext {
  connectionId: string
  tenantId: string
  baseUrl: string
  apiKey: string // decrypted, only lives in memory during a call
}

/* ── Channex entities (read/write payloads) ─────────────────── */

export interface ChannexPropertyInput {
  title: string
  currency: string
  timezone: string
  email?: string
  phone?: string
  country?: string
  state?: string
  city?: string
  address?: string
  zip_code?: string
  longitude?: string
  latitude?: string
  property_type?: "hotel" | "apartment" | "villa" | "hostel" | "guest_house"
  group_id?: string
}

export interface ChannexProperty {
  id: string
  title: string
  currency: string
  timezone: string
  property_type?: string
}

export interface ChannexRoomTypeInput {
  title: string
  count_of_rooms: number
  occ_adults: number
  occ_children?: number
  occ_infants?: number
  default_occupancy?: number
  facilities?: string[]
  content?: { description?: string }
}

export interface ChannexRoomType {
  id: string
  title: string
  count_of_rooms: number
  occ_adults: number
  occ_children?: number
  default_occupancy?: number
}

export interface ChannexRatePlanInput {
  title: string
  room_type_id: string
  currency: string
  sell_mode?: "per_room" | "per_person"
  rate_mode?: "manual" | "derived" | "auto"
  occ_adults?: number
  occ_children?: number
  options?: Array<{ occupancy: number; is_primary: boolean; rate: number }>
}

export interface ChannexRatePlan {
  id: string
  title: string
  room_type_id: string
  currency: string
  sell_mode?: string
  rate_mode?: string
  occ_adults?: number
}

/* ── ARI (restrictions + availability) ──────────────────────── */

export type ChannexRestrictionField =
  | "rate"
  | "min_stay"
  | "min_stay_arrival"
  | "min_stay_through"
  | "max_stay"
  | "closed_to_arrival"
  | "closed_to_departure"
  | "stop_sell"
  | "availability"

export interface ChannexRestrictionValue {
  property_id: string
  rate_plan_id: string
  date?: string
  date_from?: string
  date_to?: string
  days?: Array<"mo" | "tu" | "we" | "th" | "fr" | "sa" | "su">
  rate?: number | string
  min_stay?: number
  min_stay_arrival?: number
  min_stay_through?: number
  max_stay?: number
  closed_to_arrival?: boolean
  closed_to_departure?: boolean
  stop_sell?: boolean
}

export interface ChannexAvailabilityValue {
  property_id: string
  room_type_id: string
  date?: string
  date_from?: string
  date_to?: string
  availability: number
}

export interface ChannexPushWarning {
  code?: string
  title?: string
  details?: unknown
  value?: unknown
}

export interface ChannexPushResult {
  ok: boolean
  warnings: ChannexPushWarning[]
  meta?: { task_id?: string }
}

/* ── Booking revisions ──────────────────────────────────────── */

export type ChannexRevisionStatus = "new" | "modified" | "cancelled"

export interface ChannexCustomer {
  name?: string
  surname?: string
  mail?: string
  phone?: string
  country?: string
  city?: string
  address?: string
  zip?: string
  language?: string
}

export interface ChannexOccupancy {
  adults: number
  children: number
  infants: number
  ages?: number[]
}

export interface ChannexBookingRoom {
  checkin_date: string
  checkout_date: string
  rate_plan_id: string | null
  room_type_id: string | null
  ota_unique_id?: string
  amount: string
  days?: Record<string, string>
  occupancy?: ChannexOccupancy
  guests?: Array<{ name?: string; surname?: string }>
  services?: unknown[]
  taxes?: unknown[]
  meta?: Record<string, unknown>
}

export interface ChannexBookingRevision {
  id: string
  booking_id: string
  property_id: string
  unique_id: string
  system_id: string
  ota_reservation_code?: string
  ota_name?: string
  status: ChannexRevisionStatus
  arrival_date?: string
  departure_date?: string
  arrival_hour?: string | null
  amount?: string
  currency?: string
  ota_commission?: string | null
  payment_collect?: "property" | "ota" | null
  payment_type?: "credit_card" | "bank_transfer" | null
  notes?: string | null
  customer?: ChannexCustomer
  occupancy?: ChannexOccupancy
  rooms?: ChannexBookingRoom[]
  guarantee?: unknown
  services?: unknown[]
  inserted_at?: string
}

export interface ChannexBookingRevisionFeedResponse {
  meta: { total: number; page: number; limit: number }
  data: Array<{
    type: "booking_revision"
    id: string
    attributes: ChannexBookingRevision
  }>
}

/* ── Webhooks ───────────────────────────────────────────────── */

export type ChannexWebhookEventName =
  | "booking"
  | "booking_new"
  | "booking_modification"
  | "booking_cancellation"
  | "booking_unmapped_room"
  | "booking_unmapped_rate"
  | "non_acked_booking"
  | "ari"
  | "sync_error"
  | "sync_warning"
  | "rate_error"
  | "message"
  | "review"
  | "new_channel"
  | "updated_channel"
  | "disconnected_channel"
  | "activate_channel"
  | "deactivate_channel"

export interface ChannexWebhookSubscribeInput {
  callback_url: string
  event_mask: string
  property_id?: string | null
  headers?: Record<string, string>
  is_active?: boolean
  send_data?: boolean
  is_global?: boolean
}

export interface ChannexWebhookRecord {
  id: string
  callback_url: string
  event_mask: string
  property_id: string | null
  is_active: boolean
  send_data: boolean
  is_global: boolean
}

/** Shape of the POST body Channex sends to our webhook endpoint. */
export interface ChannexIncomingWebhookBody {
  event: ChannexWebhookEventName | string
  property_id: string | null
  user_id: string | null
  timestamp: string
  payload?: unknown
}

/* ── Job queue ──────────────────────────────────────────────── */

export type ChannelSyncJobType =
  | "initial_sync"
  | "create_property"
  | "create_room_type"
  | "create_rate_plan"
  | "webhook_subscribe"
  | "webhook_unsubscribe"
  | "ari_push"
  | "availability_push"
  | "booking_pull"
  | "ack_booking"
  | "webhook_process"

export type ChannelSyncJobStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  | "retry"

export interface ChannelSyncJobRow {
  id: string
  tenant_id: string
  connection_id: string | null
  property_link_id: string | null
  job_type: ChannelSyncJobType
  payload: Record<string, unknown>
  dedup_key: string | null
  priority: number
  status: ChannelSyncJobStatus
  scheduled_for: string
  attempts: number
  max_attempts: number
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
  result: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

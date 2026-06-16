/* ── Cleaning Task Types — single source of truth ─────────── */

export type CleaningStatus = "pending" | "in_progress" | "done" | "skipped"

export type CleaningSourceTrigger =
  | "manual_checkout"
  | "scheduled_checkout_day"
  | "manager_manual"

export interface CleaningTask {
  id: string
  tenant_id: string
  room_id: string | null
  room_number: string | null
  /** Target type: "room" for rooms, "area" for operational areas */
  target_type: "room" | "area"
  /** Unified target reference: room_id or area_id */
  target_id: string | null
  /** Display label: "חדר 101" or "לובי ראשי" */
  target_label: string | null
  reservation_id: string | null
  reservation_room_id: string | null
  assigned_to: string | null
  cleaner_name: string | null
  /** Guest name from the joined reservation, for dispatch UI context only */
  guest_name?: string | null
  status: CleaningStatus
  priority: string
  checkin_date: string | null
  checkout_date: string
  checkout_time: string | null
  order_index: number
  source_trigger: CleaningSourceTrigger | null
  notes: string | null
  /** Number of guests the room should be prepared for (room tasks only) */
  guest_count: number | null
  /** Optional manager-attached image URL */
  image_url: string | null
  /** ID of the user who created this task manually */
  created_by: string | null
  /** Joined full_name of the creator — surfaced on cards for manual tasks */
  creator_name?: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CleanerSummary {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export interface CleaningBoard {
  /** All cleaner users for this tenant */
  cleaners: CleanerSummary[]
  /** Tasks grouped by cleaner id */
  byCleaner: Record<string, CleaningTask[]>
  /** Unassigned tasks for the given date */
  unassigned: CleaningTask[]
  /** All occupied rooms (for pre-assignment drag source) */
  occupiedRooms: OccupiedRoomSummary[]
}

export interface OccupiedRoomSummary {
  room_id: string
  room_number: string
  reservation_id: string
  reservation_room_id: string
  guest_name: string
  check_in: string
  check_out: string
  /** TRUE if a cleaning task already exists for this checkout */
  has_pending_task: boolean
}

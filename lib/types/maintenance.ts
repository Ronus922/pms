/* ── Maintenance Task Types — single source of truth ─────── */

export type MaintenanceSourceType =
  | "manual"
  | "room_status"
  | "guest_report"
  | "staff_report"
  | "inspection"
  | "preventive_maintenance"
  | "followup"

export type MaintenanceTargetType = "room" | "area" | "building" | "equipment"

export type MaintenanceIssueCategory =
  | "plumbing"
  | "electrical"
  | "ac"
  | "lock"
  | "furniture"
  | "appliance"
  | "wall_paint"
  | "cleaning_damage"
  | "water_leak"
  | "sewage"
  | "internet_tv"
  | "safety"
  | "elevator_related"
  | "general"
  | "other"

export type MaintenancePriority = "low" | "medium" | "high" | "critical"

export type MaintenanceUrgency = "normal" | "urgent" | "immediate"

export type MaintenanceStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "waiting_parts"
  | "waiting_external_vendor"
  | "resolved"
  | "cancelled"

export type MaintenanceResolutionCode =
  | "fixed"
  | "temporary_fix"
  | "requires_vendor"
  | "no_issue_found"
  | "postponed"

export type MaintenanceMediaPhase = "before" | "after" | "general"

export type MaintenanceAuditAction =
  | "created"
  | "updated"
  | "assigned"
  | "reordered"
  | "moved_between_workers"
  | "status_changed"
  | "media_added"
  | "media_removed"
  | "completed"
  | "reopened"
  | "cancelled"
  | "deleted"

/* ── Main entity ───────────────────────────────────────────── */

export interface MaintenanceTask {
  id: string
  tenant_id: string
  task_number: number
  source_type: MaintenanceSourceType
  target_type: MaintenanceTargetType
  target_id: string | null
  target_label: string
  room_number: string | null
  issue_category: MaintenanceIssueCategory
  title: string
  description: string
  priority: MaintenancePriority
  urgency_level: MaintenanceUrgency
  status: MaintenanceStatus
  assigned_to: string | null
  assigned_to_name: string | null
  secondary_assignees: string[]
  reported_by: string | null
  reported_by_name: string | null
  reported_at: string
  scheduled_date: string | null
  scheduled_time_from: string | null
  scheduled_time_to: string | null
  sort_order: number
  estimated_duration_minutes: number | null
  actual_duration_minutes: number | null
  room_status_context: string | null
  requires_guest_coordination: boolean
  can_enter_room: boolean
  access_notes: string | null
  resolution_notes: string | null
  resolution_code: MaintenanceResolutionCode | null
  completed_at: string | null
  completed_by: string | null
  completed_by_name: string | null
  reopened_count: number
  last_reopened_at: string | null
  last_reopened_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Joined count of media files */
  media_count?: number
  /** Recurrence link */
  recurrence_rule_id: string | null
  is_recurring: boolean
}

/* ── Media ─────────────────────────────────────────────────── */

export interface MaintenanceTaskMedia {
  id: string
  tenant_id: string
  task_id: string
  media_type: "image" | "video" | "document"
  phase: MaintenanceMediaPhase
  file_url: string
  file_name: string | null
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  uploaded_at: string
  sort_order: number
}

/* ── Audit ─────────────────────────────────────────────────── */

export interface MaintenanceAuditEntry {
  id: string
  tenant_id: string
  task_id: string
  action: MaintenanceAuditAction
  changed_by: string | null
  changed_by_name: string | null
  changes_json: Record<string, { old: unknown; new: unknown }>
  created_at: string
}

/* ── Board ─────────────────────────────────────────────────── */

export interface MaintenanceWorkerSummary {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface MaintenanceBoard {
  workers: MaintenanceWorkerSummary[]
  byWorker: Record<string, MaintenanceTask[]>
  unassigned: MaintenanceTask[]
}

/* ── Filters ───────────────────────────────────────────────── */

export interface MaintenanceFilters {
  search?: string
  status?: MaintenanceStatus | MaintenanceStatus[]
  priority?: MaintenancePriority
  urgency?: MaintenanceUrgency
  category?: MaintenanceIssueCategory
  assignedTo?: string
  targetType?: MaintenanceTargetType
  dateFrom?: string
  dateTo?: string
  onlyMine?: boolean
  onlyUnassigned?: boolean
  onlyWithPhotos?: boolean
  onlyUrgent?: boolean
}

/* ── Stats (KPI) ───────────────────────────────────────────── */

export interface MaintenanceStats {
  open: number
  unassigned: number
  urgent: number
  inProgress: number
  waitingParts: number
  completedToday: number
}

/* ── Create / Update inputs ────────────────────────────────── */

export interface MaintenanceTaskCreateInput {
  source_type?: MaintenanceSourceType
  target_type: MaintenanceTargetType
  target_id?: string
  target_label: string
  room_number?: string
  issue_category: MaintenanceIssueCategory
  title: string
  description: string
  priority: MaintenancePriority
  urgency_level: MaintenanceUrgency
  assigned_to?: string
  scheduled_date?: string
  scheduled_time_from?: string
  scheduled_time_to?: string
  estimated_duration_minutes?: number
  room_status_context?: string
  requires_guest_coordination?: boolean
  can_enter_room?: boolean
  access_notes?: string
  /** If present, creates a recurring rule instead of a one-off task */
  recurrence?: RecurrenceInput
}

export interface MaintenanceTaskUpdateInput {
  target_type?: MaintenanceTargetType
  target_id?: string | null
  target_label?: string
  room_number?: string | null
  issue_category?: MaintenanceIssueCategory
  title?: string
  description?: string
  priority?: MaintenancePriority
  urgency_level?: MaintenanceUrgency
  assigned_to?: string | null
  scheduled_date?: string | null
  scheduled_time_from?: string | null
  scheduled_time_to?: string | null
  estimated_duration_minutes?: number | null
  room_status_context?: string | null
  requires_guest_coordination?: boolean
  can_enter_room?: boolean
  access_notes?: string | null
  resolution_notes?: string | null
  actual_duration_minutes?: number | null
}

/* ── Recurrence ───────────────────────────────────────────── */

export type RecurrenceFrequency = "daily" | "specific_days" | "weekly" | "biweekly" | "monthly"

export interface RecurrenceInput {
  frequency: RecurrenceFrequency
  days_of_week?: number[]   // 0=Sun..6=Sat, required for specific_days
  start_date: string        // ISO date
  end_date?: string | null  // null = no end
}

export interface MaintenanceRecurrenceRule {
  id: string
  tenant_id: string
  source_type: MaintenanceSourceType
  target_type: MaintenanceTargetType
  target_id: string | null
  target_label: string
  room_number: string | null
  issue_category: MaintenanceIssueCategory
  title: string
  description: string
  priority: MaintenancePriority
  urgency_level: MaintenanceUrgency
  assigned_to: string | null
  assigned_to_name: string | null
  scheduled_time_from: string | null
  scheduled_time_to: string | null
  estimated_duration_minutes: number | null
  requires_guest_coordination: boolean
  can_enter_room: boolean
  access_notes: string | null
  frequency: RecurrenceFrequency
  days_of_week: number[]
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  is_active: boolean
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

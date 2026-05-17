/**
 * Absence Requests — TypeScript types
 * ───────────────────────────────────
 * Mirrors the schema introduced by migration 2026-05-17_absence_requests.sql.
 * Domain matrix:
 *   - any active user may create / cancel their OWN pending requests.
 *   - users with `attendance.edit` may list ALL requests and review them
 *     (approve / reject). Approval materializes one attendance_records
 *     row per day in the range (skipping Saturday) with a matching
 *     entry_type so the absence shows up on the manager calendar.
 */

export type AbsenceRequestType =
  | "vacation"
  | "sick"
  | "reserve_duty"
  | "personal"
  | "unpaid"
  | "other"

export type AbsenceRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"

/* ── Core row ───────────────────────────────────────────────── */

/**
 * One row per absence request. `total_days` is generated (inclusive
 * end - start + 1). `reviewed_by` / `reviewed_at` / `review_note`
 * are populated when the row moves out of `pending`.
 */
export interface AbsenceRequest {
  id: string
  tenant_id: string
  employee_id: string
  request_type: AbsenceRequestType
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: AbsenceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

/** Same row with joined display names — used by manager-facing lists. */
export interface AbsenceRequestWithEmployee extends AbsenceRequest {
  employee_name: string
  reviewer_name: string | null
  attachments_count: number
}

/* ── Attachments (metadata only — binary in Supabase Storage) ── */

export interface AbsenceRequestAttachment {
  id: string
  request_id: string
  tenant_id: string
  url: string
  name: string
  mime: string | null
  size: number | null
  uploaded_by: string | null
  uploaded_at: string
}

/* ── Action inputs ──────────────────────────────────────────── */

export interface CreateAbsenceRequestInput {
  request_type: AbsenceRequestType
  start_date: string
  end_date: string
  reason?: string | null
  /** Optional attachments to record alongside the request. */
  attachments?: AttachmentInput[]
}

export interface AttachmentInput {
  url: string
  name: string
  mime?: string | null
  size?: number | null
}

export interface ReviewAbsenceRequestInput {
  /** Only approved/rejected are valid here; cancellation has its own path. */
  status: "approved" | "rejected"
  review_note?: string | null
}

/* ── List filters (manager view) ────────────────────────────── */

export interface ListAbsenceRequestsFilters {
  status?: AbsenceRequestStatus
  employee_id?: string
}

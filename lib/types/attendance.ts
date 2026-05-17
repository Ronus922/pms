/**
 * Attendance module — TypeScript types
 * ────────────────────────────────────
 * Single source of truth for attendance data shapes.
 * Domain enums live in `@/lib/constants/attendance`.
 *
 * Two distinct sub-models live here:
 *   1. Areas + geometry + settings — geofence configuration (admin UI).
 *   2. Records + summary — one row per shift (clock_in/out on same row),
 *      with manager-edit audit fields. Supersedes the legacy per-punch
 *      model (the old `attendance_punches` action file was removed; the
 *      `attendance_punches` DB table is left in place but is no longer
 *      referenced by application code).
 */

import type { ShapeType } from "@/lib/constants/attendance"

export type { ShapeType }

/* ── Geometry (discriminated union — matches Zod schema) ─────── */

/**
 * Coordinate is `[lat, lng]` (matches what Google Maps returns to the UI).
 * NOTE: turf expects `[lng, lat]` — the geofencing service flips internally.
 */
export type LatLng = [number, number]

export interface PolygonGeometry {
  type: "polygon"
  coords: LatLng[]
}

export interface CircleGeometry {
  type: "circle"
  center: LatLng
  radius_m: number
}

/** "address" shape uses point geometry under the hood. */
export interface PointGeometry {
  type: "point"
  center: LatLng
  radius_m: number
  address?: string
}

export type AreaGeometry = PolygonGeometry | CircleGeometry | PointGeometry

/* ── Attendance Area row ─────────────────────────────────────── */

export interface AttendanceArea {
  id: string
  tenant_id: string
  name: string
  shape_type: ShapeType
  geometry: AreaGeometry
  address: string | null
  color: string
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /**
   * Number of users currently linked to this area via `users.attendance_area_id`.
   * Populated by `listAttendanceAreas`. Undefined for single-row fetches
   * (`getAttendanceAreaById`) where it's not joined.
   */
  linked_users_count?: number
}

/** Picker shape used in dropdowns / selectors (no geometry weight). */
export interface AttendanceAreaPickerItem {
  id: string
  name: string
  shape_type: ShapeType
  color: string
}

/* ── Area Inputs (server action payloads) ────────────────────── */

export interface CreateAreaInput {
  name: string
  shape_type: ShapeType
  geometry: AreaGeometry
  address?: string | null
  color?: string
  notes?: string | null
}

export interface UpdateAreaInput {
  name?: string
  shape_type?: ShapeType
  geometry?: AreaGeometry
  address?: string | null
  color?: string
  notes?: string | null
  is_active?: boolean
}

/* ── Per-user attendance settings ────────────────────────────── */

export interface AttendanceSettingsInput {
  user_id: string
  attendance_required: import("@/lib/constants/attendance").AttendanceRequired
  attendance_area_id: string | null
}

export interface AttendanceSettings {
  user_id: string
  attendance_required: import("@/lib/constants/attendance").AttendanceRequired
  attendance_area_id: string | null
  area_name: string | null
}

/* ── Area deletion conflict envelope ─────────────────────────── */

/** Result envelope returned by `deleteAttendanceArea` when cascade is required. */
export interface AreaDeletionConflict {
  success: false
  error: "AREA_HAS_USERS"
  message: string
  affected_users: { id: string; full_name: string }[]
}

/* ── Attendance Records (shift-per-row model) ────────────────── */

/**
 * Provenance of a record. `self` = the worker punched themselves;
 * `manager_manual` = manager created the row from scratch;
 * `manager_edit` = a self-punch row that a manager later modified.
 */
export type AttendanceSource = "self" | "manager_manual" | "manager_edit"

/**
 * Classification of an attendance row. `regular` = worked shift
 * (only type that requires both clock_in/out). Non-regular types
 * mark calendar absence/time-off; for those, clock_in is a sentinel
 * (typically midnight of work_date) and clock_out is NULL.
 */
export type AttendanceEntryType =
  | "regular"
  | "vacation"
  | "sick"
  | "holiday"
  | "absence"

/**
 * One row per shift. `clock_out === null` ⇒ shift is currently open.
 * `work_date` is the calendar day the shift is attributed to
 * (Asia/Jerusalem — overnight shifts stay on the start day).
 * `user_name` is populated only when the row is fetched via a JOIN on
 * `users` (e.g. manager-facing lists); self-fetches leave it undefined.
 */
export interface AttendanceRecord {
  id: string
  tenant_id: string
  user_id: string
  user_name?: string
  /** NULL for non-regular entries (vacation/sick/holiday/absence) — those
   *  are date-only rows and don't carry shift timestamps. */
  clock_in: string | null
  clock_out: string | null
  work_date: string
  notes: string | null
  source: AttendanceSource
  entry_type: AttendanceEntryType
  edited_by: string | null
  edited_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Daily roll-up — one entry per (user, day) with the day's records
 * collapsed into a single `total_minutes` plus an `open_shift` flag.
 */
export interface AttendanceSummary {
  user_id: string
  full_name: string
  work_date: string
  total_minutes: number
  open_shift: boolean
  records: AttendanceRecord[]
}

/* ── Manager Monthly View ────────────────────────────────────── */

/** Lightweight staff picker entry for the attendance manager UI. */
export interface AttendanceStaffOption {
  id: string
  full_name: string
  role: string
  is_active: boolean
}

/**
 * Monthly KPI roll-up for a single employee — derived from the
 * month's `regular` records only (non-regular entries don't count
 * toward worked hours).
 */
export interface MonthlyAttendanceSummary {
  work_days: number
  total_minutes: number
  avg_minutes_per_day: number
  overtime_minutes: number
  issues: string[]
}

export interface UpsertAttendanceEntryInput {
  id?: string | null
  user_id: string
  work_date: string
  entry_type: AttendanceEntryType
  clock_in_time?: string | null
  clock_out_time?: string | null
  notes?: string | null
}

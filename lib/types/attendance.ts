/**
 * Attendance module — TypeScript types
 * ────────────────────────────────────
 * Single source of truth for attendance data shapes.
 * Domain enums live in `@/lib/constants/attendance` and are re-exported here.
 */

import type {
  AttendanceRequired,
  ShapeType,
  PunchType,
  AbsenceType,
} from "@/lib/constants/attendance"

export type { AttendanceRequired, ShapeType, PunchType, AbsenceType }

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

/* ── Attendance Punch row ────────────────────────────────────── */

export interface AttendancePunch {
  id: string
  tenant_id: string
  user_id: string
  punch_type: PunchType
  punched_at: string
  lat: number | null
  lng: number | null
  area_id: string | null
  area_snapshot: AreaGeometry | null
  is_within_area: boolean | null
  device_info: Record<string, unknown> | null
  ip_address: string | null
  notes: string | null
  absence_type: AbsenceType | null
  absence_from: string | null
  absence_to: string | null
  created_at: string
  deleted_at: string | null
}

/* ── Inputs (server action payloads) ─────────────────────────── */

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

export interface AttendanceSettingsInput {
  user_id: string
  attendance_required: AttendanceRequired
  attendance_area_id: string | null
  report_absence_in_app: boolean
}

export interface ClockInput {
  lat?: number
  lng?: number
  accuracy_m?: number
  device_info?: Record<string, unknown>
  notes?: string
}

/* ── Read-side composite types ───────────────────────────────── */

export interface AttendanceSettings {
  user_id: string
  attendance_required: AttendanceRequired
  attendance_area_id: string | null
  area_name: string | null
  report_absence_in_app: boolean
}

/**
 * A "shift" is a clock_in punch optionally paired with a clock_out.
 * Open shift = clock_out is null.
 */
export interface AttendanceShift {
  clock_in: AttendancePunch
  clock_out: AttendancePunch | null
  duration_ms: number | null
  is_open: boolean
}

/** Result envelope returned by `deleteAttendanceArea` when cascade is required. */
export interface AreaDeletionConflict {
  success: false
  error: "AREA_HAS_USERS"
  message: string
  affected_users: { id: string; full_name: string }[]
}

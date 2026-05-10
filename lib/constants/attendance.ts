/**
 * Attendance module — shared constants
 * ────────────────────────────────────
 * Decisions:
 *   §12.9.5 — ATTENDANCE_TZ is fixed (no per-tenant override yet).
 *   §12.9.4 — address-radius defaults documented here, used by Zod schema
 *             AND the radius slider in Part D.
 */

/* ── Timezone (§12.9.5) ──────────────────────────────────────── */
/**
 * All attendance display, day-cutoffs, and shift aggregation use this TZ.
 * The DB stores `punched_at` in UTC (TIMESTAMPTZ).
 */
export const ATTENDANCE_TZ = "Asia/Jerusalem" as const

/* ── Required Levels (5 values, matches CHECK constraint) ────── */

export const ATTENDANCE_REQUIRED = [
  "none",
  "required_no_location",
  "required_with_location",
  "required_inside",
  "required_outside",
] as const

export type AttendanceRequired = (typeof ATTENDANCE_REQUIRED)[number]

export const ATTENDANCE_REQUIRED_LABELS: Record<AttendanceRequired, string> = {
  none: "לא — אין דיווח כלל",
  required_no_location: "כן — ללא מיקום כלל",
  required_with_location: "כן — דיווח עם מיקום",
  required_inside: "כן — דיווח בתוך אזור",
  required_outside: "כן — דיווח מחוץ לאזור",
}

/** Helper: does this level require GPS coordinates on punch? */
export function attendanceRequiresLocation(level: AttendanceRequired): boolean {
  return (
    level === "required_with_location" ||
    level === "required_inside" ||
    level === "required_outside"
  )
}

/** Helper: does this level require a configured area? */
export function attendanceRequiresArea(level: AttendanceRequired): boolean {
  return level === "required_inside" || level === "required_outside"
}

/* ── Shape Types (matches CHECK constraint) ──────────────────── */

export const SHAPE_TYPES = ["rectangle", "circle", "polygon", "address"] as const
export type ShapeType = (typeof SHAPE_TYPES)[number]

export const SHAPE_LABELS: Record<ShapeType, string> = {
  rectangle: "מרובע",
  circle: "עיגול",
  polygon: "פוליגון",
  address: "כתובת",
}

/* ── Address-radius (used by Part D radius slider) ───────────── */

export const ADDRESS_RADIUS_DEFAULT = 200 // meters
export const ADDRESS_RADIUS_MIN = 50
export const ADDRESS_RADIUS_MAX = 2_000

/* ── Punch Types ─────────────────────────────────────────────── */

export const PUNCH_TYPES = ["clock_in", "clock_out", "absence_request"] as const
export type PunchType = (typeof PUNCH_TYPES)[number]

/* ── Absence Types (Phase 2 — schema only) ───────────────────── */

export const ABSENCE_TYPES = ["sick", "vacation", "personal", "other"] as const
export type AbsenceType = (typeof ABSENCE_TYPES)[number]

/* ── Default area color (Azure Ethos primary) ────────────────── */

export const DEFAULT_AREA_COLOR = "#1e40af"

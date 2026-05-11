/**
 * Attendance module — Zod schemas (runtime validation)
 * ─────────────────────────────────────────────────────
 * Used by server actions to validate payloads coming from the client.
 * Geometry is the highest-risk surface (free-form JSON) — validate strictly.
 */

import { z } from "zod"
import {
  ATTENDANCE_REQUIRED,
  SHAPE_TYPES,
  ADDRESS_RADIUS_DEFAULT,
  ADDRESS_RADIUS_MIN,
  ADDRESS_RADIUS_MAX,
  PUNCH_TYPES,
} from "@/lib/constants/attendance"

/* ── LatLng tuple ────────────────────────────────────────────── */

const latLngSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
])

/* ── Geometry (discriminated union) ──────────────────────────── */

const polygonGeometrySchema = z.object({
  type: z.literal("polygon"),
  coords: z.array(latLngSchema).min(3, "פוליגון חייב לפחות 3 קודקודים"),
})

const circleGeometrySchema = z.object({
  type: z.literal("circle"),
  center: latLngSchema,
  radius_m: z.number().positive().max(50_000),
})

const pointGeometrySchema = z.object({
  type: z.literal("point"),
  center: latLngSchema,
  radius_m: z
    .number()
    .min(ADDRESS_RADIUS_MIN)
    .max(ADDRESS_RADIUS_MAX)
    .default(ADDRESS_RADIUS_DEFAULT),
  address: z.string().max(500).optional(),
})

export const areaGeometrySchema = z.discriminatedUnion("type", [
  polygonGeometrySchema,
  circleGeometrySchema,
  pointGeometrySchema,
])

/* ── Area inputs ─────────────────────────────────────────────── */

const colorHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "צבע חייב להיות בפורמט HEX (#RRGGBB)")

export const createAreaSchema = z.object({
  name: z.string().min(2, "שם חייב לפחות 2 תווים").max(100),
  shape_type: z.enum(SHAPE_TYPES),
  geometry: areaGeometrySchema,
  address: z.string().max(500).nullish(),
  color: colorHex.optional(),
  notes: z.string().max(500).nullish(),
})

export const updateAreaSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  shape_type: z.enum(SHAPE_TYPES).optional(),
  geometry: areaGeometrySchema.optional(),
  address: z.string().max(500).nullish(),
  color: colorHex.optional(),
  notes: z.string().max(500).nullish(),
  is_active: z.boolean().optional(),
})

/* ── Attendance settings (per-user policy) ───────────────────── */

export const attendanceSettingsSchema = z
  .object({
    user_id: z.string().uuid(),
    attendance_required: z.enum(ATTENDANCE_REQUIRED),
    attendance_area_id: z.string().uuid().nullable(),
    report_absence_in_app: z.boolean(),
  })
  .refine(
    (d) => {
      if (
        d.attendance_required === "required_inside" ||
        d.attendance_required === "required_outside"
      ) {
        return d.attendance_area_id !== null
      }
      return true
    },
    {
      message: "ברמת דיווח 'בתוך/מחוץ לאזור' חובה לבחור אזור",
      path: ["attendance_area_id"],
    },
  )

/* ── Clock input ─────────────────────────────────────────────── */

export const clockInputSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().nonnegative().max(100_000).optional(),
  device_info: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(500).optional(),
})

/* ── Punch type guard (used by query helpers) ────────────────── */

export const punchTypeSchema = z.enum(PUNCH_TYPES)

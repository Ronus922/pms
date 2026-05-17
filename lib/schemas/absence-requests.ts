/**
 * Absence Requests — Zod schemas
 * ──────────────────────────────
 * Runtime validation for the absence-request server actions.
 */

import { z } from "zod"

/* ── Enums ──────────────────────────────────────────────────── */

export const absenceRequestTypeSchema = z.enum([
  "vacation",
  "sick",
  "reserve_duty",
  "personal",
  "unpaid",
  "other",
])

export const absenceReviewStatusSchema = z.enum(["approved", "rejected"])

/* ── ISO date (YYYY-MM-DD) ──────────────────────────────────── */

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך חייב להיות בפורמט YYYY-MM-DD")

/* ── Attachment payload (metadata only) ─────────────────────── */

const attachmentInputSchema = z.object({
  url: z.string().url("כתובת קובץ לא תקינה").max(2000),
  name: z.string().min(1, "שם קובץ חסר").max(255),
  mime: z.string().max(150).nullish(),
  size: z.number().int().nonnegative().max(50 * 1024 * 1024).nullish(),
})

/* ── Create input ───────────────────────────────────────────── */

export const createAbsenceRequestSchema = z
  .object({
    request_type: absenceRequestTypeSchema,
    start_date: isoDateSchema,
    end_date: isoDateSchema,
    reason: z.string().max(2000).nullish(),
    attachments: z.array(attachmentInputSchema).max(20).optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "תאריך סיום חייב להיות אחרי או שווה לתאריך התחלה",
    path: ["end_date"],
  })

/* ── Review input ───────────────────────────────────────────── */

export const reviewAbsenceRequestSchema = z.object({
  status: absenceReviewStatusSchema,
  review_note: z.string().max(2000).nullish(),
})

/* ── List filters ───────────────────────────────────────────── */

export const listAbsenceRequestsFiltersSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
    employee_id: z.string().uuid().optional(),
  })
  .optional()

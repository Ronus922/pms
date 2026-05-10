/**
 * Bulk Room Update — validation layer (pure, no DB)
 * ──────────────────────────────────────────────────────────────
 * Runs on both client (live form feedback) and server (before apply).
 * Returns a list of warnings/errors; caller decides whether to block.
 */

import { z } from "zod"
import type {
  BulkUpdateFields,
  BulkUpdateScope,
  BulkUpdateWarning,
} from "@/lib/types/bulk-room-update"

// ── zod schemas ──────────────────────────────────────────────

const priceMode = z.enum([
  "replace",
  "add",
  "subtract",
  "percent_add",
  "percent_subtract",
])

const currencyEnum = z.enum(["ILS", "USD", "EUR", "GBP", "AED"])

const priceField = z.object({
  enabled: z.boolean(),
  mode: priceMode,
  value: z.union([z.number(), z.literal("")]),
})

const numberField = z.object({
  enabled: z.boolean(),
  value: z.union([z.number().int().nonnegative(), z.literal("")]),
})

const currencyField = z.object({
  enabled: z.boolean(),
  value: currencyEnum,
})

const openClosedField = z.object({
  enabled: z.boolean(),
  closed: z.boolean(),
})

export const bulkUpdateFieldsSchema = z.object({
  price: priceField,
  currency: currencyField,
  availability: openClosedField,
  min_nights: numberField,
  max_nights: numberField,
  min_nights_on_arrival: numberField,
  closed_on_arrival: openClosedField,
  closed_on_departure: openClosedField,
})

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "פורמט תאריך לא תקין")

const weekdayEnum = z
  .number()
  .int()
  .min(0)
  .max(6)
  .transform((n) => n as 0 | 1 | 2 | 3 | 4 | 5 | 6)

export const bulkUpdateScopeSchema = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
  weekdays: z.array(weekdayEnum),
  roomIds: z.array(z.string().uuid()),
})

export const bulkUpdateInputSchema = z.object({
  fields: bulkUpdateFieldsSchema,
  scope: bulkUpdateScopeSchema,
})

// ── business rule validation ─────────────────────────────────

export function collectActiveFields(fields: BulkUpdateFields): string[] {
  const active: string[] = []
  if (fields.price.enabled) active.push("price")
  if (fields.currency.enabled) active.push("currency")
  if (fields.availability.enabled) active.push("is_closed")
  if (fields.min_nights.enabled) active.push("min_nights")
  if (fields.max_nights.enabled) active.push("max_nights")
  if (fields.min_nights_on_arrival.enabled) active.push("min_nights_on_arrival")
  if (fields.closed_on_arrival.enabled) active.push("closed_on_arrival")
  if (fields.closed_on_departure.enabled) active.push("closed_on_departure")
  return active
}

export function validateBulkUpdate(
  fields: BulkUpdateFields,
  scope: BulkUpdateScope,
): BulkUpdateWarning[] {
  const warnings: BulkUpdateWarning[] = []

  // Scope checks
  if (!scope.roomIds.length) {
    warnings.push({
      code: "no_rooms",
      level: "error",
      message: "לא נבחרו חדרים",
    })
  }

  if (!scope.dateFrom || !scope.dateTo) {
    warnings.push({
      code: "no_dates",
      level: "error",
      message: "לא נבחר טווח תאריכים",
    })
  } else if (scope.dateFrom > scope.dateTo) {
    warnings.push({
      code: "invalid_date_range",
      level: "error",
      message: "תאריך התחלה חייב להיות לפני תאריך הסיום",
    })
  }

  if (!scope.weekdays.length) {
    warnings.push({
      code: "no_dates",
      level: "error",
      message: "לא נבחרו ימי שבוע",
    })
  }

  // Field checks
  const active = collectActiveFields(fields)
  if (active.length === 0) {
    warnings.push({
      code: "no_fields",
      level: "error",
      message: "יש להפעיל לפחות שדה אחד לעדכון",
    })
  }

  if (fields.price.enabled) {
    if (fields.price.value === "" || Number.isNaN(Number(fields.price.value))) {
      warnings.push({
        code: "negative_price",
        level: "error",
        message: "נדרש ערך מספרי למחיר",
      })
    } else if (Number(fields.price.value) < 0 && fields.price.mode === "replace") {
      warnings.push({
        code: "negative_price",
        level: "error",
        message: "לא ניתן להגדיר מחיר שלילי",
      })
    }
  }

  if (
    fields.min_nights.enabled &&
    fields.max_nights.enabled &&
    typeof fields.min_nights.value === "number" &&
    typeof fields.max_nights.value === "number" &&
    fields.min_nights.value > fields.max_nights.value
  ) {
    warnings.push({
      code: "min_gt_max",
      level: "error",
      message: "מינימום לילות לא יכול להיות גדול ממקסימום לילות",
    })
  }

  // Large-operation soft warning (informational)
  if (scope.roomIds.length * estimateDateCount(scope) > 5000) {
    warnings.push({
      code: "large_operation",
      level: "info",
      message: "פעולה גדולה — ייתכן שהעדכון ייקח מספר שניות",
    })
  }

  return warnings
}

export function hasBlockingErrors(warnings: BulkUpdateWarning[]): boolean {
  return warnings.some((w) => w.level === "error")
}

// ── helpers ──────────────────────────────────────────────────

export function estimateDateCount(scope: BulkUpdateScope): number {
  if (!scope.dateFrom || !scope.dateTo) return 0
  if (scope.dateFrom > scope.dateTo) return 0
  const from = new Date(scope.dateFrom + "T00:00:00Z")
  const to = new Date(scope.dateTo + "T00:00:00Z")
  const totalDays =
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (totalDays <= 0) return 0
  if (scope.weekdays.length === 7) return totalDays
  let matching = 0
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000)
    const dow = d.getUTCDay()
    if (scope.weekdays.includes(dow as 0 | 1 | 2 | 3 | 4 | 5 | 6)) matching++
  }
  return matching
}

/** Expand scope into the full list of ISO date strings matching weekdays. */
export function expandDates(scope: BulkUpdateScope): string[] {
  if (!scope.dateFrom || !scope.dateTo) return []
  if (scope.dateFrom > scope.dateTo) return []
  const from = new Date(scope.dateFrom + "T00:00:00Z")
  const to = new Date(scope.dateTo + "T00:00:00Z")
  const totalDays =
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const result: string[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000)
    const dow = d.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    if (!scope.weekdays.includes(dow)) continue
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

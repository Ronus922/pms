// ============================================================
// Reusable Zod patterns
// ============================================================

import { z } from 'zod'

// ── Pagination ──────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

// ── Sorting ─────────────────────────────────────────────────

export const sortSchema = z.object({
  sortBy: z.string().min(1),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
})

// ── Common Fields ───────────────────────────────────────────

export const uuidSchema = z.string().uuid('מזהה לא תקין')

export const dateRangeSchema = z.object({
  from: z.string().datetime({ message: 'תאריך התחלה לא תקין' }),
  to: z.string().datetime({ message: 'תאריך סיום לא תקין' }),
})

export const searchSchema = z.string().max(200, 'חיפוש ארוך מדי').optional()

// ── File Upload ─────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const fileUploadSchema = z.object({
  file_name: z.string().min(1, 'שם קובץ חסר').max(255),
  file_size: z
    .number()
    .int()
    .positive('גודל קובץ לא תקין')
    .max(MAX_FILE_SIZE, 'הקובץ חורג מ-10MB'),
  mime_type: z.enum(
    [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    { message: 'סוג קובץ לא נתמך' },
  ),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
})

// ── Inferred Types ──────────────────────────────────────────

export type PaginationInput = z.infer<typeof paginationSchema>
export type SortInput = z.infer<typeof sortSchema>
export type DateRangeInput = z.infer<typeof dateRangeSchema>
export type FileUploadInput = z.infer<typeof fileUploadSchema>

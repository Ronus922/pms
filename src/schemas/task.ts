// ============================================================
// Task Zod schemas
// ============================================================

import { z } from 'zod'

export const taskCreateSchema = z.object({
  title: z
    .string()
    .min(2, 'כותרת חייבת להכיל לפחות 2 תווים')
    .max(200, 'כותרת ארוכה מדי (מקסימום 200 תווים)'),
  description: z
    .string()
    .max(2000, 'תיאור ארוך מדי (מקסימום 2000 תווים)')
    .optional()
    .or(z.literal('')),
  status: z.enum(
    ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    { message: 'סטטוס לא תקין' },
  ),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], {
    message: 'עדיפות לא תקינה',
  }),
  category_id: z.string().uuid('קטגוריה לא תקינה').optional().or(z.literal('')),
  assigned_to: z.string().uuid('משתמש לא תקין').optional().or(z.literal('')),
  due_date: z.string().datetime().optional().or(z.literal('')),
  parent_id: z.string().uuid('משימת אב לא תקינה').optional().or(z.literal('')),
})

export const taskUpdateSchema = taskCreateSchema.partial()

export const taskCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'תוכן התגובה חסר')
    .max(2000, 'תגובה ארוכה מדי (מקסימום 2000 תווים)'),
  is_internal: z.boolean().default(false),
})

// ── Inferred Types ──────────────────────────────────────────

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type TaskCommentInput = z.infer<typeof taskCommentSchema>

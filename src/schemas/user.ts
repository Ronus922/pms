// ============================================================
// User Zod schemas
// ============================================================

import { z } from 'zod'

// Israeli phone: 05X-XXXXXXX or +972-5X-XXXXXXX
const ISRAELI_PHONE_REGEX = /^(\+972|0)5\d{1}-?\d{7}$/

export const userCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, 'שם מלא חייב להכיל לפחות 2 תווים')
    .max(100, 'שם מלא ארוך מדי'),
  email: z.string().email('כתובת אימייל לא תקינה'),
  phone: z
    .string()
    .regex(ISRAELI_PHONE_REGEX, 'מספר טלפון ישראלי לא תקין')
    .optional()
    .or(z.literal('')),
  role_id: z.string().uuid('יש לבחור תפקיד'),
  department: z.string().max(100).optional().or(z.literal('')),
  status: z.enum(
    ['active', 'inactive', 'suspended', 'pending_verification'],
    { message: 'סטטוס לא תקין' },
  ),
})

export const userUpdateSchema = userCreateSchema.partial()

export const userProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'שם מלא חייב להכיל לפחות 2 תווים')
    .max(100, 'שם מלא ארוך מדי'),
  phone: z
    .string()
    .regex(ISRAELI_PHONE_REGEX, 'מספר טלפון ישראלי לא תקין')
    .optional()
    .or(z.literal('')),
  language: z.string().min(2).max(5).default('he'),
  timezone: z.string().min(1).default('Asia/Jerusalem'),
})

// ── Inferred Types ──────────────────────────────────────────

export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type UserProfileInput = z.infer<typeof userProfileSchema>

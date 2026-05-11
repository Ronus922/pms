/* ── Automation Module Constants — Hebrew labels ─────────── */

import type { ChannelType, TemplateCategory, TriggerType, QueueStatus } from "@/lib/types/automations"

/* ── Channel Types ────────────────────────────────────────── */

export const CHANNEL_MAP: Record<ChannelType, { label: string; icon: string; color: string }> = {
  email:             { label: "אימייל",     icon: "email",          color: "text-blue-600" },
  whatsapp:          { label: "וואטסאפ",    icon: "chat",           color: "text-emerald-600" },
  sms:               { label: "SMS",        icon: "sms",            color: "text-violet-600" },
  in_app:            { label: "התראה פנימית", icon: "notifications", color: "text-amber-600" },
  push_notification: { label: "פוש",        icon: "phonelink_ring", color: "text-indigo-600" },
}

/* ── Template Categories ──────────────────────────────────── */

export const CATEGORY_MAP: Record<TemplateCategory, { label: string; icon: string }> = {
  registration:  { label: "הרשמה וניסיון",  icon: "person_add" },
  reservations:  { label: "הזמנות",         icon: "book_online" },
  tasks:         { label: "משימות",         icon: "assignment" },
  cleaning:      { label: "ניקיון",         icon: "cleaning_services" },
  maintenance:   { label: "תחזוקה",         icon: "construction" },
  attendance:    { label: "נוכחות",         icon: "schedule" },
  suppliers:     { label: "ספקים",          icon: "local_shipping" },
  system:        { label: "מערכת",          icon: "settings" },
}

/* ── Trigger Types ────────────────────────────────────────── */

export const TRIGGER_TYPE_MAP: Record<TriggerType, { label: string; icon: string; description: string }> = {
  event:         { label: "אירוע",          icon: "bolt",           description: "מופעל כשאירוע מתרחש (הזמנה נוצרה, משימה שויכה...)" },
  relative_date: { label: "תאריך יחסי",     icon: "event_repeat",   description: "X ימים לפני/אחרי תאריך (צ׳ק-אין, סיום ניסיון...)" },
  exact_time:    { label: "זמן קבוע",       icon: "alarm",          description: "כל יום/שבוע/חודש בשעה מסוימת" },
  conditional:   { label: "תנאי",           icon: "rule",           description: "רק אם תנאי מתקיים (לא שולם, לא אושר...)" },
}

/* ── Queue Status ─────────────────────────────────────────── */

export const QUEUE_STATUS_MAP: Record<QueueStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: "ממתין",     bg: "bg-amber-50",   text: "text-amber-700" },
  scheduled: { label: "מתוזמן",    bg: "bg-blue-50",    text: "text-blue-700" },
  sending:   { label: "בשליחה",    bg: "bg-indigo-50",  text: "text-indigo-700" },
  sent:      { label: "נשלח",      bg: "bg-emerald-50", text: "text-emerald-700" },
  failed:    { label: "נכשל",      bg: "bg-red-50",     text: "text-red-700" },
  cancelled: { label: "בוטל",      bg: "bg-slate-100",  text: "text-slate-600" },
  retry:     { label: "ניסיון חוזר", bg: "bg-orange-50", text: "text-orange-700" },
}

/* ── Trigger Entities ─────────────────────────────────────── */

export const TRIGGER_ENTITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "reservation",   label: "הזמנה" },
  { value: "guest",         label: "אורח" },
  { value: "room",          label: "חדר" },
  { value: "task",          label: "משימה" },
  { value: "cleaning_task", label: "משימת ניקיון" },
  { value: "maintenance",   label: "תקלה" },
  { value: "supplier",      label: "ספק" },
  { value: "user",          label: "משתמש" },
  { value: "payment",       label: "תשלום" },
  { value: "trial",         label: "ניסיון" },
]

/* ── Default Dynamic Variables ────────────────────────────── */

export const DEFAULT_VARIABLES: Array<{ entity_type: string; variable_key: string; variable_label: string; example_value: string }> = [
  { entity_type: "global",      variable_key: "business_name",      variable_label: "שם העסק",           example_value: "מלון הים" },
  { entity_type: "global",      variable_key: "support_phone",      variable_label: "טלפון תמיכה",       example_value: "03-1234567" },
  { entity_type: "global",      variable_key: "support_email",      variable_label: "אימייל תמיכה",      example_value: "support@hotel.com" },
  { entity_type: "guest",       variable_key: "full_name",          variable_label: "שם מלא",            example_value: "ישראל ישראלי" },
  { entity_type: "guest",       variable_key: "first_name",         variable_label: "שם פרטי",           example_value: "ישראל" },
  { entity_type: "guest",       variable_key: "email",              variable_label: "אימייל",            example_value: "israel@email.com" },
  { entity_type: "guest",       variable_key: "phone",              variable_label: "טלפון",             example_value: "050-1234567" },
  { entity_type: "reservation", variable_key: "reservation_number", variable_label: "מספר הזמנה",        example_value: "RES-001" },
  { entity_type: "reservation", variable_key: "check_in_date",      variable_label: "תאריך הגעה",        example_value: "15/04/2026" },
  { entity_type: "reservation", variable_key: "check_out_date",     variable_label: "תאריך עזיבה",       example_value: "18/04/2026" },
  { entity_type: "reservation", variable_key: "room_number",        variable_label: "מספר חדר",          example_value: "101" },
  { entity_type: "reservation", variable_key: "total_price",        variable_label: "סך הכל",            example_value: "2,500 ₪" },
  { entity_type: "reservation", variable_key: "nights_count",       variable_label: "מספר לילות",        example_value: "3" },
  { entity_type: "reservation", variable_key: "guest_count",        variable_label: "מספר אורחים",       example_value: "2" },
  { entity_type: "task",        variable_key: "task_title",         variable_label: "כותרת משימה",       example_value: "ניקיון חדר 101" },
  { entity_type: "task",        variable_key: "task_due_date",      variable_label: "תאריך יעד",         example_value: "15/04/2026" },
  { entity_type: "task",        variable_key: "assigned_to_name",   variable_label: "שם העובד",          example_value: "דני כהן" },
  { entity_type: "maintenance", variable_key: "issue_title",        variable_label: "כותרת תקלה",        example_value: "נזילה בחדר 102" },
  { entity_type: "maintenance", variable_key: "issue_status",       variable_label: "סטטוס תקלה",        example_value: "בטיפול" },
  { entity_type: "supplier",    variable_key: "supplier_name",      variable_label: "שם ספק",            example_value: "חשמל פלוס" },
  { entity_type: "user",        variable_key: "user_name",          variable_label: "שם משתמש",          example_value: "אבי לוי" },
  { entity_type: "user",        variable_key: "user_role",          variable_label: "תפקיד",             example_value: "מנהל" },
]

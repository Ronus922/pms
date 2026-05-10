/* ── Maintenance Module Constants — Hebrew labels & visual maps ── */

import type {
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceUrgency,
  MaintenanceIssueCategory,
  MaintenanceSourceType,
  MaintenanceTargetType,
  MaintenanceResolutionCode,
  MaintenanceAuditAction,
} from "@/lib/types/maintenance"

/* ── Status ────────────────────────────────────────────────── */

export const MAINTENANCE_STATUS_MAP: Record<
  MaintenanceStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  open: {
    label: "פתוח",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200",
    icon: "radio_button_unchecked",
  },
  assigned: {
    label: "שויך",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200",
    icon: "person",
  },
  in_progress: {
    label: "בטיפול",
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200",
    icon: "engineering",
  },
  waiting_parts: {
    label: "ממתין לחלקים",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200",
    icon: "inventory_2",
  },
  waiting_external_vendor: {
    label: "ממתין לספק",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200",
    icon: "local_shipping",
  },
  resolved: {
    label: "הושלם",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200",
    icon: "check_circle",
  },
  cancelled: {
    label: "בוטל",
    bg: "bg-slate-100 dark:bg-slate-900/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200",
    icon: "cancel",
  },
}

/* ── Priority ──────────────────────────────────────────────── */

export const MAINTENANCE_PRIORITY_MAP: Record<
  MaintenancePriority,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  low: {
    label: "נמוכה",
    bg: "bg-slate-100 dark:bg-slate-900/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200",
    icon: "arrow_downward",
  },
  medium: {
    label: "בינונית",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200",
    icon: "remove",
  },
  high: {
    label: "גבוהה",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200",
    icon: "arrow_upward",
  },
  critical: {
    label: "קריטית",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200",
    icon: "priority_high",
  },
}

/* ── Urgency ───────────────────────────────────────────────── */

export const MAINTENANCE_URGENCY_MAP: Record<
  MaintenanceUrgency,
  { label: string; bg: string; text: string; border: string }
> = {
  normal: {
    label: "רגיל",
    bg: "bg-slate-100 dark:bg-slate-900/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200",
  },
  urgent: {
    label: "דחוף",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200",
  },
  immediate: {
    label: "מיידי",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200",
  },
}

/* ── Issue Category ────────────────────────────────────────── */

export const MAINTENANCE_CATEGORY_MAP: Record<
  MaintenanceIssueCategory,
  { label: string; icon: string }
> = {
  plumbing: { label: "אינסטלציה", icon: "plumbing" },
  electrical: { label: "חשמל", icon: "electrical_services" },
  ac: { label: "מיזוג אוויר", icon: "ac_unit" },
  lock: { label: "מנעול / דלת", icon: "lock" },
  furniture: { label: "ריהוט", icon: "chair" },
  appliance: { label: "מכשיר חשמלי", icon: "kitchen" },
  wall_paint: { label: "קירות / צבע", icon: "format_paint" },
  cleaning_damage: { label: "נזק ניקיון", icon: "cleaning_services" },
  water_leak: { label: "נזילת מים", icon: "water_drop" },
  sewage: { label: "ביוב", icon: "water_damage" },
  internet_tv: { label: "אינטרנט / טלוויזיה", icon: "wifi" },
  safety: { label: "בטיחות", icon: "health_and_safety" },
  elevator_related: { label: "מעלית", icon: "elevator" },
  general: { label: "כללי", icon: "construction" },
  other: { label: "אחר", icon: "more_horiz" },
}

/* ── Source Type ────────────────────────────────────────────── */

export const MAINTENANCE_SOURCE_MAP: Record<MaintenanceSourceType, { label: string }> = {
  manual: { label: "ידני" },
  room_status: { label: "סטטוס חדר" },
  guest_report: { label: "דיווח אורח" },
  staff_report: { label: "דיווח עובד" },
  inspection: { label: "בדיקה תקופתית" },
  preventive_maintenance: { label: "תחזוקה מונעת" },
  followup: { label: "המשך טיפול" },
}

/* ── Target Type ───────────────────────────────────────────── */

export const MAINTENANCE_TARGET_MAP: Record<
  MaintenanceTargetType,
  { label: string; icon: string }
> = {
  room: { label: "חדר", icon: "bed" },
  area: { label: "אזור משותף", icon: "meeting_room" },
  building: { label: "בניין", icon: "apartment" },
  equipment: { label: "ציוד", icon: "build" },
}

/* ── Resolution Code ───────────────────────────────────────── */

export const MAINTENANCE_RESOLUTION_MAP: Record<MaintenanceResolutionCode, { label: string }> = {
  fixed: { label: "תוקן" },
  temporary_fix: { label: "תיקון זמני" },
  requires_vendor: { label: "דורש ספק חיצוני" },
  no_issue_found: { label: "לא נמצאה תקלה" },
  postponed: { label: "נדחה" },
}

/* ── Status Transitions ────────────────────────────────────── */

export const MAINTENANCE_STATUS_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  open: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "waiting_parts", "waiting_external_vendor", "cancelled"],
  in_progress: ["waiting_parts", "waiting_external_vendor", "resolved", "cancelled"],
  waiting_parts: ["in_progress", "resolved", "cancelled"],
  waiting_external_vendor: ["in_progress", "resolved", "cancelled"],
  resolved: ["open"], // reopen — manager only
  cancelled: ["open"], // reopen — manager only
}

/* ── Audit Action Labels ───────────────────────────────────── */

export const MAINTENANCE_AUDIT_LABELS: Record<MaintenanceAuditAction, string> = {
  created: "נוצרה משימה",
  updated: "עודכנו פרטים",
  assigned: "שויכה לעובד",
  reordered: "שונה סדר",
  moved_between_workers: "הועברה בין עובדים",
  status_changed: "שונה סטטוס",
  media_added: "נוספה תמונה/קובץ",
  media_removed: "הוסרה תמונה/קובץ",
  completed: "הושלמה",
  reopened: "נפתחה מחדש",
  cancelled: "בוטלה",
  deleted: "נמחקה",
}

/* ── Recurrence ───────────────────────────────────────────── */

import type { RecurrenceFrequency } from "@/lib/types/maintenance"

export const RECURRENCE_FREQUENCY_MAP: Record<RecurrenceFrequency, { label: string; icon: string }> = {
  daily:         { label: "יומי",          icon: "today" },
  specific_days: { label: "ימים ספציפיים", icon: "date_range" },
  weekly:        { label: "שבועי",         icon: "view_week" },
  biweekly:      { label: "דו-שבועי",      icon: "event_repeat" },
  monthly:       { label: "חודשי",         icon: "calendar_month" },
}

/** Hebrew day names (Israeli week: Sun=0 first) */
export const HEBREW_DAY_NAMES: Record<number, { short: string; full: string }> = {
  0: { short: "א׳", full: "ראשון" },
  1: { short: "ב׳", full: "שני" },
  2: { short: "ג׳", full: "שלישי" },
  3: { short: "ד׳", full: "רביעי" },
  4: { short: "ה׳", full: "חמישי" },
  5: { short: "ו׳", full: "שישי" },
  6: { short: "ש׳", full: "שבת" },
}

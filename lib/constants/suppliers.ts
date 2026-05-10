/* ── Supplier Module Constants — Hebrew labels & visual maps ── */

import type {
  SupplierStatus,
  SupplierPaymentTerms,
  SupplierActivityAction,
} from "@/lib/types/suppliers"

/* ── Status ────────────────────────────────────────────────── */

export const SUPPLIER_STATUS_MAP: Record<
  SupplierStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  active: {
    label: "פעיל",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300",
    icon: "check_circle",
  },
  inactive: {
    label: "לא פעיל",
    bg: "bg-slate-50 dark:bg-slate-950/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-300",
    icon: "pause_circle",
  },
  archived: {
    label: "בארכיון",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300",
    icon: "archive",
  },
}

/* ── Supplier Types ────────────────────────────────────────── */

export const SUPPLIER_TYPE_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: "general",      label: "כללי",       icon: "business" },
  { value: "plumbing",     label: "אינסטלציה",   icon: "plumbing" },
  { value: "electrical",   label: "חשמל",       icon: "bolt" },
  { value: "ac",           label: "מיזוג אוויר", icon: "ac_unit" },
  { value: "cleaning",     label: "ניקיון",      icon: "cleaning_services" },
  { value: "security",     label: "אבטחה",      icon: "security" },
  { value: "gardening",    label: "גינון",       icon: "park" },
  { value: "construction", label: "בנייה/שיפוץ", icon: "construction" },
  { value: "furniture",    label: "ריהוט",       icon: "chair" },
  { value: "food",         label: "מזון",        icon: "restaurant" },
  { value: "laundry",      label: "כביסה",       icon: "local_laundry_service" },
  { value: "elevator",     label: "מעליות",      icon: "elevator" },
  { value: "pest_control", label: "הדברה",       icon: "bug_report" },
  { value: "other",        label: "אחר",         icon: "more_horiz" },
]

export const SUPPLIER_TYPE_MAP: Record<string, { label: string; icon: string }> =
  Object.fromEntries(SUPPLIER_TYPE_OPTIONS.map((o) => [o.value, { label: o.label, icon: o.icon }]))

/* ── Payment Terms ─────────────────────────────────────────── */

export const PAYMENT_TERMS_MAP: Record<SupplierPaymentTerms, { label: string }> = {
  immediate: { label: "מיידי" },
  net_15:    { label: "שוטף + 15" },
  net_30:    { label: "שוטף + 30" },
  net_45:    { label: "שוטף + 45" },
  net_60:    { label: "שוטף + 60" },
  net_90:    { label: "שוטף + 90" },
  other:     { label: "אחר" },
}

/* ── Activity Labels ───────────────────────────────────────── */

export const SUPPLIER_ACTIVITY_LABELS: Record<SupplierActivityAction, string> = {
  created:            "ספק נוצר",
  updated:            "פרטים עודכנו",
  document_uploaded:  "מסמך הועלה",
  document_deleted:   "מסמך הוסר",
  status_changed:     "סטטוס שונה",
  linked_to_task:     "קושר למשימה",
  linked_to_issue:    "קושר לתקלה",
  archived:           "הועבר לארכיון",
  restored:           "שוחזר מארכיון",
}

/* ── Document Types ────────────────────────────────────────── */

export const SUPPLIER_DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: "general",   label: "כללי" },
  { value: "contract",  label: "חוזה" },
  { value: "invoice",   label: "חשבונית" },
  { value: "quote",     label: "הצעת מחיר" },
  { value: "license",   label: "רישיון" },
  { value: "insurance", label: "ביטוח" },
  { value: "warranty",  label: "אחריות" },
]

/* ── Validation ────────────────────────────────────────────── */

export const ALLOWED_DOC_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export const PHONE_REGEX = /^[\d\-+() ]{7,20}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ── Role Types ──────────────────────────────────────────────── */

export type Role = "super_admin" | "admin" | "receptionist" | "cleaner"

export type Action = "view" | "edit" | "delete"

export interface ModulePermission {
  module: string
  canView: boolean
  canEdit: boolean
  canDelete: boolean
}

/* ── Role Definitions ───────────────────────────────────────── */

export const ROLES: { value: Role; label: string; description: string; level: number }[] = [
  { value: "super_admin", label: "סופר אדמין", description: "גישה מלאה לכל המערכת כולל חיוב והגדרות", level: 0 },
  { value: "admin", label: "מנהל", description: "גישה תפעולית מלאה. ניהול צוות, הגדרות והרשאות", level: 1 },
  { value: "receptionist", label: "עובד קבלה", description: "הרשאות מותאמות לפי מודולים", level: 2 },
  { value: "cleaner", label: "עובד ניקיון", description: "גישה אך ורק למשימות הניקיון שלו. ללא גישה להזמנות, אורחים או כספים", level: 3 },
]

export function getRoleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label || role
}

export function getRoleLevel(role: string): number {
  return ROLES.find((r) => r.value === role)?.level ?? 99
}

/* ── Module Definitions ─────────────────────────────────────── */

export const MODULES: { key: string; label: string; icon: string; path: string }[] = [
  { key: "dashboard",    label: "דשבורד",         icon: "dashboard",     path: "/dashboard" },
  { key: "calendar",     label: "יומן",           icon: "calendar_today", path: "/calendar" },
  { key: "reservations", label: "הזמנות",          icon: "book_online",   path: "/reservations" },
  { key: "guests",       label: "אורחים",          icon: "group",         path: "/guests" },
  { key: "rooms",        label: "חדרים",           icon: "bed",           path: "/rooms" },
  { key: "housekeeping", label: "ניקיון",          icon: "cleaning_services", path: "/housekeeping" },
  { key: "maintenance",  label: "תחזוקה",          icon: "construction",  path: "/maintenance" },
  { key: "staff",        label: "עובדים",          icon: "person",        path: "/staff" },
  { key: "documents",    label: "מסמכים",          icon: "description",   path: "/documents" },
  { key: "finance",      label: "כספים",           icon: "payments",      path: "/finance" },
  { key: "suppliers",    label: "ספקים",           icon: "local_shipping", path: "/suppliers" },
  { key: "reports",      label: "דוחות",           icon: "bar_chart",     path: "/reports" },
  { key: "channels",     label: "אינטגרציות",      icon: "hub",           path: "/channels" },
  { key: "rate_plans",   label: "תוכניות מחיר",    icon: "percent",       path: "/rate-plans" },
  { key: "automations",  label: "אוטומציות",       icon: "bolt",          path: "/automations" },
  { key: "settings",     label: "הגדרות",          icon: "settings",      path: "/settings" },
  { key: "billing",      label: "חיוב ותשלום",     icon: "receipt_long",  path: "/billing" },
  { key: "permissions",  label: "הרשאות",          icon: "admin_panel_settings", path: "/permissions" },
]

/* ── Default Receptionist Permissions ───────────────────────── */

export const DEFAULT_RECEPTIONIST: Record<string, { canView: boolean; canEdit: boolean; canDelete: boolean }> = {
  dashboard:    { canView: true,  canEdit: false, canDelete: false },
  calendar:     { canView: true,  canEdit: true,  canDelete: false },
  reservations: { canView: true,  canEdit: true,  canDelete: false },
  guests:       { canView: true,  canEdit: true,  canDelete: false },
  rooms:        { canView: true,  canEdit: false, canDelete: false },
  housekeeping: { canView: true,  canEdit: true,  canDelete: false },
  maintenance:  { canView: true,  canEdit: false, canDelete: false },
  staff:        { canView: false, canEdit: false, canDelete: false },
  documents:    { canView: true,  canEdit: false, canDelete: false },
  finance:      { canView: false, canEdit: false, canDelete: false },
  suppliers:    { canView: true,  canEdit: false, canDelete: false },
  reports:      { canView: true,  canEdit: false, canDelete: false },
  channels:     { canView: false, canEdit: false, canDelete: false },
  rate_plans:   { canView: true,  canEdit: false, canDelete: false },
  automations:  { canView: false, canEdit: false, canDelete: false },
  settings:     { canView: false, canEdit: false, canDelete: false },
  billing:      { canView: false, canEdit: false, canDelete: false },
  permissions:  { canView: false, canEdit: false, canDelete: false },
}

/* ── Default Cleaner Permissions ────────────────────────────── */

export const DEFAULT_CLEANER: Record<string, { canView: boolean; canEdit: boolean; canDelete: boolean }> = {
  dashboard:    { canView: false, canEdit: false, canDelete: false },
  calendar:     { canView: false, canEdit: false, canDelete: false },
  reservations: { canView: false, canEdit: false, canDelete: false },
  guests:       { canView: false, canEdit: false, canDelete: false },
  rooms:        { canView: false, canEdit: false, canDelete: false },
  housekeeping: { canView: true,  canEdit: true,  canDelete: false },
  maintenance:  { canView: false, canEdit: false, canDelete: false },
  staff:        { canView: false, canEdit: false, canDelete: false },
  documents:    { canView: false, canEdit: false, canDelete: false },
  finance:      { canView: false, canEdit: false, canDelete: false },
  suppliers:    { canView: false, canEdit: false, canDelete: false },
  reports:      { canView: false, canEdit: false, canDelete: false },
  channels:     { canView: false, canEdit: false, canDelete: false },
  rate_plans:   { canView: false, canEdit: false, canDelete: false },
  automations:  { canView: false, canEdit: false, canDelete: false },
  settings:     { canView: false, canEdit: false, canDelete: false },
  billing:      { canView: false, canEdit: false, canDelete: false },
  permissions:  { canView: false, canEdit: false, canDelete: false },
}

/* ── Modules restricted to super_admin only ─────────────────── */

export const SUPER_ADMIN_ONLY = ["billing"]

/* ── Modules restricted to admin+ ───────────────────────────── */

export const ADMIN_ONLY = ["permissions", "settings"]

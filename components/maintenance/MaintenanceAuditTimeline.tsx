"use client"

import { Icon } from "@/components/shared/Icon"
import {
  MAINTENANCE_AUDIT_LABELS,
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
  MAINTENANCE_CATEGORY_MAP,
  MAINTENANCE_RESOLUTION_MAP,
} from "@/lib/constants/maintenance"
import type { MaintenanceAuditEntry } from "@/lib/types/maintenance"

interface MaintenanceAuditTimelineProps {
  entries: MaintenanceAuditEntry[]
  loading?: boolean
}

function fmtDateTime(v: string): string {
  if (!v) return "—"
  const d = new Date(v)
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return `${date} ${time}`
}

const ACTION_ICONS: Record<string, string> = {
  created: "add_circle",
  updated: "edit",
  assigned: "person_add",
  reordered: "swap_vert",
  moved_between_workers: "swap_horiz",
  status_changed: "sync",
  media_added: "add_photo_alternate",
  media_removed: "delete",
  completed: "check_circle",
  reopened: "replay",
  cancelled: "cancel",
  deleted: "delete_forever",
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-500",
  completed: "bg-emerald-500",
  assigned: "bg-blue-500",
  moved_between_workers: "bg-blue-500",
  status_changed: "bg-indigo-500",
  media_added: "bg-teal-500",
  media_removed: "bg-orange-500",
  reopened: "bg-amber-500",
  cancelled: "bg-red-500",
  deleted: "bg-red-500",
  updated: "bg-slate-500",
  reordered: "bg-slate-400",
}

export function MaintenanceAuditTimeline({ entries, loading }: MaintenanceAuditTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-accent" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-accent rounded w-2/3" />
              <div className="h-3 bg-accent rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Icon name="history" size="lg" className="opacity-30" />
        <p className="text-sm">אין היסטוריה</p>
      </div>
    )
  }

  return (
    <div className="relative p-4" dir="rtl">
      {/* Timeline line — right side for RTL */}
      <div className="absolute right-[19px] top-8 bottom-4 w-0.5 bg-border/30" />

      <div className="space-y-4">
        {entries.map((entry) => {
          const label = MAINTENANCE_AUDIT_LABELS[entry.action] ?? entry.action
          const icon = ACTION_ICONS[entry.action] ?? "info"
          const dotColor = ACTION_COLORS[entry.action] ?? "bg-slate-400"
          const changes = entry.changes_json

          return (
            <div key={entry.id} className="flex gap-3 relative">
              {/* Dot */}
              <div className={`w-8 h-8 rounded-full ${dotColor} flex items-center justify-center shrink-0 z-10`}>
                <Icon name={icon} size="sm" className="text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {fmtDateTime(entry.created_at)}
                  </span>
                </div>
                {entry.changed_by_name && (
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    על ידי {entry.changed_by_name}
                  </div>
                )}

                {/* Changes detail */}
                {changes && Object.keys(changes).length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {Object.entries(changes)
                      .filter(([field]) => !HIDDEN_FIELDS.has(field))
                      .map(([field, diff]) => (
                      <div key={field} className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted-foreground">{fieldLabel(field)}:</span>
                        {diff.old != null && (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 line-through">
                            {formatFieldValue(field, diff.old)}
                          </span>
                        )}
                        <span className="text-muted-foreground">&rarr;</span>
                        {diff.new != null && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                            {formatFieldValue(field, diff.new)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Fields to hide from audit display — technical/internal values */
const HIDDEN_FIELDS = new Set([
  "sort_order", "reopened_count", "target_id", "room_number",
  "estimated_duration_minutes", "actual_duration_minutes",
  "requires_guest_coordination", "can_enter_room",
])

const FIELD_LABELS: Record<string, string> = {
  title: "כותרת",
  status: "סטטוס",
  priority: "עדיפות",
  urgency_level: "דחיפות",
  assigned_to: "עובד",
  issue_category: "קטגוריה",
  description: "תיאור",
  target_type: "סוג יעד",
  target_label: "יעד",
  scheduled_date: "תאריך",
  scheduled_time_from: "שעת התחלה",
  scheduled_time_to: "שעת סיום",
  resolution_code: "קוד פתרון",
  resolution_notes: "הערות פתרון",
  access_notes: "הערות גישה",
  phase: "שלב",
  count: "כמות",
  file_name: "שם קובץ",
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

/* Translate enum values to Hebrew labels */
const VALUE_MAPS: Record<string, Record<string, { label: string }>> = {
  status: MAINTENANCE_STATUS_MAP,
  priority: MAINTENANCE_PRIORITY_MAP,
  urgency_level: MAINTENANCE_URGENCY_MAP,
  issue_category: MAINTENANCE_CATEGORY_MAP,
  resolution_code: MAINTENANCE_RESOLUTION_MAP,
}

const PHASE_LABELS: Record<string, string> = {
  before: "לפני",
  after: "אחרי",
  general: "כללי",
}

function formatFieldValue(field: string, value: unknown): string {
  if (value == null) return "—"
  const str = String(value)
  if (field === "phase") return PHASE_LABELS[str] ?? str
  const map = VALUE_MAPS[field]
  if (map && map[str]) return map[str].label
  return str
}

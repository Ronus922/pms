// ============================================================
// Core entity types — matching DB schema
// ============================================================

import type { BaseEntity, AuditFields, SoftDelete } from './common'

// ── Tasks ───────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Task = BaseEntity &
  AuditFields &
  SoftDelete & {
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    category_id: string | null
    assigned_to: string | null
    due_date: string | null
    completed_at: string | null
    parent_id: string | null
    sort_order: number
  }

export type TaskComment = BaseEntity & {
  task_id: string
  user_id: string
  content: string
  is_internal: boolean
}

// ── Notifications ───────────────────────────────────────────

export type NotificationType =
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'reminder'

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms'

export type Notification = BaseEntity & {
  user_id: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  body: string
  link: string | null
  is_read: boolean
  read_at: string | null
  entity_type: string | null
  entity_id: string | null
}

// ── Audit Log ───────────────────────────────────────────────

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'status_change'

export type AuditLog = {
  id: string
  user_id: string
  action: AuditActionType
  entity_type: string
  entity_id: string | null
  changes: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ── Files ───────────────────────────────────────────────────

export type FileType = 'image' | 'document' | 'spreadsheet' | 'pdf' | 'other'

export type FileRecord = BaseEntity & {
  name: string
  original_name: string
  mime_type: string
  size: number
  file_type: FileType
  storage_path: string
  url: string
  uploaded_by: string
  entity_type: string | null
  entity_id: string | null
}

export type FileLink = {
  id: string
  file_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

// ── Categories & Tags ───────────────────────────────────────

export type Category = BaseEntity & {
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
}

export type TagColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'slate'

export type Tag = BaseEntity & {
  name: string
  color: TagColor
  description: string | null
}

export type EntityTag = {
  id: string
  tag_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

// ── Settings & Lookups ──────────────────────────────────────

export type Setting = {
  id: string
  key: string
  value: string
  group: string
  label: string
  description: string | null
  type: 'text' | 'number' | 'boolean' | 'json' | 'select'
  options: string[] | null
  updated_at: string
  updated_by: string | null
}

export type LookupItem = BaseEntity & {
  category: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
  metadata: Record<string, unknown> | null
}

# Enum Reference

> All 10 PostgreSQL ENUM types in the core schema.
> Each includes values, Hebrew labels, Tailwind color mappings, and usage notes.

---

## Overview

| Enum Type | Values | Used By |
|-----------|--------|---------|
| `entity_status` | 5 | Domain entities (project-defined) |
| `task_status` | 4 | `tasks.status` |
| `task_priority` | 4 | `tasks.priority` |
| `notification_type` | 6 | `notifications.type` |
| `audit_action_type` | 5 | `audit_logs.action` |
| `file_type` | 6 | `files.file_type` |
| `permission_scope` | 3 | `permissions.scope` |
| `user_status` | 4 | `users.status` |
| `notification_channel` | 4 | `notifications.channel` |
| `tag_color` | 10 | `tags.color` |

---

## entity_status

Generic status for any domain entity. Projects use this for their own tables.

```sql
CREATE TYPE entity_status AS ENUM (
  'draft', 'active', 'inactive', 'archived', 'deleted'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `draft` | טיוטה | Not yet published/active | Entity created but not finalized |
| `active` | פעיל | Currently in use | Normal operational state |
| `inactive` | לא פעיל | Temporarily disabled | Paused but not archived |
| `archived` | בארכיון | Preserved for history | No longer needed but kept for reference |
| `deleted` | נמחק | Marked for deletion | Soft-deleted state (prefer `deleted_at` pattern) |

**Tailwind Color Mapping:**

| Value | Border | Badge BG | Badge Text |
|-------|--------|----------|------------|
| `draft` | `border-r-gray-400` | `bg-gray-100` | `text-gray-700` |
| `active` | `border-r-emerald-500` | `bg-emerald-100` | `text-emerald-700` |
| `inactive` | `border-r-amber-500` | `bg-amber-100` | `text-amber-700` |
| `archived` | `border-r-slate-400` | `bg-slate-100` | `text-slate-700` |
| `deleted` | `border-r-red-500` | `bg-red-100` | `text-red-700` |

**Used By:** Project-defined domain tables (not used by core tables directly).

**Extension:** Projects can add values via `ALTER TYPE entity_status ADD VALUE 'pending_review';`

---

## task_status

Status lifecycle for tasks.

```sql
CREATE TYPE task_status AS ENUM (
  'pending', 'in_progress', 'completed', 'cancelled'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `pending` | ממתין | Not started | Task created, awaiting work |
| `in_progress` | בביצוע | Currently being worked on | Assignee started working |
| `completed` | הושלם | Finished successfully | Task done, sets `completed_at` |
| `cancelled` | בוטל | Abandoned or no longer needed | Task no longer relevant |

**Tailwind Color Mapping:**

| Value | Border | Badge BG | Badge Text | Icon |
|-------|--------|----------|------------|------|
| `pending` | `border-r-gray-400` | `bg-gray-100` | `text-gray-700` | `Clock` |
| `in_progress` | `border-r-blue-500` | `bg-blue-100` | `text-blue-700` | `Loader2` |
| `completed` | `border-r-emerald-500` | `bg-emerald-100` | `text-emerald-700` | `CheckCircle2` |
| `cancelled` | `border-r-red-500` | `bg-red-100` | `text-red-700` | `XCircle` |

**Used By:** `tasks.status`

**State Transitions:**
```
pending ──► in_progress ──► completed
   │              │
   └──► cancelled ◄──┘
```

---

## task_priority

Priority levels for tasks.

```sql
CREATE TYPE task_priority AS ENUM (
  'low', 'medium', 'high', 'urgent'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `low` | נמוכה | Can wait | Nice-to-have, no deadline pressure |
| `medium` | בינונית | Normal priority | Default for most tasks |
| `high` | גבוהה | Needs attention soon | Important, approaching deadline |
| `urgent` | דחוף | Immediate action required | Blocking or critical |

**Tailwind Color Mapping:**

| Value | Border | Badge BG | Badge Text | Icon |
|-------|--------|----------|------------|------|
| `low` | `border-r-slate-400` | `bg-slate-100` | `text-slate-700` | `ArrowDown` |
| `medium` | `border-r-blue-500` | `bg-blue-100` | `text-blue-700` | `Minus` |
| `high` | `border-r-orange-500` | `bg-orange-100` | `text-orange-700` | `ArrowUp` |
| `urgent` | `border-r-red-600` | `bg-red-100` | `text-red-700` | `AlertTriangle` |

**Used By:** `tasks.priority`

---

## notification_type

Categories of notifications.

```sql
CREATE TYPE notification_type AS ENUM (
  'info', 'success', 'warning', 'error', 'task', 'system'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `info` | מידע | General information | FYI messages, updates |
| `success` | הצלחה | Positive outcome | Action completed successfully |
| `warning` | אזהרה | Attention needed | Approaching limits, potential issues |
| `error` | שגיאה | Something failed | Action failed, requires attention |
| `task` | משימה | Task-related | Task assignment, status change, comment |
| `system` | מערכת | System notification | Maintenance, updates, announcements |

**Tailwind Color Mapping:**

| Value | Badge BG | Badge Text | Icon |
|-------|----------|------------|------|
| `info` | `bg-blue-100` | `text-blue-700` | `Info` |
| `success` | `bg-emerald-100` | `text-emerald-700` | `CheckCircle2` |
| `warning` | `bg-amber-100` | `text-amber-700` | `AlertTriangle` |
| `error` | `bg-red-100` | `text-red-700` | `XCircle` |
| `task` | `bg-violet-100` | `text-violet-700` | `ClipboardList` |
| `system` | `bg-gray-100` | `text-gray-700` | `Settings` |

**Used By:** `notifications.type`

---

## audit_action_type

Types of auditable data mutations.

```sql
CREATE TYPE audit_action_type AS ENUM (
  'create', 'update', 'delete', 'restore', 'login'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `create` | יצירה | New record created | INSERT operation |
| `update` | עדכון | Existing record modified | UPDATE operation |
| `delete` | מחיקה | Record soft-deleted | Setting `deleted_at` |
| `restore` | שחזור | Record un-deleted | Clearing `deleted_at` |
| `login` | כניסה | User authentication | Successful login event |

**Used By:** `audit_logs.action`

**Extension:** Projects may add values for domain-specific actions: `approve`, `reject`, `export`, `import`.

---

## file_type

Logical categories for uploaded files.

```sql
CREATE TYPE file_type AS ENUM (
  'image', 'document', 'spreadsheet', 'pdf', 'video', 'other'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `image` | תמונה | Photos, graphics | JPEG, PNG, GIF, WebP, SVG |
| `document` | מסמך | Text documents | DOCX, TXT, RTF |
| `spreadsheet` | גיליון | Spreadsheet files | XLSX, CSV |
| `pdf` | PDF | Portable documents | PDF files |
| `video` | סרטון | Video content | MP4, MOV, WebM |
| `other` | אחר | Unclassified | Any type not covered above |

**Tailwind Color Mapping:**

| Value | Icon Color | Icon |
|-------|-----------|------|
| `image` | `text-emerald-600` | `Image` |
| `document` | `text-blue-600` | `FileText` |
| `spreadsheet` | `text-green-600` | `Table` |
| `pdf` | `text-red-600` | `FileText` |
| `video` | `text-violet-600` | `Video` |
| `other` | `text-gray-500` | `File` |

**Used By:** `files.file_type`

**MIME Type Mapping (application code):**

```typescript
const FILE_TYPE_MAP: Record<string, FileType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
};
```

---

## permission_scope

Controls whether a permission applies to own records or all records.

```sql
CREATE TYPE permission_scope AS ENUM (
  'own', 'team', 'all'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `own` | עצמי | Only the user's own records | Default for regular users |
| `team` | צוות | Records within user's team | Team leads, department heads |
| `all` | הכל | All records regardless of owner | Managers, admins |

**Used By:** `permissions.scope`

**Resolution in Application Code:**

```typescript
function canAccess(user: User, permission: Permission, entityOwnerId: string): boolean {
  switch (permission.scope) {
    case 'own':
      return entityOwnerId === user.id;
    case 'team':
      return user.teamMemberIds.includes(entityOwnerId);
    case 'all':
      return true;
  }
}
```

---

## user_status

Account lifecycle status.

```sql
CREATE TYPE user_status AS ENUM (
  'active', 'inactive', 'suspended', 'pending'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `active` | פעיל | Normal active account | User can log in and use the system |
| `inactive` | לא פעיל | Deactivated account | Left the organization, voluntarily disabled |
| `suspended` | מושעה | Temporarily blocked | Policy violation, pending investigation |
| `pending` | ממתין לאישור | Awaiting activation | Registration complete, admin approval needed |

**Tailwind Color Mapping:**

| Value | Border | Badge BG | Badge Text |
|-------|--------|----------|------------|
| `active` | `border-r-emerald-500` | `bg-emerald-100` | `text-emerald-700` |
| `inactive` | `border-r-gray-400` | `bg-gray-100` | `text-gray-700` |
| `suspended` | `border-r-red-500` | `bg-red-100` | `text-red-700` |
| `pending` | `border-r-amber-500` | `bg-amber-100` | `text-amber-700` |

**Used By:** `users.status`

**Login Check:**
```typescript
// Reject login for non-active users
if (user.status !== 'active') {
  throw new AuthError(`Account is ${user.status}`);
}
```

---

## notification_channel

Delivery method for notifications.

```sql
CREATE TYPE notification_channel AS ENUM (
  'in_app', 'email', 'push', 'sms'
);
```

| Value | Hebrew | Description | When to Use |
|-------|--------|-------------|-------------|
| `in_app` | באפליקציה | In-app notification bell | Default for all notifications |
| `email` | אימייל | Email delivery | Important updates, summaries |
| `push` | פוש | Browser/mobile push | Urgent items, real-time alerts |
| `sms` | SMS | Text message | Critical alerts, 2FA |

**Used By:** `notifications.channel`

**Notes:**
- A single notification event may create multiple records (one per channel).
- Channel preferences are stored per user in `users.metadata.notification_preferences` or in `settings`.

---

## tag_color

Predefined color palette for tags.

```sql
CREATE TYPE tag_color AS ENUM (
  'gray', 'red', 'orange', 'amber', 'green',
  'emerald', 'blue', 'violet', 'pink', 'cyan'
);
```

| Value | Hebrew | Tailwind BG | Tailwind Text | Tailwind Border | Hex (reference) |
|-------|--------|-------------|---------------|-----------------|-----------------|
| `gray` | אפור | `bg-gray-100` | `text-gray-700` | `border-gray-300` | `#6b7280` |
| `red` | אדום | `bg-red-100` | `text-red-700` | `border-red-300` | `#ef4444` |
| `orange` | כתום | `bg-orange-100` | `text-orange-700` | `border-orange-300` | `#f97316` |
| `amber` | ענבר | `bg-amber-100` | `text-amber-700` | `border-amber-300` | `#f59e0b` |
| `green` | ירוק | `bg-green-100` | `text-green-700` | `border-green-300` | `#22c55e` |
| `emerald` | אמרלד | `bg-emerald-100` | `text-emerald-700` | `border-emerald-300` | `#10b981` |
| `blue` | כחול | `bg-blue-100` | `text-blue-700` | `border-blue-300` | `#3b82f6` |
| `violet` | סגול | `bg-violet-100` | `text-violet-700` | `border-violet-300` | `#8b5cf6` |
| `pink` | ורוד | `bg-pink-100` | `text-pink-700` | `border-pink-300` | `#ec4899` |
| `cyan` | תכלת | `bg-cyan-100` | `text-cyan-700` | `border-cyan-300` | `#06b6d4` |

**Used By:** `tags.color`

**Rendering Tags:**

```typescript
const TAG_COLORS: Record<TagColor, { bg: string; text: string; border: string }> = {
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300' },
  red:     { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
  green:   { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300' },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-300' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300' },
};

function TagBadge({ name, color }: { name: string; color: TagColor }) {
  const colors = TAG_COLORS[color];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {name}
    </span>
  );
}
```

---

## TypeScript Type Generation

Generate TypeScript types from PostgreSQL enums for type-safe usage:

```typescript
// lib/types/database-enums.ts
// Auto-generated or manually maintained to match PostgreSQL enums

export type EntityStatus = 'draft' | 'active' | 'inactive' | 'archived' | 'deleted';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'task' | 'system';
export type AuditActionType = 'create' | 'update' | 'delete' | 'restore' | 'login';
export type FileType = 'image' | 'document' | 'spreadsheet' | 'pdf' | 'video' | 'other';
export type PermissionScope = 'own' | 'team' | 'all';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';
export type TagColor = 'gray' | 'red' | 'orange' | 'amber' | 'green' | 'emerald' | 'blue' | 'violet' | 'pink' | 'cyan';
```

If using Supabase CLI with `supabase gen types typescript`, enums are extracted automatically from the database schema.

---

## Extending Enums

### Adding Values (Safe)

```sql
-- Add a new value to an existing enum
ALTER TYPE task_status ADD VALUE 'on_hold';
ALTER TYPE notification_type ADD VALUE 'mention';
```

**Rules:**
- Adding values is safe and non-breaking.
- New values are appended to the end of the enum.
- Use `ADD VALUE IF NOT EXISTS` to make migrations idempotent.
- Update the TypeScript types file after adding values.

### Removing Values (Dangerous)

PostgreSQL does not support `DROP VALUE` from an enum. To remove a value:

1. Create a new enum type without the unwanted value.
2. Migrate all columns to the new type.
3. Drop the old type.
4. Rename the new type.

**This is rarely needed. Prefer deactivating values in application code rather than removing from the enum.**

### Project-Specific Enums

Projects should define their own enums in project migrations, never modify core enums:

```sql
-- Project-specific enum in project migration
CREATE TYPE reservation_status AS ENUM (
  'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
);
```

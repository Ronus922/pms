# Audit Logs

> Immutable trail of all mutations across the system.
> Every create, update, delete, and security event is recorded for compliance, debugging, and accountability.

---

## Table Structure

### audit_logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | YES | `NULL` | FK to users -- who performed the action (NULL for system actions) |
| `action` | `audit_action_type` | NO | -- | Type of action performed |
| `entity_type` | `varchar(50)` | NO | -- | Target table name (e.g., `task`, `user`, `setting`) |
| `entity_id` | `uuid` | YES | `NULL` | Target record ID (NULL for bulk/system operations) |
| `changes` | `jsonb` | NO | `'{}'` | Field-level diff of what changed |
| `metadata` | `jsonb` | NO | `'{}'` | Additional context (request info, batch ID, etc.) |
| `ip_address` | `inet` | YES | `NULL` | Client IP address |
| `user_agent` | `text` | YES | `NULL` | Client user-agent string |
| `created_at` | `timestamptz` | NO | `now()` | When the action occurred |

**Indexes:**
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_entity` on `(entity_type, entity_id)`
- `idx_audit_logs_action` on `action`
- `idx_audit_logs_created_at` on `created_at DESC`

**Relationships:**
- `user_id` -> `users(id)` ON DELETE SET NULL

**RLS Policies:**
- SELECT: Admin and super_admin roles only
- INSERT: All authenticated users (via server-side helper)
- UPDATE/DELETE: **Never** -- audit logs are immutable

---

## audit_action_type Enum

```sql
CREATE TYPE audit_action_type AS ENUM (
  'create', 'update', 'delete', 'login', 'logout'
);
```

| Value | Hebrew | When to Use |
|-------|--------|-------------|
| `create` | יצירה | New entity inserted |
| `update` | עדכון | Existing entity modified |
| `delete` | מחיקה | Entity soft-deleted or hard-deleted |
| `login` | כניסה | Successful authentication |
| `logout` | יציאה | User logged out or session expired |

> **Note:** Extend this enum per project. Common additions: `export`, `import`, `permission_change`, `permission_denied`, `bulk_update`, `restore`.

---

## Changes Column Format

The `changes` column stores a JSON diff of modified fields. Each key is a field name, and the value contains `old` and `new` values.

```json
{
  "status": { "old": "pending", "new": "completed" },
  "assigned_to": { "old": null, "new": "a1b2c3d4-..." },
  "priority": { "old": "low", "new": "high" }
}
```

**For `create` actions:** Only `new` values are stored (no `old`).

```json
{
  "title": { "new": "Clean room 204" },
  "status": { "new": "pending" },
  "priority": { "new": "medium" }
}
```

**For `delete` actions:** Only `old` values are stored (snapshot before deletion).

```json
{
  "title": { "old": "Clean room 204" },
  "status": { "old": "completed" }
}
```

---

## TypeScript Helper

### createAuditLog()

Core function called from Server Actions after every mutation.

```typescript
import { createClient } from "@/lib/supabase/server"

interface AuditLogEntry {
  userId: string | null
  action: "create" | "update" | "delete" | "login" | "logout"
  entityType: string
  entityId?: string
  changes?: Record<string, { old?: unknown; new?: unknown }>
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from("audit_logs").insert({
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    changes: entry.changes ?? {},
    metadata: entry.metadata ?? {},
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  })

  if (error) {
    // Audit log failures should NOT block the primary operation.
    // Log to external monitoring (Sentry, Better Stack, etc.)
    // Never throw -- the user action already succeeded.
  }
}
```

### buildChanges() -- Diff Helper

Computes the `changes` object by comparing old and new records.

```typescript
export function buildChanges<T extends Record<string, unknown>>(
  oldRecord: T,
  newRecord: Partial<T>,
  excludeFields: string[] = ["updated_at"]
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newRecord)) {
    if (excludeFields.includes(key)) continue
    const oldVal = oldRecord[key]
    const newVal = newRecord[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal }
    }
  }

  return changes
}
```

---

## Usage in Server Actions

### Example: Updating a Task

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAuditLog, buildChanges } from "@/lib/audit"
import { headers } from "next/headers"

export async function updateTask(taskId: string, data: TaskUpdateInput) {
  const supabase = await createClient()
  const headersList = await headers()

  // 1. Fetch current state for diff
  const { data: oldTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single()

  if (!oldTask) throw new Error("Task not found")

  // 2. Perform the update
  const { data: updatedTask, error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  // 3. Log the audit trail
  await createAuditLog({
    userId: oldTask.assigned_to, // or get from session
    action: "update",
    entityType: "task",
    entityId: taskId,
    changes: buildChanges(oldTask, data),
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  })

  return updatedTask
}
```

### Example: Login Event

```typescript
await createAuditLog({
  userId: user.id,
  action: "login",
  entityType: "auth",
  metadata: {
    method: "email_password",
    provider: "supabase",
  },
  ipAddress,
  userAgent,
})
```

---

## What to Log

### Always Log

| Event | action | entity_type | Notes |
|-------|--------|-------------|-------|
| Entity created | `create` | table name | Full new record in changes |
| Entity updated | `update` | table name | Field-level diff |
| Entity deleted | `delete` | table name | Snapshot of deleted record |
| User login | `login` | `auth` | Method in metadata |
| User logout | `logout` | `auth` | -- |
| Permission changed | `update` | `user_permission` | Old/new permission state |
| Role changed | `update` | `user` | Old/new role_id |
| Data exported | `export`* | `report` | Format, filters in metadata |
| Permission denied | `permission_denied`* | module name | Attempted action in metadata |

> *Requires extending the `audit_action_type` enum.

### Never Log

| Event | Reason |
|-------|--------|
| Read/SELECT operations | Too high volume, no mutation |
| Internal cron/system jobs | Use separate system logs |
| Health check pings | Noise |
| Real-time subscription events | Handled by Supabase internally |
| Temporary/draft auto-saves | Log only on explicit save |

---

## Querying Audit Logs

### By Entity (show audit trail for a specific record)

```sql
SELECT al.*, u.full_name as user_name
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.entity_type = 'task'
  AND al.entity_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY al.created_at DESC;
```

### By User (show all actions by a user)

```sql
SELECT al.*
FROM audit_logs al
WHERE al.user_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY al.created_at DESC
LIMIT 50;
```

### By Action Type

```sql
SELECT al.*, u.full_name
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.action = 'delete'
  AND al.created_at >= now() - interval '7 days'
ORDER BY al.created_at DESC;
```

### By Date Range

```sql
SELECT al.*
FROM audit_logs al
WHERE al.created_at BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY al.created_at DESC;
```

### TypeScript Query Helper

```typescript
interface AuditLogQuery {
  entityType?: string
  entityId?: string
  userId?: string
  action?: string
  from?: string  // ISO date
  to?: string    // ISO date
  limit?: number
  offset?: number
}

export async function queryAuditLogs(query: AuditLogQuery) {
  const supabase = await createClient()

  let q = supabase
    .from("audit_logs")
    .select("*, user:users(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 50)

  if (query.offset) q = q.range(query.offset, query.offset + (query.limit ?? 50) - 1)
  if (query.entityType) q = q.eq("entity_type", query.entityType)
  if (query.entityId) q = q.eq("entity_id", query.entityId)
  if (query.userId) q = q.eq("user_id", query.userId)
  if (query.action) q = q.eq("action", query.action)
  if (query.from) q = q.gte("created_at", query.from)
  if (query.to) q = q.lte("created_at", query.to)

  return q
}
```

---

## Retention Policy

Audit logs are **append-only** and should be kept for as long as the project requires:

| Policy | Retention | Use Case |
|--------|-----------|----------|
| Default | Forever | Small-medium deployments |
| Compliance | 7 years | Financial/legal requirements |
| Performance | 1-2 years | High-traffic deployments |

### Partitioning for Large Deployments

For systems generating >100K audit entries per month, partition by month:

```sql
CREATE TABLE audit_logs (
  id uuid DEFAULT gen_random_uuid(),
  -- ... all columns ...
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### Archival

For expired partitions, detach and move to cold storage:

```sql
ALTER TABLE audit_logs DETACH PARTITION audit_logs_2024_01;
-- Export to CSV/S3, then DROP TABLE audit_logs_2024_01;
```

---

## Security

- **RLS**: Only `admin` and `super_admin` can SELECT audit logs.
- **Immutability**: No UPDATE or DELETE policies. Audit logs cannot be modified.
- **No raw exposure**: Regular users never see the audit_logs table directly. Filtered, formatted views are presented in the UI.
- **Sensitive data**: Never store passwords, tokens, or full credit card numbers in `changes`. Mask sensitive fields before logging.

```typescript
const SENSITIVE_FIELDS = ["password", "token", "credit_card", "ssn"]

function sanitizeChanges(changes: Record<string, unknown>) {
  const sanitized = { ...changes }
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = { old: "[REDACTED]", new: "[REDACTED]" }
    }
  }
  return sanitized
}
```

---

## UI Integration

### Entity SidePanel -- Audit Trail Tab

Every entity SidePanel includes a "היסטוריה" (History) tab showing the audit trail for that entity:

```
+-------------------------------------------+
| היסטוריה                                   |
+-------------------------------------------+
| 10/04/2026 14:32  אלמוג כהן               |
| עדכון — סטטוס: ממתין → הושלם              |
|                                           |
| 10/04/2026 09:15  שרה לוי                 |
| עדכון — הוקצה ל: אלמוג כהן               |
|                                           |
| 09/04/2026 16:00  שרה לוי                 |
| יצירה — משימה חדשה                        |
+-------------------------------------------+
```

### Dashboard Activity Log

Recent audit entries across all entities, filtered by the current user's permissions:

```
+-------------------------------------------+
| יומן פעילות                                |
+-------------------------------------------+
| [delete] אלמוג מחק הזמנה #1042           |
| [update] שרה עדכנה חדר 204               |
| [create] מערכת — משימת ניקיון אוטומטית    |
| [login]  אלמוג התחבר למערכת              |
+-------------------------------------------+
```

### Hebrew Labels for Actions

| action | Hebrew Label |
|--------|-------------|
| `create` | יצירה |
| `update` | עדכון |
| `delete` | מחיקה |
| `login` | כניסה |
| `logout` | יציאה |
| `export` | ייצוא |
| `permission_denied` | גישה נדחתה |

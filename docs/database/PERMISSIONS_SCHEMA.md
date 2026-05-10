# Permissions Schema

> Role-based access control (RBAC) with per-user overrides, hierarchical scopes, and time-limited grants.
> 3-table core model (roles, permissions, role_permissions) + override table (user_permissions).

---

## Architecture Overview

```
roles ──────────┐
                ├──→ role_permissions ←──┐
permissions ────┘                        │
    │                                    │
    └──→ user_permissions (overrides) ───┘
                ↓
         users.role_id → roles
```

**Resolution order (fail-closed):**

1. Check `user_permissions` for explicit **deny** -> DENY
2. Check `user_permissions` for explicit **grant** -> GRANT (with scope)
3. Check `role_permissions` for the user's role -> GRANT/DENY (with scope)
4. **Default: DENY** (no matching permission = denied)

---

## Table Structure

### roles

Named roles that group permissions together. Hierarchical via `level`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `varchar(100)` | NO | -- | Unique role name (`super_admin`, `admin`, `manager`, etc.) |
| `display_name` | `varchar(255)` | NO | -- | Hebrew display label |
| `description` | `text` | YES | `NULL` | Role description |
| `level` | `integer` | NO | `99` | Hierarchy level (0 = highest, 99 = lowest) |
| `is_system` | `boolean` | NO | `false` | Protected from deletion |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |

**Key constraints:**
- `UNIQUE` on `name`
- `is_system = true` roles cannot be deleted or renamed in application code

**Default seed roles:**

| name | display_name | level | is_system |
|------|-------------|-------|-----------|
| `super_admin` | סופר אדמין | 0 | true |
| `admin` | מנהל | 1 | true |
| `manager` | מנהל משמרת | 2 | false |
| `user` | משתמש | 3 | false |
| `viewer` | צופה בלבד | 4 | false |

**Hierarchy rule:** A user can only manage roles with a **higher** level number than their own. Level 0 (super_admin) can manage everyone.

---

### permissions

Individual permission definitions. Each represents a single capability.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `key` | `varchar(100)` | NO | -- | Unique permission key (`module:action`) |
| `display_name` | `varchar(255)` | NO | -- | Hebrew label |
| `description` | `text` | YES | `NULL` | What this permission allows |
| `module` | `varchar(100)` | NO | -- | Grouping module name |
| `scope` | `permission_scope` | NO | `'all'` | Default scope |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Key format:** `module:action`

```
tasks:view
tasks:create
tasks:update
tasks:delete
users:view
users:create
settings:manage
reports:export
```

---

### role_permissions

N:M join linking roles to permissions, with scope override.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `role_id` | `uuid` | NO | -- | FK to roles |
| `permission_id` | `uuid` | NO | -- | FK to permissions |
| `scope` | `permission_scope` | NO | `'all'` | Scope for this role-permission pair |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Constraints:**
- `UNIQUE` on `(role_id, permission_id)`
- `role_id` -> `roles(id)` ON DELETE CASCADE
- `permission_id` -> `permissions(id)` ON DELETE CASCADE

---

### user_permissions

Direct per-user overrides. Takes precedence over role_permissions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | -- | FK to users |
| `permission_id` | `uuid` | NO | -- | FK to permissions |
| `granted` | `boolean` | NO | `true` | `true` = grant, `false` = deny |
| `scope` | `permission_scope` | YES | `NULL` | Scope override (NULL = inherit from permission default) |
| `expires_at` | `timestamptz` | YES | `NULL` | When this override expires (NULL = permanent) |
| `reason` | `text` | YES | `NULL` | Why this override was granted/denied |
| `created_by` | `uuid` | YES | `NULL` | FK to users -- who granted this |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Constraints:**
- `UNIQUE` on `(user_id, permission_id)`
- `user_id` -> `users(id)` ON DELETE CASCADE
- `permission_id` -> `permissions(id)` ON DELETE CASCADE

---

## permission_scope Enum

```sql
CREATE TYPE permission_scope AS ENUM (
  'all', 'own', 'department'
);
```

| Scope | Hebrew | SQL Translation | Use Case |
|-------|--------|-----------------|----------|
| `all` | הכל | No additional WHERE clause | Admin-level access |
| `own` | שלי בלבד | `WHERE created_by = :userId OR assigned_to = :userId` | Users see only their own records |
| `department` | מחלקה | `WHERE department_id = :userDepartmentId` | Departmental access |

> Extend per project. Common additions: `assigned` (only records assigned to the user), `team` (records of team members).

### Scope to SQL WHERE Clause

```typescript
export function scopeToWhere(
  scope: "all" | "own" | "department",
  userId: string,
  userDepartmentId?: string
): string {
  switch (scope) {
    case "all":
      return "" // No restriction
    case "own":
      return `AND (created_by = '${userId}' OR assigned_to = '${userId}')`
    case "department":
      if (!userDepartmentId) return `AND (created_by = '${userId}')`
      return `AND department_id = '${userDepartmentId}'`
    default:
      return "AND false" // Fail closed
  }
}
```

For Supabase client queries:

```typescript
export function applyScopeFilter(
  query: SupabaseQuery,
  scope: "all" | "own" | "department",
  userId: string,
  userDepartmentId?: string
) {
  switch (scope) {
    case "all":
      return query
    case "own":
      return query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
    case "department":
      return userDepartmentId
        ? query.eq("department_id", userDepartmentId)
        : query.eq("created_by", userId)
    default:
      return query.eq("id", "impossible") // Fail closed
  }
}
```

---

## Permission Resolution Algorithm

### checkPermission()

The core function. Returns whether a user can perform an action and with what scope.

```typescript
import { createClient } from "@/lib/supabase/server"

interface PermissionResult {
  allowed: boolean
  scope: "all" | "own" | "department" | null
  source: "user_override" | "role" | "default_deny"
}

export async function checkPermission(
  userId: string,
  module: string,
  action: string
): Promise<PermissionResult> {
  const supabase = await createClient()
  const permissionKey = `${module}:${action}`

  // Step 1: Check user_permissions for explicit override
  const { data: userPerm } = await supabase
    .from("user_permissions")
    .select(`
      granted,
      scope,
      expires_at,
      permission:permissions!inner(key)
    `)
    .eq("user_id", userId)
    .eq("permission.key", permissionKey)
    .single()

  if (userPerm) {
    // Check expiration
    if (userPerm.expires_at && new Date(userPerm.expires_at) < new Date()) {
      // Expired -- treat as if it doesn't exist, fall through to role check
    } else if (!userPerm.granted) {
      // Explicit deny -- highest priority
      return { allowed: false, scope: null, source: "user_override" }
    } else {
      // Explicit grant
      return {
        allowed: true,
        scope: userPerm.scope ?? "all",
        source: "user_override",
      }
    }
  }

  // Step 2: Check role_permissions via user's role
  const { data: rolePerm } = await supabase
    .from("users")
    .select(`
      role:roles!inner(
        role_permissions(
          scope,
          permission:permissions!inner(key)
        )
      )
    `)
    .eq("id", userId)
    .single()

  const rolePermission = rolePerm?.role?.role_permissions?.find(
    (rp: { permission: { key: string } }) => rp.permission.key === permissionKey
  )

  if (rolePermission) {
    return {
      allowed: true,
      scope: rolePermission.scope ?? "all",
      source: "role",
    }
  }

  // Step 3: Default deny
  return { allowed: false, scope: null, source: "default_deny" }
}
```

### Convenience Helpers

```typescript
export async function canView(userId: string, module: string): Promise<boolean> {
  const result = await checkPermission(userId, module, "view")
  return result.allowed
}

export async function canEdit(userId: string, module: string): Promise<boolean> {
  const result = await checkPermission(userId, module, "update")
  return result.allowed
}

export async function canCreate(userId: string, module: string): Promise<boolean> {
  const result = await checkPermission(userId, module, "create")
  return result.allowed
}

export async function canDelete(userId: string, module: string): Promise<boolean> {
  const result = await checkPermission(userId, module, "delete")
  return result.allowed
}
```

---

## React Hook: usePermission()

Client-side permission check using cached user permissions.

```typescript
"use client"

import { useMemo } from "react"
import { useTenant } from "@/lib/hooks/use-tenant"

/**
 * Check if the current user has a specific permission.
 * Uses cached role + user_permissions from the tenant context.
 */
export function usePermission(module: string, action: string): boolean {
  const { user, role, permissions } = useTenant()

  return useMemo(() => {
    if (!user || !role) return false

    // Super admin bypass
    if (role === "super_admin") return true

    // Admin access (except super_admin-only modules)
    if (role === "admin") {
      const SUPER_ADMIN_ONLY = ["billing"]
      return !SUPER_ADMIN_ONLY.includes(module)
    }

    // Check loaded permissions
    const perm = permissions?.find((p) => p.module === module)
    if (!perm) return false

    switch (action) {
      case "view": return perm.canView
      case "edit":
      case "update":
      case "create": return perm.canEdit
      case "delete": return perm.canDelete
      default: return false
    }
  }, [user, role, permissions, module, action])
}

/**
 * Check multiple permissions at once.
 */
export function usePermissions(
  checks: Array<{ module: string; action: string }>
): boolean[] {
  const { user, role, permissions } = useTenant()

  return useMemo(() => {
    return checks.map(({ module, action }) => {
      if (!user || !role) return false
      if (role === "super_admin") return true
      if (role === "admin") return !["billing"].includes(module)

      const perm = permissions?.find((p) => p.module === module)
      if (!perm) return false

      switch (action) {
        case "view": return perm.canView
        case "edit":
        case "update":
        case "create": return perm.canEdit
        case "delete": return perm.canDelete
        default: return false
      }
    })
  }, [user, role, permissions, checks])
}
```

### Usage in Components

```tsx
function TaskActions({ taskId }: { taskId: string }) {
  const canEditTasks = usePermission("tasks", "edit")
  const canDeleteTasks = usePermission("tasks", "delete")

  return (
    <div className="flex gap-2">
      {canEditTasks && (
        <button className="px-4 py-2">עריכה</button>
      )}
      {canDeleteTasks && (
        <button className="px-4 py-2 text-red-600">מחיקה</button>
      )}
    </div>
  )
}
```

---

## Adding Permissions for New Modules

When adding a new module (e.g., `invoices`), follow this pattern:

### Step 1: Insert Permissions

```sql
INSERT INTO permissions (key, display_name, description, module) VALUES
  ('invoices:view',   'צפייה בחשבוניות',  'צפייה ברשימת חשבוניות ופרטיהן', 'invoices'),
  ('invoices:create', 'יצירת חשבונית',   'יצירת חשבוניות חדשות',          'invoices'),
  ('invoices:update', 'עריכת חשבונית',   'עדכון פרטי חשבונית קיימת',      'invoices'),
  ('invoices:delete', 'מחיקת חשבונית',   'מחיקת חשבוניות',               'invoices'),
  ('invoices:export', 'ייצוא חשבוניות',  'ייצוא חשבוניות ל-PDF/CSV',      'invoices');
```

### Step 2: Assign to Roles

```sql
-- Admin gets full access
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'all'
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.module = 'invoices';

-- Manager gets view + create (own scope)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'own'
FROM roles r, permissions p
WHERE r.name = 'manager' AND p.key IN ('invoices:view', 'invoices:create');

-- User gets view only (own scope)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'own'
FROM roles r, permissions p
WHERE r.name = 'user' AND p.key = 'invoices:view';
```

### Step 3: Migration Pattern for Existing Deployments

```sql
-- Safe migration: only insert if not exists
INSERT INTO permissions (key, display_name, description, module)
SELECT 'invoices:view', 'צפייה בחשבוניות', 'צפייה ברשימת חשבוניות', 'invoices'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'invoices:view');

-- Assign to admin role (idempotent)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'all'
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.module = 'invoices'
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

---

## Time-Limited Permissions

The `expires_at` column in `user_permissions` enables temporary access grants.

### Use Cases

| Scenario | Duration | Example |
|----------|----------|---------|
| Temporary admin access | 24 hours | Developer needs access for debugging |
| Seasonal coverage | 2 weeks | Employee covering for someone on vacation |
| Trial period | 30 days | New hire with gradually expanding access |
| Emergency access | 1 hour | Urgent issue requiring elevated permissions |

### Granting Temporary Access

```typescript
export async function grantTemporaryPermission(
  userId: string,
  permissionKey: string,
  durationHours: number,
  grantedBy: string,
  reason: string
): Promise<void> {
  const supabase = await createClient()

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()

  // Get permission ID
  const { data: perm } = await supabase
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .single()

  if (!perm) throw new Error("Permission not found")

  const { error } = await supabase
    .from("user_permissions")
    .upsert({
      user_id: userId,
      permission_id: perm.id,
      granted: true,
      scope: "all",
      expires_at: expiresAt,
      reason,
      created_by: grantedBy,
    })

  if (error) throw new Error(error.message)
}
```

### Cleanup Expired Permissions

```sql
-- Run periodically to clean up expired overrides
DELETE FROM user_permissions
WHERE expires_at IS NOT NULL
  AND expires_at < now();
```

---

## Server Action Guard

Protect Server Actions with permission checks:

```typescript
"use server"

import { checkPermission } from "@/lib/permissions"
import { getCurrentUser } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const { allowed } = await checkPermission(user.id, "tasks", "delete")

  if (!allowed) {
    // Log the denied attempt
    await createAuditLog({
      userId: user.id,
      action: "permission_denied",
      entityType: "task",
      entityId: taskId,
      metadata: { attempted_action: "delete" },
    })
    throw new Error("Permission denied")
  }

  // Proceed with deletion...
}
```

---

## Default Seed Data

### seed.sql

```sql
-- System roles
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
  ('super_admin', 'סופר אדמין', 'גישה מלאה לכל המערכת', 0, true),
  ('admin',       'מנהל',       'גישה תפעולית מלאה',    1, true),
  ('manager',     'מנהל משמרת', 'גישה לניהול שוטף',     2, false),
  ('user',        'משתמש',      'גישה בסיסית',          3, false),
  ('viewer',      'צופה בלבד',  'צפייה בלבד ללא עריכה', 4, false);

-- Core permissions (per module: view, create, update, delete)
DO $$
DECLARE
  modules text[] := ARRAY['tasks', 'users', 'settings', 'reports'];
  actions text[] := ARRAY['view', 'create', 'update', 'delete'];
  m text;
  a text;
BEGIN
  FOREACH m IN ARRAY modules LOOP
    FOREACH a IN ARRAY actions LOOP
      INSERT INTO permissions (key, display_name, module)
      VALUES (
        m || ':' || a,
        a || ' ' || m,
        m
      )
      ON CONFLICT (key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Admin gets all permissions with 'all' scope
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'all'
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager gets all view + create/update (own scope)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'own'
FROM roles r, permissions p
WHERE r.name = 'manager' AND p.key NOT LIKE '%:delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- User gets view only (own scope)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'own'
FROM roles r, permissions p
WHERE r.name = 'user' AND p.key LIKE '%:view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer gets view only (all scope -- can see everything but change nothing)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'all'
FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.key LIKE '%:view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

---

## Hebrew Labels

| Term | Hebrew |
|------|--------|
| Permissions | הרשאות |
| Role | תפקיד |
| Module | מודול |
| Scope | טווח |
| Grant | הענקה |
| Deny | דחייה |
| View | צפייה |
| Create | יצירה |
| Edit / Update | עריכה |
| Delete | מחיקה |
| All | הכל |
| Own only | שלי בלבד |
| Department | מחלקה |
| Temporary permission | הרשאה זמנית |
| Expires at | תוקף עד |
| Granted by | הוענק על ידי |
| Permission denied | גישה נדחתה |
| System role | תפקיד מערכת |

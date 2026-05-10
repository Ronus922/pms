# Database Rules & Conventions

> Core rules for the reusable database foundation.
> These apply to every project built on this schema.

---

## 1. Primary Keys

- **All tables** use `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- Never use serial/integer PKs.
- Never expose internal IDs in URLs without authorization checks.

```sql
CREATE TABLE example (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ...
);
```

---

## 2. Timestamps

### created_at (required on ALL tables)

```sql
created_at timestamptz NOT NULL DEFAULT now()
```

### updated_at (required on tables with mutable data)

```sql
updated_at timestamptz NOT NULL DEFAULT now()
```

Every table with `updated_at` must attach the `trigger_set_updated_at` trigger:

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON example
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
```

---

## 3. Soft Delete

Mutable entities use soft delete via a nullable `deleted_at` column:

```sql
deleted_at timestamptz DEFAULT NULL
```

- `NULL` = active record.
- Non-null = soft-deleted (stores deletion timestamp).
- **All queries** must filter `WHERE deleted_at IS NULL` unless explicitly including deleted records.
- Partial indexes should always include `WHERE deleted_at IS NULL`.

```sql
CREATE INDEX idx_example_status
  ON example (status)
  WHERE deleted_at IS NULL;
```

---

## 4. Audit Columns

Tables that track who created/modified a record include:

```sql
created_by uuid REFERENCES users(id),
updated_by uuid REFERENCES users(id)
```

- `created_by` is set once at INSERT and never changed.
- `updated_by` is set on every UPDATE.
- Both are nullable to support system-generated records.

---

## 5. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | `snake_case`, plural for readability | `users`, `audit_logs` |
| Join tables | Both entity names, alphabetical | `role_permissions`, `entity_tags` |
| Columns | `snake_case` | `first_name`, `created_at` |
| Foreign keys | `referenced_table_singular_id` | `user_id`, `role_id`, `category_id` |
| Indexes | `idx_table_column(s)` | `idx_users_email`, `idx_tasks_status_priority` |
| Triggers | `set_updated_at` on table | `set_updated_at` |
| Enums | `snake_case` type name | `entity_status`, `task_priority` |
| Functions | `snake_case` verb-first | `trigger_set_updated_at` |

---

## 6. Indexes

### Mandatory Indexes

1. **Every foreign key column** gets an index.
2. **Status/type columns** get a partial index filtered `WHERE deleted_at IS NULL`.
3. **Unique constraints** (email, slug) are inherently indexed.

### Composite Indexes

Create composite indexes for common query patterns:

```sql
-- Tasks filtered by assignee + status (common dashboard query)
CREATE INDEX idx_tasks_assignee_status
  ON tasks (assigned_to, status)
  WHERE deleted_at IS NULL;

-- Audit logs by entity lookup
CREATE INDEX idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id);
```

### Rules

- Never index columns with very low cardinality alone (e.g., boolean).
- Prefer partial indexes with `WHERE deleted_at IS NULL`.
- Use `CONCURRENTLY` for indexes on production tables.

---

## 7. Row Level Security (RLS)

**RLS is enabled on ALL tables.** The core provides basic policies; projects must customize them.

```sql
ALTER TABLE example ENABLE ROW LEVEL SECURITY;

-- Basic read policy: authenticated users can read non-deleted records
CREATE POLICY "Users can read active records"
  ON example FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Basic write policy: users can modify their own records
CREATE POLICY "Users can update own records"
  ON example FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
```

### Policy Guidelines

- Always start restrictive, open up as needed.
- Use `auth.uid()` for user-scoped policies.
- Admin/role-based policies check `role_permissions` or `user_permissions`.
- Service role bypasses RLS -- use only in server-side code.

---

## 8. Enums

- Defined as PostgreSQL `ENUM` types in `enums.sql`.
- Loaded before any table definitions.
- Projects extend enums by adding values (never removing from core).

```sql
CREATE TYPE task_status AS ENUM (
  'pending', 'in_progress', 'completed', 'cancelled'
);
```

See [ENUMS.md](./ENUMS.md) for the complete reference.

---

## 9. No Business-Domain Tables in Core

The core schema contains **only generic, reusable tables**:

- Auth & permissions (users, roles, permissions, role_permissions, user_permissions)
- Content & organization (categories, tags, entity_tags)
- Task management (tasks, task_comments)
- System (notifications, audit_logs, files, file_links, settings, lookup_items)

**Domain-specific tables** (e.g., reservations, products, invoices) belong in project migrations, never in the core.

---

## 10. Audit Logging

All mutations are logged in `audit_logs`:

```sql
INSERT INTO audit_logs (
  user_id, action, entity_type, entity_id,
  old_data, new_data, ip_address
) VALUES (
  auth.uid(), 'update', 'task', task_id,
  old_row::jsonb, new_row::jsonb, current_setting('request.headers')::json->>'x-forwarded-for'
);
```

### What to Log

| Action | old_data | new_data |
|--------|----------|----------|
| `create` | `NULL` | Full new record |
| `update` | Changed fields only | New values of changed fields |
| `delete` | Full record before delete | `NULL` |
| `restore` | `NULL` | Full restored record |

---

## 11. Lookup Items (Dynamic Dropdowns)

The `lookup_items` table stores dynamic dropdown values managed via the `/settings` UI:

```sql
-- Fetch all active items for a category
SELECT * FROM lookup_items
WHERE category = 'payment_method'
  AND is_active = true
ORDER BY sort_order;
```

- Each item belongs to a `category` (string key).
- `sort_order` controls display order.
- `is_active` toggles visibility without deletion.
- Projects define their own categories; the core provides the table structure.

---

## 12. Settings (Key-Value Configuration)

The `settings` table stores app-wide configuration:

```sql
SELECT value FROM settings WHERE key = 'company_name';
```

- `key` is unique.
- `value` is `jsonb` for flexibility (strings, numbers, objects, arrays).
- `group` organizes settings in the UI (e.g., `general`, `email`, `notifications`).

---

## 13. Polymorphic Patterns

Several tables use **entity_type + entity_id** for polymorphic associations:

| Table | Pattern | Example |
|-------|---------|---------|
| `files` / `file_links` | Attach files to any entity | `entity_type='task', entity_id=<task_uuid>` |
| `entity_tags` | Tag any entity | `entity_type='category', entity_id=<cat_uuid>` |
| `audit_logs` | Log changes to any entity | `entity_type='user', entity_id=<user_uuid>` |
| `notifications` | Notify about any entity | `entity_type='task', entity_id=<task_uuid>` |

### Rules for Polymorphic Columns

- `entity_type` is `varchar(50) NOT NULL` -- stores the table name (singular).
- `entity_id` is `uuid NOT NULL`.
- Always index `(entity_type, entity_id)` together.
- No FK constraint (since the target table varies). Enforce integrity in application code.

---

## 14. JSON Metadata Columns

Tables that need flexible extension include a `metadata` column:

```sql
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
```

- Use for project-specific fields that don't warrant schema changes.
- Never store critical business data exclusively in metadata -- promote to real columns when patterns stabilize.
- Index with GIN if you query inside metadata frequently:

```sql
CREATE INDEX idx_example_metadata ON example USING GIN (metadata);
```

---

## 15. Derived Values

**Never store computed values.** Derive them in queries or views:

```sql
-- Bad: storing a "task_count" column on categories
-- Good: compute at query time
SELECT c.*, COUNT(t.id) AS task_count
FROM categories c
LEFT JOIN tasks t ON t.category_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;
```

---

## 16. Security

- **Never store secrets in plain text.** Passwords are handled by Supabase Auth.
- **Always use parameterized queries.** The Supabase client handles this automatically.
- **Sensitive columns** (e.g., notes, personal data) should have restrictive RLS policies.
- **API keys / tokens** go in environment variables, never in the database.

---

## 17. Migrations

### File Naming

```
YYYY-MM-DD_description.sql
```

Examples:
- `2026-01-15_core_enums.sql`
- `2026-01-15_core_tables.sql`
- `2026-02-01_add_tasks_due_date_index.sql`

### Migration Order (Core Setup)

1. `enums.sql` -- All enum type definitions
2. `functions.sql` -- Utility functions (trigger_set_updated_at, etc.)
3. `tables.sql` -- All core table definitions
4. `indexes.sql` -- All indexes
5. `rls.sql` -- RLS policies
6. `seed.sql` -- Default data (roles, permissions, settings, categories)

### Rules

- Migrations are **append-only** in production.
- Never modify a migration that has been applied.
- Destructive changes (DROP COLUMN, DROP TABLE) require a separate migration with a clear name.
- Always test migrations on a staging database first.

---

## 18. Seed Data

`seed.sql` populates essential records:

| Table | Seed Data |
|-------|-----------|
| `roles` | Default roles (admin, manager, user, viewer) |
| `permissions` | All system permissions |
| `role_permissions` | Role-to-permission mappings |
| `categories` | Default top-level categories |
| `tags` | Common tags |
| `settings` | Default app configuration |
| `lookup_items` | Initial dropdown values |

Seed data uses deterministic UUIDs where relationships require it, or `gen_random_uuid()` where IDs don't matter.

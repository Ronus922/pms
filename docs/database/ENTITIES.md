# Entity Reference

> Complete documentation for all 16 core tables.
> Tables are grouped by domain: Auth, Content, Tasks, System.

---

## Auth & Permissions

### users

User accounts. Extends Supabase Auth `auth.users` with application-specific profile data.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `email` | `varchar(255)` | NO | -- | Unique email address |
| `full_name` | `varchar(255)` | NO | -- | Display name |
| `phone` | `varchar(50)` | YES | `NULL` | Phone number |
| `avatar_url` | `text` | YES | `NULL` | Profile image URL |
| `role_id` | `uuid` | YES | `NULL` | FK to roles -- primary role |
| `status` | `user_status` | NO | `'active'` | Account status |
| `last_login_at` | `timestamptz` | YES | `NULL` | Last successful login |
| `metadata` | `jsonb` | NO | `'{}'` | Flexible extension fields |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `UNIQUE` on `email` `WHERE deleted_at IS NULL`
- `idx_users_role_id` on `role_id`
- `idx_users_status` on `status` `WHERE deleted_at IS NULL`

**Relationships:**
- `role_id` -> `roles(id)` ON DELETE SET NULL
- Referenced by: `tasks.assigned_to`, `tasks.created_by`, `task_comments.user_id`, `audit_logs.user_id`, `notifications.user_id`, `user_permissions.user_id`, `files.uploaded_by`

**RLS Policies:**
- SELECT: Authenticated users can read all active users
- UPDATE: Users can update their own profile
- INSERT/DELETE: Admin role only

**Notes:**
- The `id` should match `auth.users.id` from Supabase Auth when integrating.
- `metadata` stores project-specific fields (e.g., department, employee_number).

---

### roles

Named roles that group permissions together.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `varchar(100)` | NO | -- | Unique role name (e.g., `admin`, `manager`) |
| `display_name` | `varchar(255)` | NO | -- | Hebrew display label |
| `description` | `text` | YES | `NULL` | Role description |
| `is_system` | `boolean` | NO | `false` | System roles cannot be deleted |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |

**Indexes:**
- `UNIQUE` on `name`

**Relationships:**
- Referenced by: `users.role_id`, `role_permissions.role_id`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin role only

**Notes:**
- Default seed roles: `admin`, `manager`, `user`, `viewer`.
- `is_system = true` roles are protected from deletion in application code.

---

### permissions

Individual permission definitions. Each represents a single capability.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `key` | `varchar(100)` | NO | -- | Unique permission key (e.g., `tasks.create`) |
| `display_name` | `varchar(255)` | NO | -- | Hebrew display label |
| `description` | `text` | YES | `NULL` | What this permission allows |
| `module` | `varchar(100)` | NO | -- | Grouping module (e.g., `tasks`, `users`, `settings`) |
| `scope` | `permission_scope` | NO | `'all'` | Scope of permission |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `key`
- `idx_permissions_module` on `module`

**Relationships:**
- Referenced by: `role_permissions.permission_id`, `user_permissions.permission_id`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin role only

**Notes:**
- Permission keys follow `module.action` pattern: `tasks.create`, `tasks.update`, `tasks.delete`, `tasks.view`.
- `scope` controls whether the permission applies to own records only or all records.

---

### role_permissions

Join table linking roles to permissions (N:M).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `role_id` | `uuid` | NO | -- | FK to roles |
| `permission_id` | `uuid` | NO | -- | FK to permissions |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `(role_id, permission_id)`
- `idx_role_permissions_role_id` on `role_id`
- `idx_role_permissions_permission_id` on `permission_id`

**Relationships:**
- `role_id` -> `roles(id)` ON DELETE CASCADE
- `permission_id` -> `permissions(id)` ON DELETE CASCADE

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin role only

---

### user_permissions

Direct permission overrides for individual users (bypasses role).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | -- | FK to users |
| `permission_id` | `uuid` | NO | -- | FK to permissions |
| `granted` | `boolean` | NO | `true` | `true` = grant, `false` = explicitly deny |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `(user_id, permission_id)`
- `idx_user_permissions_user_id` on `user_id`

**Relationships:**
- `user_id` -> `users(id)` ON DELETE CASCADE
- `permission_id` -> `permissions(id)` ON DELETE CASCADE

**RLS Policies:**
- SELECT: Users can read their own; admin reads all
- INSERT/UPDATE/DELETE: Admin role only

**Notes:**
- `granted = false` explicitly denies a permission even if the user's role grants it.
- Check order: user_permissions (deny) > user_permissions (grant) > role_permissions.

---

## Content & Organization

### categories

Hierarchical categories for organizing entities.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `varchar(255)` | NO | -- | Category name |
| `slug` | `varchar(255)` | NO | -- | URL-friendly identifier |
| `description` | `text` | YES | `NULL` | Category description |
| `parent_id` | `uuid` | YES | `NULL` | FK to self -- parent category |
| `sort_order` | `integer` | NO | `0` | Display order within siblings |
| `icon` | `varchar(50)` | YES | `NULL` | Icon identifier |
| `color` | `varchar(20)` | YES | `NULL` | Display color |
| `is_active` | `boolean` | NO | `true` | Visibility toggle |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `UNIQUE` on `slug` `WHERE deleted_at IS NULL`
- `idx_categories_parent_id` on `parent_id`
- `idx_categories_sort_order` on `sort_order`

**Relationships:**
- `parent_id` -> `categories(id)` ON DELETE SET NULL (self-referential hierarchy)
- Referenced by: `tasks.category_id`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin or manager role

**Notes:**
- Supports unlimited nesting depth, but UI typically shows 2-3 levels.
- `sort_order` is scoped per parent (siblings sorted together).

---

### tags

Reusable labels for cross-entity tagging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `varchar(100)` | NO | -- | Tag display name |
| `slug` | `varchar(100)` | NO | -- | URL-friendly identifier |
| `color` | `tag_color` | NO | `'gray'` | Visual color |
| `description` | `text` | YES | `NULL` | Tag description |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `slug`
- `UNIQUE` on `name`

**Relationships:**
- Referenced by: `entity_tags.tag_id`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin or manager role

---

### entity_tags

Polymorphic join table -- attaches tags to any entity.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `entity_type` | `varchar(50)` | NO | -- | Target table name (singular) |
| `entity_id` | `uuid` | NO | -- | Target record ID |
| `tag_id` | `uuid` | NO | -- | FK to tags |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `(entity_type, entity_id, tag_id)`
- `idx_entity_tags_entity` on `(entity_type, entity_id)`
- `idx_entity_tags_tag_id` on `tag_id`

**Relationships:**
- `tag_id` -> `tags(id)` ON DELETE CASCADE
- Polymorphic: `entity_type` + `entity_id` references any table

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/DELETE: Depends on entity ownership

---

## Task Management

### tasks

Generic task/to-do items with hierarchy, assignment, and scheduling.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `title` | `varchar(500)` | NO | -- | Task title |
| `description` | `text` | YES | `NULL` | Detailed description |
| `status` | `task_status` | NO | `'pending'` | Current status |
| `priority` | `task_priority` | NO | `'medium'` | Priority level |
| `category_id` | `uuid` | YES | `NULL` | FK to categories |
| `assigned_to` | `uuid` | YES | `NULL` | FK to users -- assignee |
| `parent_id` | `uuid` | YES | `NULL` | FK to self -- subtask hierarchy |
| `due_date` | `timestamptz` | YES | `NULL` | Deadline |
| `completed_at` | `timestamptz` | YES | `NULL` | When task was completed |
| `entity_type` | `varchar(50)` | YES | `NULL` | Related entity type |
| `entity_id` | `uuid` | YES | `NULL` | Related entity ID |
| `sort_order` | `integer` | NO | `0` | Display order |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields |
| `created_by` | `uuid` | YES | `NULL` | FK to users -- creator |
| `updated_by` | `uuid` | YES | `NULL` | FK to users -- last modifier |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `idx_tasks_status` on `status` `WHERE deleted_at IS NULL`
- `idx_tasks_priority` on `priority` `WHERE deleted_at IS NULL`
- `idx_tasks_assigned_to` on `assigned_to` `WHERE deleted_at IS NULL`
- `idx_tasks_category_id` on `category_id`
- `idx_tasks_parent_id` on `parent_id`
- `idx_tasks_due_date` on `due_date` `WHERE deleted_at IS NULL AND status != 'completed'`
- `idx_tasks_entity` on `(entity_type, entity_id)` `WHERE entity_type IS NOT NULL`
- `idx_tasks_assigned_status` on `(assigned_to, status)` `WHERE deleted_at IS NULL`

**Relationships:**
- `category_id` -> `categories(id)` ON DELETE SET NULL
- `assigned_to` -> `users(id)` ON DELETE SET NULL
- `parent_id` -> `tasks(id)` ON DELETE CASCADE (delete subtasks with parent)
- `created_by` -> `users(id)` ON DELETE SET NULL
- `updated_by` -> `users(id)` ON DELETE SET NULL
- Referenced by: `task_comments.task_id`
- Polymorphic: `entity_type` + `entity_id` references any related entity

**RLS Policies:**
- SELECT: Authenticated users can read tasks assigned to them or created by them; managers read all
- INSERT: Authenticated users
- UPDATE: Assignee or creator
- DELETE: Creator or admin

**Notes:**
- `parent_id` supports one level of subtask nesting (recommended max).
- `completed_at` is set automatically when status changes to `completed`.
- `entity_type/entity_id` links tasks to domain entities (e.g., a task about a specific order).

---

### task_comments

Comments on tasks with optional threading.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `task_id` | `uuid` | NO | -- | FK to tasks |
| `user_id` | `uuid` | NO | -- | FK to users -- comment author |
| `content` | `text` | NO | -- | Comment text |
| `parent_id` | `uuid` | YES | `NULL` | FK to self -- reply thread |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields (attachments, mentions) |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `idx_task_comments_task_id` on `task_id`
- `idx_task_comments_user_id` on `user_id`
- `idx_task_comments_parent_id` on `parent_id`

**Relationships:**
- `task_id` -> `tasks(id)` ON DELETE CASCADE
- `user_id` -> `users(id)` ON DELETE SET NULL
- `parent_id` -> `task_comments(id)` ON DELETE CASCADE (self-referential threading)

**RLS Policies:**
- SELECT: Same as parent task
- INSERT: Authenticated users with access to the task
- UPDATE: Comment author only
- DELETE: Comment author or admin

---

## System

### notifications

In-app and push notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | -- | FK to users -- recipient |
| `type` | `notification_type` | NO | -- | Notification category |
| `title` | `varchar(255)` | NO | -- | Notification title |
| `body` | `text` | YES | `NULL` | Notification body |
| `entity_type` | `varchar(50)` | YES | `NULL` | Related entity type |
| `entity_id` | `uuid` | YES | `NULL` | Related entity ID |
| `channel` | `notification_channel` | NO | `'in_app'` | Delivery channel |
| `is_read` | `boolean` | NO | `false` | Read status |
| `read_at` | `timestamptz` | YES | `NULL` | When notification was read |
| `metadata` | `jsonb` | NO | `'{}'` | Extra data (action URL, etc.) |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `idx_notifications_user_id` on `user_id`
- `idx_notifications_user_unread` on `(user_id, is_read)` `WHERE is_read = false`
- `idx_notifications_entity` on `(entity_type, entity_id)` `WHERE entity_type IS NOT NULL`
- `idx_notifications_type` on `type`

**Relationships:**
- `user_id` -> `users(id)` ON DELETE CASCADE
- Polymorphic: `entity_type` + `entity_id` references the source entity

**RLS Policies:**
- SELECT: Users can read their own notifications only
- UPDATE: Users can mark their own as read
- INSERT: System/service role only
- DELETE: Admin or notification owner

---

### audit_logs

Immutable log of all data mutations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | YES | `NULL` | FK to users -- who performed the action |
| `action` | `audit_action_type` | NO | -- | Action type |
| `entity_type` | `varchar(50)` | NO | -- | Target table name |
| `entity_id` | `uuid` | NO | -- | Target record ID |
| `old_data` | `jsonb` | YES | `NULL` | Previous state (for updates/deletes) |
| `new_data` | `jsonb` | YES | `NULL` | New state (for creates/updates) |
| `ip_address` | `inet` | YES | `NULL` | Client IP address |
| `user_agent` | `text` | YES | `NULL` | Client user agent |
| `metadata` | `jsonb` | NO | `'{}'` | Additional context |
| `created_at` | `timestamptz` | NO | `now()` | When action occurred |

**Indexes:**
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_entity` on `(entity_type, entity_id)`
- `idx_audit_logs_action` on `action`
- `idx_audit_logs_created_at` on `created_at`

**Relationships:**
- `user_id` -> `users(id)` ON DELETE SET NULL
- Polymorphic: `entity_type` + `entity_id` references the audited entity

**RLS Policies:**
- SELECT: Admin role only
- INSERT: System/service role (via server actions)
- UPDATE/DELETE: **Never** -- audit logs are immutable

**Notes:**
- This table is append-only. No updates or deletes are ever permitted.
- Consider partitioning by `created_at` for high-volume systems.
- `old_data` and `new_data` store only changed fields for updates (not full records).

---

### files

File metadata for uploaded files.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `varchar(255)` | NO | -- | Original file name |
| `storage_path` | `text` | NO | -- | Path in storage bucket |
| `mime_type` | `varchar(100)` | NO | -- | MIME type (e.g., `image/png`) |
| `size_bytes` | `bigint` | NO | -- | File size in bytes |
| `file_type` | `file_type` | NO | -- | Logical file category |
| `uploaded_by` | `uuid` | YES | `NULL` | FK to users |
| `metadata` | `jsonb` | NO | `'{}'` | Dimensions, duration, etc. |
| `created_at` | `timestamptz` | NO | `now()` | Upload time |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `idx_files_uploaded_by` on `uploaded_by`
- `idx_files_file_type` on `file_type` `WHERE deleted_at IS NULL`

**Relationships:**
- `uploaded_by` -> `users(id)` ON DELETE SET NULL
- Referenced by: `file_links.file_id`

**RLS Policies:**
- SELECT: Authenticated users (access controlled via file_links)
- INSERT: Authenticated users
- UPDATE: Uploader or admin
- DELETE: Uploader or admin

---

### file_links

Polymorphic join -- links files to any entity.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `file_id` | `uuid` | NO | -- | FK to files |
| `entity_type` | `varchar(50)` | NO | -- | Target table name |
| `entity_id` | `uuid` | NO | -- | Target record ID |
| `label` | `varchar(100)` | YES | `NULL` | Optional label (e.g., "cover", "attachment") |
| `sort_order` | `integer` | NO | `0` | Display order |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |

**Indexes:**
- `UNIQUE` on `(file_id, entity_type, entity_id)`
- `idx_file_links_entity` on `(entity_type, entity_id)`
- `idx_file_links_file_id` on `file_id`

**Relationships:**
- `file_id` -> `files(id)` ON DELETE CASCADE
- Polymorphic: `entity_type` + `entity_id` references any entity

**RLS Policies:**
- SELECT: Follows the linked entity's access rules
- INSERT/DELETE: Entity owner or admin

---

### settings

Key-value application configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `key` | `varchar(255)` | NO | -- | Unique setting key |
| `value` | `jsonb` | NO | `'{}'` | Setting value (any JSON type) |
| `group` | `varchar(100)` | NO | `'general'` | UI grouping |
| `display_name` | `varchar(255)` | YES | `NULL` | Hebrew label for UI |
| `description` | `text` | YES | `NULL` | Help text |
| `is_public` | `boolean` | NO | `false` | Readable without auth |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |

**Indexes:**
- `UNIQUE` on `key`
- `idx_settings_group` on `group`

**Relationships:**
- None (standalone)

**RLS Policies:**
- SELECT: Public settings readable by all; private settings by authenticated users
- INSERT/UPDATE/DELETE: Admin role only

**Notes:**
- `value` is `jsonb` so it can store strings, numbers, booleans, arrays, or objects.
- Example keys: `company_name`, `default_language`, `email_from_address`, `notification_settings`.

---

### lookup_items

Dynamic dropdown values managed via the settings UI.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `category` | `varchar(100)` | NO | -- | Dropdown category key |
| `value` | `varchar(255)` | NO | -- | Stored value |
| `label` | `varchar(255)` | NO | -- | Display label (Hebrew) |
| `sort_order` | `integer` | NO | `0` | Display order |
| `is_active` | `boolean` | NO | `true` | Visibility toggle |
| `color` | `varchar(20)` | YES | `NULL` | Optional badge color |
| `icon` | `varchar(50)` | YES | `NULL` | Optional icon identifier |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields |
| `created_at` | `timestamptz` | NO | `now()` | Record creation time |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification time |

**Indexes:**
- `UNIQUE` on `(category, value)`
- `idx_lookup_items_category` on `category` `WHERE is_active = true`

**Relationships:**
- None (standalone, referenced by application code)

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin role only

**Notes:**
- Categories are defined by projects (e.g., `payment_method`, `room_type`, `lead_source`).
- Items within a category are ordered by `sort_order`.
- Deactivating (`is_active = false`) hides from dropdowns but preserves historical references.
- Consumed via `useLookup(category)` hook in the frontend.

**Usage example:**

```typescript
// Frontend hook
const { items, isLoading } = useLookup('payment_method');

// Returns:
// [
//   { value: 'cash', label: 'מזומן', color: '#22c55e' },
//   { value: 'credit', label: 'אשראי', color: '#3b82f6' },
//   { value: 'transfer', label: 'העברה בנקאית', color: '#8b5cf6' },
// ]
```

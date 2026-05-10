# Relationships Reference

> All relationships between the 16 core tables.
> Grouped by domain with ER diagram, detailed listing, and polymorphic patterns.

---

## ER Diagram (Text)

```
                    ┌─────────────┐
                    │   roles     │
                    └──────┬──────┘
                           │ 1:N
                           ▼
┌──────────────┐    ┌─────────────┐    ┌───────────────────┐
│ permissions  │◄───│   users     │───►│  notifications     │
└──────┬───────┘    └──┬───┬──┬───┘    └───────────────────┘
       │               │   │  │
       │               │   │  └──────────────────┐
       ▼               │   │                     ▼
┌──────────────────┐   │   │              ┌─────────────┐
│ role_permissions │   │   │              │ audit_logs  │
│  (role+perm)     │   │   │              └─────────────┘
└──────────────────┘   │   │
                       │   │
┌──────────────────┐   │   │
│ user_permissions │◄──┘   │
│  (user+perm)     │       │
└──────────────────┘       │
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌───────────┐  ┌───────────┐  ┌──────────┐
     │   tasks   │  │   files   │  │   tags   │
     └─────┬─────┘  └─────┬─────┘  └────┬─────┘
           │               │              │
           ▼               ▼              ▼
  ┌────────────────┐ ┌──────────┐ ┌────────────┐
  │ task_comments  │ │file_links│ │ entity_tags │
  └────────────────┘ └──────────┘ └────────────┘

  ┌────────────┐    ┌──────────────┐
  │ categories │    │ lookup_items │    (standalone)
  │  (tree)    │    └──────────────┘
  └────────────┘
                    ┌──────────────┐
                    │   settings   │    (standalone)
                    └──────────────┘
```

---

## Relationship Groups

### Group 1: Auth & Permissions

```
roles ──1:N──► users              (users.role_id → roles.id)
roles ──1:N──► role_permissions   (role_permissions.role_id → roles.id)
permissions ──1:N──► role_permissions   (role_permissions.permission_id → permissions.id)
users ──1:N──► user_permissions   (user_permissions.user_id → users.id)
permissions ──1:N──► user_permissions   (user_permissions.permission_id → permissions.id)
```

| From | To | Type | FK Column | ON DELETE | Description |
|------|----|------|-----------|-----------|-------------|
| `users` | `roles` | N:1 | `users.role_id` | `SET NULL` | User's primary role |
| `role_permissions` | `roles` | N:1 | `role_permissions.role_id` | `CASCADE` | Role's granted permissions |
| `role_permissions` | `permissions` | N:1 | `role_permissions.permission_id` | `CASCADE` | Permission assigned to role |
| `user_permissions` | `users` | N:1 | `user_permissions.user_id` | `CASCADE` | Direct user permission override |
| `user_permissions` | `permissions` | N:1 | `user_permissions.permission_id` | `CASCADE` | Permission granted/denied to user |

**Effective permissions** are resolved as:
1. Check `user_permissions` for explicit deny (`granted = false`) -- if found, deny.
2. Check `user_permissions` for explicit grant (`granted = true`) -- if found, grant.
3. Check `role_permissions` via `users.role_id` -- if found, grant.
4. Default: deny.

---

### Group 2: Task Management

```
users ──1:N──► tasks (assigned_to)
users ──1:N──► tasks (created_by)
users ──1:N──► tasks (updated_by)
categories ──1:N──► tasks
tasks ──1:N──► tasks (parent_id, self-referential)
tasks ──1:N──► task_comments
users ──1:N──► task_comments
task_comments ──1:N──► task_comments (parent_id, self-referential)
```

| From | To | Type | FK Column | ON DELETE | Description |
|------|----|------|-----------|-----------|-------------|
| `tasks` | `users` | N:1 | `tasks.assigned_to` | `SET NULL` | Task assignee |
| `tasks` | `users` | N:1 | `tasks.created_by` | `SET NULL` | Task creator |
| `tasks` | `users` | N:1 | `tasks.updated_by` | `SET NULL` | Last modifier |
| `tasks` | `categories` | N:1 | `tasks.category_id` | `SET NULL` | Task category |
| `tasks` | `tasks` | N:1 | `tasks.parent_id` | `CASCADE` | Subtask hierarchy |
| `task_comments` | `tasks` | N:1 | `task_comments.task_id` | `CASCADE` | Comment on task |
| `task_comments` | `users` | N:1 | `task_comments.user_id` | `SET NULL` | Comment author |
| `task_comments` | `task_comments` | N:1 | `task_comments.parent_id` | `CASCADE` | Reply thread |

---

### Group 3: Content & Files

```
users ──1:N──► files (uploaded_by)
files ──1:N──► file_links
tags ──1:N──► entity_tags
```

| From | To | Type | FK Column | ON DELETE | Description |
|------|----|------|-----------|-----------|-------------|
| `files` | `users` | N:1 | `files.uploaded_by` | `SET NULL` | File uploader |
| `file_links` | `files` | N:1 | `file_links.file_id` | `CASCADE` | Link to file record |
| `entity_tags` | `tags` | N:1 | `entity_tags.tag_id` | `CASCADE` | Tag reference |

---

### Group 4: System

```
users ──1:N──► notifications
users ──1:N──► audit_logs
```

| From | To | Type | FK Column | ON DELETE | Description |
|------|----|------|-----------|-----------|-------------|
| `notifications` | `users` | N:1 | `notifications.user_id` | `CASCADE` | Notification recipient |
| `audit_logs` | `users` | N:1 | `audit_logs.user_id` | `SET NULL` | Action performer |

---

### Standalone Tables

These tables have no foreign key relationships:

| Table | Notes |
|-------|-------|
| `settings` | Key-value config, referenced only by application code |
| `lookup_items` | Dynamic dropdowns, referenced only by application code |

---

## Polymorphic Relationships

Four tables use the `entity_type` + `entity_id` pattern to reference any table polymorphically.

### Pattern

```sql
entity_type varchar(50) NOT NULL,  -- target table name (singular)
entity_id   uuid        NOT NULL   -- target record UUID
```

No foreign key constraint exists (the target table varies). Integrity is enforced in application code.

### Tables Using Polymorphic Pattern

| Table | Columns | Purpose | Example |
|-------|---------|---------|---------|
| `entity_tags` | `entity_type`, `entity_id` | Tag any entity | `entity_type='task', entity_id=<uuid>` |
| `file_links` | `entity_type`, `entity_id` | Attach files to any entity | `entity_type='user', entity_id=<uuid>` |
| `audit_logs` | `entity_type`, `entity_id` | Log mutations on any entity | `entity_type='category', entity_id=<uuid>` |
| `notifications` | `entity_type`, `entity_id` | Link notifications to source entity | `entity_type='task', entity_id=<uuid>` |
| `tasks` | `entity_type`, `entity_id` | Associate tasks with domain entities | `entity_type='order', entity_id=<uuid>` |

### Querying Polymorphic Relations

```sql
-- Get all tags for a specific task
SELECT t.*
FROM tags t
JOIN entity_tags et ON et.tag_id = t.id
WHERE et.entity_type = 'task'
  AND et.entity_id = '550e8400-e29b-41d4-a716-446655440000';

-- Get all files attached to a user
SELECT f.*
FROM files f
JOIN file_links fl ON fl.file_id = f.id
WHERE fl.entity_type = 'user'
  AND fl.entity_id = '550e8400-e29b-41d4-a716-446655440001';

-- Get audit history for any entity
SELECT al.*
FROM audit_logs al
WHERE al.entity_type = 'task'
  AND al.entity_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY al.created_at DESC;
```

### Extending for Project Entities

When a project adds domain tables (e.g., `orders`, `products`), they automatically work with all polymorphic tables:

```sql
-- Attach a tag to a project-specific entity
INSERT INTO entity_tags (entity_type, entity_id, tag_id)
VALUES ('order', '<order-uuid>', '<tag-uuid>');

-- Attach a file to a project-specific entity
INSERT INTO file_links (file_id, entity_type, entity_id)
VALUES ('<file-uuid>', 'product', '<product-uuid>');
```

No schema changes required -- just use the new entity_type value.

---

## Hierarchical (Self-Referential) Relationships

Three tables support tree structures via self-referential `parent_id`:

| Table | FK Column | ON DELETE | Max Depth | Use Case |
|-------|-----------|-----------|-----------|----------|
| `categories` | `parent_id` | `SET NULL` | Unlimited (2-3 recommended) | Category taxonomy |
| `tasks` | `parent_id` | `CASCADE` | 1 level (subtasks) | Task decomposition |
| `task_comments` | `parent_id` | `CASCADE` | Unlimited (2-3 recommended) | Comment threading |

### Querying Hierarchies

```sql
-- Get top-level categories with children
SELECT
  p.id AS parent_id,
  p.name AS parent_name,
  c.id AS child_id,
  c.name AS child_name
FROM categories p
LEFT JOIN categories c ON c.parent_id = p.id
WHERE p.parent_id IS NULL
  AND p.deleted_at IS NULL
ORDER BY p.sort_order, c.sort_order;

-- Recursive CTE for full tree
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 0 AS depth
  FROM categories
  WHERE parent_id IS NULL AND deleted_at IS NULL

  UNION ALL

  SELECT c.id, c.name, c.parent_id, ct.depth + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
  WHERE c.deleted_at IS NULL
)
SELECT * FROM category_tree ORDER BY depth, name;
```

---

## N:M (Many-to-Many) Relationships

All N:M relationships are implemented via explicit join tables with their own `id` column:

| Relationship | Join Table | Side A | Side B |
|-------------|------------|--------|--------|
| Role <-> Permission | `role_permissions` | `roles` | `permissions` |
| User <-> Permission | `user_permissions` | `users` | `permissions` |
| Entity <-> Tag | `entity_tags` | Any entity (polymorphic) | `tags` |
| Entity <-> File | `file_links` | Any entity (polymorphic) | `files` |

Each join table enforces uniqueness on the pair (or triple for polymorphic) to prevent duplicates.

---

## ON DELETE Behavior Summary

| Behavior | Used On | Rationale |
|----------|---------|-----------|
| `CASCADE` | Join tables (`role_permissions`, `user_permissions`, `entity_tags`, `file_links`), child records (`task_comments` on task, subtasks on parent) | Removing parent removes the association |
| `SET NULL` | Optional references (`users.role_id`, `tasks.assigned_to`, `tasks.category_id`, `audit_logs.user_id`) | Preserve the record even if the reference is removed |
| Never used: `RESTRICT` | -- | Soft delete pattern handles this at application level |
| Never used: `NO ACTION` | -- | Explicit behavior preferred |

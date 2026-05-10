-- ============================================================
-- SCHEMA.SQL — Reusable Database Foundation
-- Master Template Foundation
-- ============================================================
-- Prerequisites: Run enums.sql first
-- Database: PostgreSQL 15+ / Supabase
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid UNIQUE,                         -- FK to auth.users (Supabase Auth)
  email         text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  phone         text,
  avatar_url    text,
  role_id       uuid,                                -- FK to roles
  department    text,
  status        user_status NOT NULL DEFAULT 'active',
  language      text NOT NULL DEFAULT 'he',
  timezone      text NOT NULL DEFAULT 'Asia/Jerusalem',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz                          -- soft delete
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role_id ON users (role_id);
CREATE INDEX idx_users_status ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_id ON users (auth_id);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE users IS 'Application users. Linked to Supabase Auth via auth_id.';

-- ============================================================
-- 2. ROLES
-- ============================================================
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,                  -- machine name: 'admin', 'manager'
  label       text NOT NULL,                         -- display name (Hebrew): 'מנהל'
  description text,
  level       int NOT NULL DEFAULT 0,                -- hierarchy: higher = more power
  is_system   boolean NOT NULL DEFAULT false,        -- system roles cannot be deleted
  color       text,                                  -- Tailwind color for UI badges
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE roles IS 'User roles with hierarchy levels. System roles (super_admin, admin) are protected.';

-- ============================================================
-- 3. PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text NOT NULL,                         -- 'tasks', 'users', 'reports'
  action      text NOT NULL,                         -- 'view', 'create', 'edit', 'delete', 'export'
  label       text NOT NULL,                         -- Hebrew: 'צפייה במשימות'
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (module, action)
);

CREATE INDEX idx_permissions_module ON permissions (module);

COMMENT ON TABLE permissions IS 'Granular permissions defined per module per action.';

-- ============================================================
-- 4. ROLE_PERMISSIONS (many-to-many: roles <-> permissions)
-- ============================================================
CREATE TABLE role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope         permission_scope NOT NULL DEFAULT 'all',
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions (permission_id);

COMMENT ON TABLE role_permissions IS 'Maps roles to permissions with optional scope restriction.';

-- ============================================================
-- 5. USER_PERMISSIONS (direct overrides per user)
-- ============================================================
CREATE TABLE user_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope         permission_scope NOT NULL DEFAULT 'all',
  granted       boolean NOT NULL DEFAULT true,       -- false = explicit deny
  granted_by    uuid REFERENCES users(id),
  expires_at    timestamptz,                         -- optional time-limited permission
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user ON user_permissions (user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions (permission_id);

COMMENT ON TABLE user_permissions IS 'Direct per-user permission overrides. Takes precedence over role_permissions. Supports grant and deny.';

-- ============================================================
-- 6. CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  label       text NOT NULL,                         -- Hebrew display name
  description text,
  parent_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  entity_type text NOT NULL,                         -- which entity uses this: 'task', 'file', etc.
  sort_order  int NOT NULL DEFAULT 0,
  color       text,
  icon        text,                                  -- Lucide icon name
  is_default  boolean NOT NULL DEFAULT false,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_categories_entity_type ON categories (entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_parent ON categories (parent_id);

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE categories IS 'Hierarchical categories scoped by entity_type. Reusable across modules.';

-- ============================================================
-- 7. TAGS
-- ============================================================
CREATE TABLE tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  label       text NOT NULL,                         -- Hebrew display
  color       tag_color NOT NULL DEFAULT 'blue',
  entity_type text NOT NULL,                         -- scoped to entity type
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (name, entity_type)
);

CREATE INDEX idx_tags_entity_type ON tags (entity_type);

COMMENT ON TABLE tags IS 'User-created tags scoped by entity type for flexible categorization.';

-- ============================================================
-- 8. ENTITY_TAGS (polymorphic join: tags <-> any entity)
-- ============================================================
CREATE TABLE entity_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL,                         -- 'task', 'file', etc.
  entity_id   uuid NOT NULL,                         -- the tagged record's id
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX idx_entity_tags_entity ON entity_tags (entity_type, entity_id);
CREATE INDEX idx_entity_tags_tag ON entity_tags (tag_id);

COMMENT ON TABLE entity_tags IS 'Polymorphic join table linking tags to any entity via entity_type + entity_id.';

-- ============================================================
-- 9. TASKS
-- ============================================================
CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  status        task_status NOT NULL DEFAULT 'pending',
  priority      task_priority NOT NULL DEFAULT 'medium',
  category_id   uuid REFERENCES categories(id),
  assigned_to   uuid REFERENCES users(id),
  assigned_by   uuid REFERENCES users(id),
  due_date      date,
  completed_at  timestamptz,
  completed_by  uuid REFERENCES users(id),
  parent_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,  -- subtask support
  sort_order    int NOT NULL DEFAULT 0,
  metadata      jsonb DEFAULT '{}',                  -- flexible key-value for project-specific fields
  created_by    uuid NOT NULL REFERENCES users(id),
  updated_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_tasks_status ON tasks (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned_to ON tasks (assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks (due_date) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_tasks_priority ON tasks (priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_parent ON tasks (parent_id);
CREATE INDEX idx_tasks_category ON tasks (category_id);
CREATE INDEX idx_tasks_created_by ON tasks (created_by);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE tasks IS 'Generic task management. Supports subtasks, assignment, categories, and flexible metadata.';

-- ============================================================
-- 10. TASK_COMMENTS
-- ============================================================
CREATE TABLE task_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content     text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,        -- internal notes vs. visible comments
  parent_id   uuid REFERENCES task_comments(id) ON DELETE CASCADE,  -- threaded replies
  created_by  uuid NOT NULL REFERENCES users(id),
  updated_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_task_comments_task ON task_comments (task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_comments_parent ON task_comments (parent_id);
CREATE INDEX idx_task_comments_created_by ON task_comments (created_by);

CREATE TRIGGER set_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE task_comments IS 'Comments on tasks. Supports threaded replies and internal-only notes.';

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL DEFAULT 'info',
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  title       text NOT NULL,
  body        text,
  icon        text,                                  -- Lucide icon name
  link        text,                                  -- URL to navigate to on click
  entity_type text,                                  -- related entity type
  entity_id   uuid,                                  -- related entity id
  read_at     timestamptz,
  sent_at     timestamptz,
  failed_at   timestamptz,
  failure_reason text,
  created_by  uuid REFERENCES users(id),             -- null = system-generated
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id);
CREATE INDEX idx_notifications_type ON notifications (type);

COMMENT ON TABLE notifications IS 'User notifications across all channels. Tracks read/sent/failed state.';

-- ============================================================
-- 12. AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id),             -- null for system actions
  action      audit_action_type NOT NULL,
  entity_type text NOT NULL,                         -- 'task', 'user', 'file', etc.
  entity_id   uuid,                                  -- the affected record
  changes     jsonb,                                 -- { field: { old: X, new: Y } }
  metadata    jsonb,                                 -- extra context (IP, user agent, etc.)
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Audit logs are append-only. No UPDATE or DELETE.
-- Partitioning by month recommended for large deployments.

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all mutations. Append-only — never update or delete rows.';

-- ============================================================
-- 13. FILES
-- ============================================================
CREATE TABLE files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name      text NOT NULL,                      -- original filename
  file_path      text NOT NULL,                      -- storage path (bucket/path/file)
  file_url       text NOT NULL,                      -- public or signed URL
  file_size      bigint NOT NULL,                    -- bytes
  mime_type      text NOT NULL,                      -- 'image/jpeg', 'application/pdf'
  file_type      file_type NOT NULL DEFAULT 'other',
  thumbnail_url  text,                               -- auto-generated for images
  width          int,                                -- image/video width in px
  height         int,                                -- image/video height in px
  storage_bucket text NOT NULL,                      -- Supabase storage bucket name
  checksum       text,                               -- SHA-256 for deduplication
  alt_text       text,                               -- accessibility alt text
  metadata       jsonb DEFAULT '{}',                 -- EXIF, duration, etc.
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX idx_files_created_by ON files (created_by);
CREATE INDEX idx_files_type ON files (file_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_checksum ON files (checksum) WHERE checksum IS NOT NULL;

COMMENT ON TABLE files IS 'Uploaded files stored in Supabase Storage. Metadata includes dimensions, checksum, and EXIF.';

-- ============================================================
-- 14. FILE_LINKS (polymorphic join: files <-> any entity)
-- ============================================================
CREATE TABLE file_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  entity_type text NOT NULL,                         -- 'task', 'user', 'comment', etc.
  entity_id   uuid NOT NULL,                         -- the parent record's id
  sort_order  int NOT NULL DEFAULT 0,
  label       text,                                  -- optional label: 'Cover photo', 'Invoice PDF'
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (file_id, entity_type, entity_id)
);

CREATE INDEX idx_file_links_entity ON file_links (entity_type, entity_id);
CREATE INDEX idx_file_links_file ON file_links (file_id);

COMMENT ON TABLE file_links IS 'Polymorphic join linking files to any entity. One file can be linked to multiple entities.';

-- ============================================================
-- 15. SETTINGS (key-value for app/module configuration)
-- ============================================================
CREATE TABLE settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text NOT NULL DEFAULT 'global',        -- 'global', 'tasks', 'notifications', etc.
  key         text NOT NULL,
  value       jsonb NOT NULL,
  label       text,                                  -- Hebrew display label
  description text,
  updated_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (module, key)
);

CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE settings IS 'Key-value settings scoped by module. Used for app configuration managed via /settings.';

-- ============================================================
-- 16. LOOKUP_ITEMS (dynamic dropdowns managed in settings)
-- ============================================================
CREATE TABLE lookup_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL,                         -- 'task_type', 'department', 'priority_label', etc.
  value       text NOT NULL,                         -- machine value
  label       text NOT NULL,                         -- Hebrew display label
  sort_order  int NOT NULL DEFAULT 0,
  color       text,                                  -- optional color for UI
  icon        text,                                  -- optional Lucide icon
  is_default  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (category, value)
);

CREATE INDEX idx_lookup_items_category ON lookup_items (category) WHERE is_active = true;

CREATE TRIGGER set_lookup_items_updated_at
  BEFORE UPDATE ON lookup_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE lookup_items IS 'Dynamic dropdown values managed via /settings. Consumed by useLookup hook.';

-- ============================================================
-- FOREIGN KEYS (deferred to avoid ordering issues)
-- ============================================================
ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (basic — projects should customize)
-- ============================================================

-- Users: authenticated users can read all, edit own profile
CREATE POLICY users_select ON users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth_id = auth.uid());

-- Roles: readable by all authenticated
CREATE POLICY roles_select ON roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Permissions: readable by all authenticated
CREATE POLICY permissions_select ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Role permissions: readable by all authenticated
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- User permissions: users can read their own
CREATE POLICY user_permissions_select ON user_permissions FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Tasks: authenticated users can read non-deleted tasks
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Task comments: same as tasks
CREATE POLICY task_comments_select ON task_comments FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Notifications: users can only read their own
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Audit logs: readable by admins only (customize per project)
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_id = auth.uid() AND r.level >= 4
    )
  );

-- Files: authenticated users can read non-deleted files
CREATE POLICY files_select ON files FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- File links: authenticated users can read
CREATE POLICY file_links_select ON file_links FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Settings: readable by all authenticated
CREATE POLICY settings_select ON settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Lookup items: readable by all authenticated
CREATE POLICY lookup_items_select ON lookup_items FOR SELECT USING (auth.uid() IS NOT NULL);

-- Categories: readable by all authenticated
CREATE POLICY categories_select ON categories FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Tags: readable by all authenticated
CREATE POLICY tags_select ON tags FOR SELECT USING (auth.uid() IS NOT NULL);

-- Entity tags: readable by all authenticated
CREATE POLICY entity_tags_select ON entity_tags FOR SELECT USING (auth.uid() IS NOT NULL);

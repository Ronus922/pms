-- ============================================================
-- ENUMS.SQL — Reusable Enum Types
-- Master Template Foundation
-- ============================================================
-- Run this BEFORE schema.sql
-- These enums are generic and domain-agnostic.
-- Project-specific enums should be added in separate migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Entity Status (generic lifecycle for any entity)
-- ------------------------------------------------------------
CREATE TYPE entity_status AS ENUM (
  'draft',
  'active',
  'inactive',
  'archived',
  'deleted'
);

COMMENT ON TYPE entity_status IS 'Generic lifecycle status applicable to any entity in the system';

-- ------------------------------------------------------------
-- 2. Task Status
-- ------------------------------------------------------------
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold',
  'overdue'
);

COMMENT ON TYPE task_status IS 'Status values for the tasks table';

-- ------------------------------------------------------------
-- 3. Task Priority
-- ------------------------------------------------------------
CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

COMMENT ON TYPE task_priority IS 'Priority levels for the tasks table';

-- ------------------------------------------------------------
-- 4. Notification Type
-- ------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
  'info',
  'success',
  'warning',
  'error',
  'reminder',
  'mention',
  'assignment',
  'status_change',
  'comment',
  'system'
);

COMMENT ON TYPE notification_type IS 'Categorization for user notifications';

-- ------------------------------------------------------------
-- 5. Audit Action Type
-- ------------------------------------------------------------
CREATE TYPE audit_action_type AS ENUM (
  'create',
  'update',
  'delete',
  'restore',
  'login',
  'logout',
  'permission_change',
  'password_change',
  'export',
  'import',
  'bulk_update',
  'bulk_delete',
  'permission_denied'
);

COMMENT ON TYPE audit_action_type IS 'All possible actions tracked in the audit log';

-- ------------------------------------------------------------
-- 6. File Type
-- ------------------------------------------------------------
CREATE TYPE file_type AS ENUM (
  'image',
  'document',
  'spreadsheet',
  'pdf',
  'video',
  'audio',
  'archive',
  'other'
);

COMMENT ON TYPE file_type IS 'High-level file category for uploaded files';

-- ------------------------------------------------------------
-- 7. Permission Scope
-- ------------------------------------------------------------
CREATE TYPE permission_scope AS ENUM (
  'all',          -- Full access to the module
  'own',          -- Only records created by the user
  'department',   -- Records within the user''s department
  'assigned'      -- Only records assigned to the user
);

COMMENT ON TYPE permission_scope IS 'Scope of a permission — controls which records the permission applies to';

-- ------------------------------------------------------------
-- 8. User Status
-- ------------------------------------------------------------
CREATE TYPE user_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'pending_verification'
);

COMMENT ON TYPE user_status IS 'Account status for users';

-- ------------------------------------------------------------
-- 9. Notification Channel
-- ------------------------------------------------------------
CREATE TYPE notification_channel AS ENUM (
  'in_app',
  'email',
  'sms',
  'push',
  'webhook'
);

COMMENT ON TYPE notification_channel IS 'Delivery channel for a notification';

-- ------------------------------------------------------------
-- 10. Tag Color (for visual tagging)
-- ------------------------------------------------------------
CREATE TYPE tag_color AS ENUM (
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'slate'
);

COMMENT ON TYPE tag_color IS 'Visual color for tags — maps to Tailwind color families';

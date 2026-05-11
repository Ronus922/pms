-- ============================================================
-- SEED.SQL — Default Seed Data
-- Master Template Foundation
-- ============================================================
-- Prerequisites: Run enums.sql + schema.sql first
-- This provides the minimum viable data for a new project.
-- Project-specific seeds should go in separate files.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ROLES
-- ------------------------------------------------------------
INSERT INTO roles (name, label, description, level, is_system, color) VALUES
  ('super_admin', 'מנהל על',     'גישה מלאה לכל המערכת ללא הגבלה',       5, true,  'red'),
  ('admin',       'מנהל',        'ניהול מלא של הנכס והצוות',              4, true,  'indigo'),
  ('manager',     'מנהל מחלקה',  'ניהול מחלקה ספציפית עם הרשאות מלאות',  3, false, 'blue'),
  ('staff',       'צוות',        'צוות תפעולי עם הרשאות מוגבלות',        1, false, 'emerald'),
  ('viewer',      'צפייה בלבד', 'צפייה בנתונים ללא עריכה',              0, false, 'slate');

-- ------------------------------------------------------------
-- 2. PERMISSIONS (core modules)
-- ------------------------------------------------------------

-- Users module
INSERT INTO permissions (module, action, label) VALUES
  ('users', 'view',    'צפייה במשתמשים'),
  ('users', 'create',  'יצירת משתמשים'),
  ('users', 'edit',    'עריכת משתמשים'),
  ('users', 'delete',  'מחיקת משתמשים'),
  ('users', 'export',  'ייצוא משתמשים');

-- Tasks module
INSERT INTO permissions (module, action, label) VALUES
  ('tasks', 'view',    'צפייה במשימות'),
  ('tasks', 'create',  'יצירת משימות'),
  ('tasks', 'edit',    'עריכת משימות'),
  ('tasks', 'delete',  'מחיקת משימות'),
  ('tasks', 'assign',  'שיוך משימות'),
  ('tasks', 'export',  'ייצוא משימות');

-- Files module
INSERT INTO permissions (module, action, label) VALUES
  ('files', 'view',    'צפייה בקבצים'),
  ('files', 'upload',  'העלאת קבצים'),
  ('files', 'delete',  'מחיקת קבצים'),
  ('files', 'export',  'ייצוא קבצים');

-- Notifications module
INSERT INTO permissions (module, action, label) VALUES
  ('notifications', 'view',    'צפייה בהתראות'),
  ('notifications', 'manage',  'ניהול התראות');

-- Audit logs module
INSERT INTO permissions (module, action, label) VALUES
  ('audit_logs', 'view',   'צפייה ביומן פעולות'),
  ('audit_logs', 'export', 'ייצוא יומן פעולות');

-- Settings module
INSERT INTO permissions (module, action, label) VALUES
  ('settings', 'view',   'צפייה בהגדרות'),
  ('settings', 'manage', 'ניהול הגדרות');

-- Reports module
INSERT INTO permissions (module, action, label) VALUES
  ('reports', 'view',   'צפייה בדוחות'),
  ('reports', 'export', 'ייצוא דוחות');

-- Categories & Tags
INSERT INTO permissions (module, action, label) VALUES
  ('categories', 'view',   'צפייה בקטגוריות'),
  ('categories', 'manage', 'ניהול קטגוריות'),
  ('tags', 'view',   'צפייה בתגיות'),
  ('tags', 'manage', 'ניהול תגיות');

-- ------------------------------------------------------------
-- 3. ROLE_PERMISSIONS
-- Grant permissions to roles using subqueries.
-- ------------------------------------------------------------

-- super_admin: gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT
  (SELECT id FROM roles WHERE name = 'super_admin'),
  p.id,
  'all'
FROM permissions p;

-- admin: gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT
  (SELECT id FROM roles WHERE name = 'admin'),
  p.id,
  'all'
FROM permissions p;

-- manager: view + create + edit + assign + export (no delete users, no settings, no audit export)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT
  (SELECT id FROM roles WHERE name = 'manager'),
  p.id,
  'all'
FROM permissions p
WHERE (p.module, p.action) IN (
  ('users', 'view'),
  ('tasks', 'view'), ('tasks', 'create'), ('tasks', 'edit'), ('tasks', 'assign'), ('tasks', 'export'),
  ('files', 'view'), ('files', 'upload'),
  ('notifications', 'view'),
  ('audit_logs', 'view'),
  ('settings', 'view'),
  ('reports', 'view'), ('reports', 'export'),
  ('categories', 'view'), ('categories', 'manage'),
  ('tags', 'view'), ('tags', 'manage')
);

-- staff: view + create tasks (own scope) + upload files
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT
  (SELECT id FROM roles WHERE name = 'staff'),
  p.id,
  CASE
    WHEN p.module = 'tasks' AND p.action IN ('edit', 'create') THEN 'own'::permission_scope
    ELSE 'all'::permission_scope
  END
FROM permissions p
WHERE (p.module, p.action) IN (
  ('users', 'view'),
  ('tasks', 'view'), ('tasks', 'create'), ('tasks', 'edit'),
  ('files', 'view'), ('files', 'upload'),
  ('notifications', 'view'),
  ('categories', 'view'),
  ('tags', 'view')
);

-- viewer: view only
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT
  (SELECT id FROM roles WHERE name = 'viewer'),
  p.id,
  'all'
FROM permissions p
WHERE p.action = 'view';

-- ------------------------------------------------------------
-- 4. DEFAULT CATEGORIES (generic)
-- ------------------------------------------------------------
INSERT INTO categories (name, label, entity_type, sort_order, icon, is_default) VALUES
  ('general',      'כללי',       'task', 0, 'Folder',      true),
  ('bug',          'באג',        'task', 1, 'Bug',         false),
  ('feature',      'פיצ׳ר',     'task', 2, 'Sparkles',    false),
  ('maintenance',  'תחזוקה',     'task', 3, 'Wrench',      false),
  ('documentation','תיעוד',      'task', 4, 'FileText',    false),
  ('general',      'כללי',       'file', 0, 'Folder',      true),
  ('documents',    'מסמכים',     'file', 1, 'FileText',    false),
  ('images',       'תמונות',     'file', 2, 'Image',       false);

-- ------------------------------------------------------------
-- 5. DEFAULT TAGS
-- ------------------------------------------------------------
INSERT INTO tags (name, label, color, entity_type) VALUES
  ('urgent',     'דחוף',      'red',     'task'),
  ('important',  'חשוב',      'amber',   'task'),
  ('review',     'לבדיקה',    'purple',  'task'),
  ('blocked',    'חסום',      'red',     'task'),
  ('quick-win',  'מהיר',      'green',   'task');

-- ------------------------------------------------------------
-- 6. DEFAULT LOOKUP ITEMS
-- ------------------------------------------------------------
INSERT INTO lookup_items (category, value, label, sort_order, is_default) VALUES
  -- Departments
  ('department', 'management',  'הנהלה',    0, true),
  ('department', 'operations',  'תפעול',    1, false),
  ('department', 'finance',     'כספים',    2, false),
  ('department', 'marketing',   'שיווק',    3, false),
  ('department', 'support',     'תמיכה',    4, false),

  -- Contact methods
  ('contact_method', 'phone',    'טלפון',   0, true),
  ('contact_method', 'email',    'אימייל',  1, false),
  ('contact_method', 'whatsapp', 'וואטסאפ', 2, false),
  ('contact_method', 'sms',      'SMS',     3, false);

-- ------------------------------------------------------------
-- 7. DEFAULT SETTINGS
-- ------------------------------------------------------------
INSERT INTO settings (module, key, value, label) VALUES
  ('global', 'app_name',          '"My App"',            'שם האפליקציה'),
  ('global', 'default_language',  '"he"',                'שפת ברירת מחדל'),
  ('global', 'default_timezone',  '"Asia/Jerusalem"',    'אזור זמן ברירת מחדל'),
  ('global', 'date_format',       '"DD/MM/YYYY"',        'פורמט תאריך'),
  ('global', 'currency',          '"ILS"',               'מטבע'),
  ('global', 'currency_symbol',   '"₪"',                 'סמל מטבע'),
  ('notifications', 'email_enabled',  'true',            'שליחת התראות באימייל'),
  ('notifications', 'sms_enabled',    'false',           'שליחת התראות ב-SMS'),
  ('tasks', 'auto_assign_creator', 'true',               'שיוך אוטומטי ליוצר המשימה'),
  ('tasks', 'default_priority',    '"medium"',           'עדיפות ברירת מחדל'),
  ('files', 'max_file_size_mb',    '10',                 'גודל קובץ מקסימלי (MB)'),
  ('files', 'allowed_types',       '["image/jpeg","image/png","image/webp","application/pdf"]', 'סוגי קבצים מותרים');

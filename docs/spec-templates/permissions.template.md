# Permissions: [MODULE_NAME]

## Module Info

| Property | Value |
|----------|-------|
| Module | [MODULE_NAME] |
| Permission Prefix | `[module]:` |
| DB Table | `[table_name]` |
| Has RLS | Yes |

## Actions

| Action Key | Label (Hebrew) | Description |
|------------|----------------|-------------|
| `[module]:view` | צפייה | View list and details |
| `[module]:create` | יצירה | Create new records |
| `[module]:edit` | עריכה | Edit existing records |
| `[module]:delete` | מחיקה | Soft delete records |
| `[module]:export` | ייצוא | Export to CSV/PDF |
| `[module]:[CUSTOM]` | [HEBREW] | [DESCRIPTION] |

## Role x Action Matrix

| Role | view | create | edit | delete | export | [CUSTOM] |
|------|------|--------|------|--------|--------|----------|
| super_admin | Yes | Yes | Yes | Yes | Yes | Yes |
| admin | Yes | Yes | Yes | Yes | Yes | Yes |
| manager | Yes | Yes | Yes | No | Yes | [Yes/No] |
| receptionist | Yes | Yes | [Own only] | No | No | No |
| staff | Yes | No | No | No | No | No |
| viewer | Yes | No | No | No | No | No |

## Field-Level Restrictions

### By Role

| Field | super_admin | admin | manager | staff | viewer |
|-------|-------------|-------|---------|-------|--------|
| [FIELD_1] | editable | editable | editable | read-only | read-only |
| [FIELD_2] | editable | editable | locked | hidden | hidden |
| [FIELD_3] | editable | editable | editable | editable | read-only |

### By Record Source

| Field | Internal Record | External Record (channel) |
|-------|----------------|--------------------------|
| [FIELD_1] | editable | locked (with warning icon) |
| [FIELD_2] | editable | editable |
| [FIELD_3] | editable | locked |

### Field State Definitions

| State | Visual | Behavior |
|-------|--------|----------|
| editable | Normal input | User can modify |
| read-only | Greyed out, no cursor | Display only, not in form submission |
| locked | Lock icon, tooltip explaining why | Cannot modify, shows reason |
| warning | Yellow border, warning icon | Can modify but shows confirmation |
| hidden | Not rendered | Field not visible at all |

## Special Rules

### Ownership Rules

| Rule | Description |
|------|-------------|
| [RULE_1] | e.g., "Staff can only edit records they created (created_by = auth.uid())" |
| [RULE_2] | e.g., "Managers can edit records from their department only" |

### Time-Based Rules

| Rule | Description |
|------|-------------|
| [RULE_1] | e.g., "Records older than 24h cannot be deleted by managers" |
| [RULE_2] | e.g., "Editing locked after status = completed" |

### Status-Based Rules

| Status | Allowed Actions | Blocked Actions |
|--------|----------------|-----------------|
| [STATUS_1] | view, edit, delete | - |
| [STATUS_2] | view, edit | delete |
| [STATUS_3] | view | edit, delete |

## Server-Side Enforcement

### Server Action Checks

```typescript
// In lib/actions/[module].ts -- every mutation must include:

// 1. Authentication check
const user = await getAuthUser()
if (!user) throw new Error('unauthorized')

// 2. Permission check
const hasPermission = await checkPermission(user.id, '[module]:[action]')
if (!hasPermission) throw new Error('forbidden')

// 3. Ownership check (if applicable)
if (rule === 'own_only') {
  const record = await getRecord(id)
  if (record.created_by !== user.id) throw new Error('forbidden')
}

// 4. Status check (if applicable)
if (record.status === '[LOCKED_STATUS]') {
  throw new Error('record_locked')
}
```

### RLS Policies

```sql
-- View: all authenticated users with view permission
CREATE POLICY "[module]_select" ON [table_name]
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM user_permissions
      WHERE permission = '[module]:view'
    )
  );

-- Insert: users with create permission
CREATE POLICY "[module]_insert" ON [table_name]
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_permissions
      WHERE permission = '[module]:create'
    )
  );

-- Update: users with edit permission (+ ownership if needed)
CREATE POLICY "[module]_update" ON [table_name]
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM user_permissions
      WHERE permission = '[module]:edit'
    )
    -- AND created_by = auth.uid()  -- uncomment for ownership rule
  );

-- Delete: users with delete permission (soft delete only)
CREATE POLICY "[module]_delete" ON [table_name]
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM user_permissions
      WHERE permission = '[module]:delete'
    )
  );
```

## Client-Side Enforcement

### Navigation Filtering

```typescript
// Sidebar item hidden if no view permission
{ label: '[MODULE]', href: '/[module]', permission: '[module]:view' }
```

### UI Element Visibility

| Element | Permission Required | Hidden or Disabled |
|---------|--------------------|--------------------|
| Create button | `[module]:create` | Hidden |
| Edit button (row) | `[module]:edit` | Hidden |
| Delete button (row) | `[module]:delete` | Hidden |
| Export button | `[module]:export` | Hidden |
| [CUSTOM] button | `[module]:[custom]` | [Hidden / Disabled] |

### SidePanel Field States

```typescript
// In [Module]PanelConfig.ts
function getFieldState(field: string, user: User, record: Record): FieldState {
  // Check role-based restrictions
  // Check source-based restrictions (internal vs external)
  // Check status-based restrictions
  // Return: 'editable' | 'read-only' | 'locked' | 'warning' | 'hidden'
}
```

## Audit Trail

| Event | Logged Data |
|-------|-------------|
| Create | user_id, timestamp, all field values |
| Update | user_id, timestamp, changed fields (old + new values) |
| Delete | user_id, timestamp, record_id |
| Permission denied | user_id, timestamp, attempted action, reason |

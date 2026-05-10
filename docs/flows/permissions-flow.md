# Flow: Permissions (End-to-End)

This document describes how permissions work across every layer of the system, from login to database. Every module follows this architecture.

## Permission Architecture Overview

```
Layer 1: Authentication (Supabase Auth)
    |
Layer 2: Role Resolution (DB lookup)
    |
Layer 3: Navigation Filtering (Sidebar)
    |
Layer 4: Page-Level Guard (Server Component)
    |
Layer 5: UI Element Visibility (Client Component)
    |
Layer 6: Field-Level States (SidePanel)
    |
Layer 7: Server Action Guard (Server)
    |
Layer 8: Row-Level Security (Supabase RLS)
    |
Layer 9: Audit Logging (DB trigger)
```

## Layer 1: Authentication

### Step 1.1: User Logs In

- User authenticates via Supabase Auth (email/password or OAuth)
- Supabase issues a JWT with `user.id` (UUID)
- JWT stored in httpOnly cookie via middleware

### Step 1.2: Session Validation

- Every request: middleware validates JWT
- If expired or invalid: redirect to `/login`
- If valid: request proceeds with authenticated context

```typescript
// middleware.ts
const { data: { user } } = await supabase.auth.getUser()
if (!user && isProtectedRoute) {
  return NextResponse.redirect('/login')
}
```

## Layer 2: Role Resolution

### Step 2.1: Load User Role

- After authentication, fetch user's role from the database
- Role stored in `users` or `user_roles` table
- Role is cached in the session/cookie for the duration of the login

```typescript
// lib/auth/get-user-role.ts
async function getUserRole(userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role ?? 'viewer' // default to least-privilege
}
```

### Step 2.2: Load User Permissions

- Permissions derived from role via `role_permissions` table
- Each role maps to a set of permission strings: `[module]:[action]`

```typescript
// lib/auth/get-user-permissions.ts
async function getUserPermissions(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId)
  return data?.map(p => p.permission) ?? []
}
```

### Role Hierarchy

| Role | Level | Inherits From |
|------|-------|---------------|
| super_admin | 5 | All permissions |
| admin | 4 | manager + admin-specific |
| manager | 3 | receptionist + manager-specific |
| receptionist | 2 | staff + receptionist-specific |
| staff | 1 | viewer + staff-specific |
| viewer | 0 | Base level (view only) |

## Layer 3: Navigation Filtering

### Step 3.1: Sidebar Rendering

- Sidebar navigation items are filtered based on page-level permissions
- Items the user cannot access are not rendered (hidden, not disabled)

```typescript
// components/layout/Sidebar.tsx
const navItems = [
  { label: 'לוח שנה', href: '/calendar', permission: 'calendar:view' },
  { label: 'הזמנות', href: '/reservations', permission: 'reservations:view' },
  { label: 'אורחים', href: '/guests', permission: 'guests:view' },
  { label: 'חדרים', href: '/rooms', permission: 'rooms:view' },
  { label: 'ניקיון', href: '/housekeeping', permission: 'housekeeping:view' },
  { label: 'צוות', href: '/staff', permission: 'staff:view' },
  { label: 'הגדרות', href: '/settings', permission: 'settings:view' },
]

// Filter to only items the user has permission for
const visibleItems = navItems.filter(item =>
  userPermissions.includes(item.permission)
)
```

### Step 3.2: URL Direct Access Prevention

- Even if a user manually types a URL, the page-level guard (Layer 4) prevents access
- Navigation filtering is a UX convenience, not a security measure

## Layer 4: Page-Level Guard

### Step 4.1: Server Component Check

- Every page's server component checks permission before rendering
- If denied: redirect to `/unauthorized` or `/dashboard`

```typescript
// app/(dashboard)/[module]/page.tsx
export default async function ModulePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const hasAccess = await checkPermission(user.id, '[module]:view')
  if (!hasAccess) redirect('/unauthorized')

  // Proceed with data fetching and rendering
  const data = await getModuleData()
  return <ModulePageClient data={data} />
}
```

### Step 4.2: Unauthorized Page

- Shows a clean message: "אין לך הרשאה לצפות בדף זה"
- Link back to dashboard
- Log the attempt (user tried to access a page they shouldn't)

## Layer 5: UI Element Visibility

### Step 5.1: Action Buttons

- Create, Edit, Delete buttons are conditionally rendered based on permissions
- Pattern: wrap with a permission check, do not render if unauthorized

```typescript
// Pattern for conditional actions
{hasPermission('reservations:create') && (
  <Button onClick={openCreatePanel}>הזמנה חדשה</Button>
)}
```

### Step 5.2: Row Actions in DataTable

- Each action in the row dropdown is filtered by permission
- If no actions available, the action column is hidden entirely

```typescript
const rowActions = [
  { label: 'צפייה', permission: '[module]:view', action: handleView },
  { label: 'עריכה', permission: '[module]:edit', action: handleEdit },
  { label: 'מחיקה', permission: '[module]:delete', action: handleDelete },
].filter(action => userPermissions.includes(action.permission))
```

### Step 5.3: Bulk Actions

- Bulk action buttons follow the same pattern
- Select-all checkbox only appears if at least one bulk action is available

## Layer 6: Field-Level States in SidePanel

### Step 6.1: Field State Resolution

Every field in a SidePanel has a state determined by multiple factors:

```typescript
type FieldState = 'editable' | 'read-only' | 'locked' | 'warning' | 'hidden'

function resolveFieldState(
  field: string,
  userRole: UserRole,
  record: Record,
  mode: 'create' | 'edit' | 'view'
): FieldState {
  // 1. View mode: everything is read-only
  if (mode === 'view') return 'read-only'

  // 2. Role-based restrictions (from PanelConfig)
  const roleRestriction = fieldConfig[field].roleRestrictions[userRole]
  if (roleRestriction) return roleRestriction

  // 3. Source-based restrictions (internal vs external)
  if (record?.source === 'external' && fieldConfig[field].lockOnExternal) {
    return 'locked'
  }

  // 4. Status-based restrictions
  if (record?.status && fieldConfig[field].lockOnStatus?.includes(record.status)) {
    return 'locked'
  }

  // 5. Default: editable
  return 'editable'
}
```

### Step 6.2: Visual States

| State | Input Appearance | Interaction |
|-------|-----------------|-------------|
| editable | Normal input styling | Full interaction |
| read-only | Grey background, no border | Text display only |
| locked | Grey background + lock icon + tooltip | Tooltip explains why locked |
| warning | Yellow border + warning icon | Editable but shows confirmation on change |
| hidden | Not rendered in DOM | Completely invisible |

## Layer 7: Server Action Guard

### Step 7.1: Every Mutation is Protected

- No server action trusts client-side permission checks
- Every server action independently validates authentication and authorization

```typescript
// lib/actions/[module].ts
'use server'

export async function createModule(data: ModuleFormData) {
  // Step A: Authenticate
  const user = await getAuthUser()
  if (!user) {
    return { success: false, error: 'unauthorized' }
  }

  // Step B: Authorize
  const canCreate = await checkPermission(user.id, '[module]:create')
  if (!canCreate) {
    return { success: false, error: 'forbidden' }
  }

  // Step C: Validate
  const parsed = moduleSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'validation', fields: parsed.error.flatten() }
  }

  // Step D: Business rules
  // (module-specific checks)

  // Step E: Execute
  const { data: result, error } = await supabase
    .from('[table]')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return { success: false, error: 'db_error' }
  }

  // Step F: Side effects
  await createAuditLog(user.id, '[module]:create', result.id)

  revalidatePath('/[module]')
  return { success: true, data: result }
}
```

### Step 7.2: Permission Check Function

```typescript
// lib/permissions/check.ts
export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  // Super admin bypass
  const user = await getUser(userId)
  if (user.role === 'super_admin') return true

  // Check specific permission
  const { data } = await supabase
    .from('user_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('permission', permission)
    .single()

  return !!data
}
```

## Layer 8: Row-Level Security (RLS)

### Step 8.1: RLS as Final Guard

- Even if server action code has a bug, RLS prevents unauthorized data access
- RLS policies are defined per table in Supabase

```sql
-- Standard RLS pattern for all tables
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- SELECT: user must have view permission
CREATE POLICY "[table]_select_policy"
  ON [table_name] FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = '[module]:view'
    )
    AND deleted_at IS NULL  -- soft-deleted records are hidden
  );

-- INSERT: user must have create permission
CREATE POLICY "[table]_insert_policy"
  ON [table_name] FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = '[module]:create'
    )
  );

-- UPDATE: user must have edit permission
CREATE POLICY "[table]_update_policy"
  ON [table_name] FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = '[module]:edit'
    )
  );
```

### Step 8.2: Ownership-Based RLS (Optional)

```sql
-- Staff can only see/edit their own records
CREATE POLICY "[table]_staff_select"
  ON [table_name] FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'manager')
    )
  );
```

## Layer 9: Audit Logging

### Step 9.1: All Mutations Logged

```sql
-- audit_log table
CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,          -- '[module]:create', '[module]:edit', '[module]:delete'
  entity_type text NOT NULL,     -- '[module]'
  entity_id uuid NOT NULL,
  changes jsonb,                 -- { field: { old: X, new: Y } }
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```

### Step 9.2: Permission Denied Logging

```sql
-- Also log failed access attempts
INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
VALUES (
  auth.uid(),
  'permission_denied',
  '[module]',
  '[entity_id]',
  '{"attempted_action": "[action]", "reason": "[reason]"}'::jsonb
);
```

## Complete Request Flow (Visual)

```
Browser Request
    |
    v
[Next.js Middleware]
    |-- No auth cookie --> Redirect to /login
    |-- Valid cookie --> Continue
    v
[Page Server Component]
    |-- No [module]:view permission --> Redirect to /unauthorized
    |-- Has permission --> Render page
    v
[Client Component Renders]
    |-- Filter nav items by permissions
    |-- Filter action buttons by permissions
    |-- Set field states by role + record state
    v
[User Triggers Mutation]
    |
    v
[Client Validation (Zod)]
    |-- Fails --> Show inline errors
    |-- Passes --> Call Server Action
    v
[Server Action]
    |-- Auth check fails --> Return 401
    |-- Permission check fails --> Return 403
    |-- Validation fails --> Return 422
    |-- Business rule fails --> Return 422
    |-- Passes all checks --> Execute query
    v
[Supabase Query + RLS]
    |-- RLS blocks --> Query returns empty/error
    |-- RLS passes --> Data written/read
    v
[Audit Log Entry]
    |
    v
[Response to Client]
    |-- Success --> Toast + refresh
    |-- Error --> Display error
```

## Testing Permission Layers

| Layer | How to Test |
|-------|-------------|
| Auth | Log out, try to access protected page |
| Nav filtering | Log in as viewer, verify restricted nav items hidden |
| Page guard | Log in as viewer, manually navigate to /settings |
| UI elements | Log in as staff, verify no create/edit/delete buttons |
| Field states | Log in as manager, verify locked fields in SidePanel |
| Server action | Use browser devtools to call server action without permission |
| RLS | Use Supabase dashboard to query as different users |
| Audit | Check audit_log table after each operation |

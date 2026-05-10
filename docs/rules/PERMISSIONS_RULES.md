# Permissions Rules

> Role-based access control model.
> Every page, action, and field must respect the user's permissions.

---

## 1. Roles

| Role | Description | Scope |
|------|-------------|-------|
| `super_admin` | System owner, full access to everything | All properties, all settings |
| `admin` | Property administrator | Single property, all modules |
| `manager` | Department manager | Assigned modules, full CRUD |
| `staff` | Operational staff | Assigned modules, limited actions |
| `viewer` | Read-only access | Assigned modules, no modifications |

---

## 2. Permission Model

Permissions are granular, defined per module per action.

### Structure

```typescript
type Permission = {
  module: string    // e.g., 'reservations', 'rooms', 'guests'
  action: string    // e.g., 'create', 'read', 'update', 'delete'
}

type RolePermissions = {
  role: string
  permissions: Permission[]
}
```

### Standard Actions Per Module

| Action | Description |
|--------|-------------|
| `read` | View list and details |
| `create` | Create new records |
| `update` | Edit existing records |
| `delete` | Delete/archive records |
| `export` | Export data (CSV, PDF) |
| `manage_settings` | Configure module settings |

### Permission Matrix Example

| Module | super_admin | admin | manager | staff | viewer |
|--------|:-----------:|:-----:|:-------:|:-----:|:------:|
| Reservations: read | V | V | V | V | V |
| Reservations: create | V | V | V | V | -- |
| Reservations: update | V | V | V | limited | -- |
| Reservations: delete | V | V | -- | -- | -- |
| Settings: manage | V | V | -- | -- | -- |
| Staff: manage | V | V | -- | -- | -- |
| Reports: export | V | V | V | -- | -- |

---

## 3. UI Visibility Rules

### Page Navigation

Hide navigation items for modules the user cannot access. Do not show grayed-out or disabled nav items.

```tsx
// Correct -- conditionally render
{canAccess('reservations', 'read') && (
  <NavItem href="/reservations" label="Reservations" />
)}

// Wrong -- show but disable
<NavItem href="/reservations" disabled={!canAccess('reservations', 'read')} />
```

### Action Buttons

Hide buttons for actions the user cannot perform. Do not render disabled buttons for unauthorized actions.

```tsx
// Correct -- hide entirely
{canAccess('reservations', 'create') && (
  <Button onClick={openCreatePanel}>New Reservation</Button>
)}

// Wrong -- show disabled
<Button disabled={!canAccess('reservations', 'create')}>New Reservation</Button>
```

### Rationale

Showing disabled elements for unauthorized actions creates confusion ("Why can't I click this?") and leaks information about available features.

---

## 4. Field-Level Permissions

Some fields are visible or editable only to certain roles.

### Visibility

| Field Type | Visible To |
|-----------|-----------|
| Financial data (pricing, revenue) | `super_admin`, `admin`, `manager` |
| Personal data (ID, credit card) | `super_admin`, `admin` |
| Internal notes | `super_admin`, `admin`, `manager` |
| Audit trail | `super_admin`, `admin` |

### Credit Card Masking

Credit card numbers are always masked by default: `**** **** **** 1234`. Only authorized roles can reveal the full number via an eye/toggle icon.

### Editable vs Read-Only

Some fields may be visible but not editable for certain roles. Render them as plain text (not disabled inputs) when read-only.

```tsx
// Read-only field
{canEdit ? (
  <Input value={value} onChange={onChange} />
) : (
  <span className="text-sm">{value}</span>
)}
```

---

## 5. External Data Locking

Fields populated from external sources (channel managers, booking platforms) are read-only by default.

### Field States

| State | Visual | Behavior |
|-------|--------|----------|
| Editable | Standard input style | Normal editing |
| Locked (external) | Input with lock icon, `bg-accent/70` | Read-only, tooltip explaining source |
| Warning (override) | Input with warning icon, amber border | Editable but shows warning about external sync |

### Override Rules

- `super_admin` and `admin` can override locked fields with a confirmation.
- Override is logged in the audit trail.
- Overridden fields show a visual indicator that the value differs from the external source.

---

## 6. Server-Side Enforcement

### Fail Closed

If a permission check fails or cannot be determined, **deny access**. Never default to allowing.

```typescript
export async function updateReservation(id: string, data: unknown) {
  const user = await getAuthUser()
  
  if (!user || !canAccess(user.role, 'reservations', 'update')) {
    throw new Error('Unauthorized')
  }
  
  // Proceed with update
}
```

### Double Check

Permissions are checked in two places:
1. **UI layer** -- to show/hide elements (convenience).
2. **Server Action / API layer** -- to enforce access (security).

The server check is the authoritative one. The UI check is purely cosmetic.

---

## 7. Permission Check Implementation

### Single Check Function

```typescript
// lib/permissions/check.ts
export function hasPermission(
  role: string,
  module: string,
  action: string
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role]
  if (!rolePerms) return false  // Fail closed
  
  return rolePerms.some(
    p => p.module === module && p.action === action
  )
}

// Convenience wrappers
export function canRead(role: string, module: string) {
  return hasPermission(role, module, 'read')
}

export function canEdit(role: string, module: string) {
  return hasPermission(role, module, 'update')
}

export function canDelete(role: string, module: string) {
  return hasPermission(role, module, 'delete')
}
```

### In Components (via Hook)

```typescript
// hooks/usePermission.ts
export function usePermission(module: string, action: string): boolean {
  const { user } = useAuth()
  if (!user) return false
  return hasPermission(user.role, module, action)
}
```

---

## 8. Audit Trail

All permission-sensitive actions should be logged:

| Field | Value |
|-------|-------|
| `user_id` | Who performed the action |
| `action` | What was done (create, update, delete) |
| `module` | Which module |
| `entity_id` | Which record |
| `timestamp` | When |
| `changes` | What changed (for updates) |

---

## Related Documents

- [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md) -- where permission logic lives in code
- [INTERACTION_RULES.md](./INTERACTION_RULES.md) -- how permissions affect UX
- [RESTRICTIONS_AND_PROHIBITIONS.md](./RESTRICTIONS_AND_PROHIBITIONS.md) -- prohibited shortcuts

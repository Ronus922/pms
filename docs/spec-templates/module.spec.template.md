# Module: [MODULE_NAME]

## Overview

[Brief description of what this module does and its role in the system]

## Entity Definition

### Database Table: `[table_name]`

| Field | Type | Required | Default | Validation | Notes |
|-------|------|----------|---------|------------|-------|
| id | uuid | Yes | gen_random_uuid() | - | PK |
| created_at | timestamptz | Yes | now() | - | Auto |
| updated_at | timestamptz | Yes | now() | - | Auto via trigger |
| deleted_at | timestamptz | No | null | - | Soft delete |
| created_by | uuid | Yes | auth.uid() | - | FK users |
| [FIELD_NAME] | [TYPE] | [Yes/No] | [DEFAULT] | [RULE] | [NOTES] |

### Lookup Fields (from `lookup_items`)

| Field | Category | Fallback Values |
|-------|----------|-----------------|
| [FIELD_NAME] | [CATEGORY_KEY] | [val1, val2, val3] |

## Pages

- [ ] List page: `/[module]` -- main table view with filters
- [ ] Detail: SidePanel -- create/edit/view modes

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| [Module]Page | `app/(dashboard)/[module]/page.tsx` | Server component, data fetching |
| [Module]PageClient | `app/(dashboard)/[module]/[module]-page-client.tsx` | Client wrapper with state |
| [Module]Panel | `components/[module]/[Module]Panel.tsx` | SidePanel for create/edit/view |
| [Module]PanelConfig | `components/[module]/[Module]PanelConfig.ts` | Field registry and section definitions |
| [Module]Table | `components/[module]/[Module]Table.tsx` | DataTable with columns |
| [Module]FilterBar | `components/[module]/[Module]FilterBar.tsx` | Filter controls above table |

## Server Actions

File: `lib/actions/[module].ts`

| Action | Purpose | Input | Output |
|--------|---------|-------|--------|
| get[Module]s | List with filters/pagination | filters, page, pageSize | { data, count } |
| get[Module]ById | Single entity | id | entity or null |
| create[Module] | Create new record | validated form data | { success, data?, error? } |
| update[Module] | Update existing record | id + partial data | { success, data?, error? } |
| delete[Module] | Soft delete | id | { success, error? } |

## Validation Schema

File: `lib/validations/[module].ts`

```typescript
// Shared between client form and server action
import { z } from 'zod'

export const [module]Schema = z.object({
  // [FIELD_NAME]: z.[TYPE]().[RULES],
})

export type [Module]FormData = z.infer<typeof [module]Schema>

// Partial schema for updates
export const [module]UpdateSchema = [module]Schema.partial()
```

## Permissions

### Role x Action Matrix

| Role | View | Create | Edit | Delete | Export | [CUSTOM_ACTION] |
|------|------|--------|------|--------|--------|-----------------|
| super_admin | Yes | Yes | Yes | Yes | Yes | Yes |
| admin | Yes | Yes | Yes | Yes | Yes | Yes |
| manager | Yes | Yes | Yes | No | Yes | [Yes/No] |
| staff | Yes | No | No | No | No | No |
| viewer | Yes | No | No | No | No | No |

### Field-Level Restrictions

| Field | Condition | Behavior |
|-------|-----------|----------|
| [FIELD_NAME] | [CONDITION] | locked / warning / hidden |

### Permission Constants

File: `lib/permissions/constants.ts` -- add to existing

```typescript
[MODULE_NAME]: {
  view: '[module]:view',
  create: '[module]:create',
  edit: '[module]:edit',
  delete: '[module]:delete',
}
```

## Status Flow

```
[STATUS_A] --> [STATUS_B]  (condition: [CONDITION])
[STATUS_B] --> [STATUS_C]  (condition: [CONDITION])
[STATUS_B] --> [STATUS_A]  (condition: [ROLLBACK_CONDITION])
```

### Status Definitions

| Status | Label (Hebrew) | Color | Border Color | Description |
|--------|---------------|-------|-------------|-------------|
| [STATUS] | [HEBREW] | [bg-color] | [border-color] | [WHEN] |

## Dependencies

### Depends On

| Module | Relationship | Notes |
|--------|-------------|-------|
| [MODULE] | [FK/lookup/triggers] | [DETAILS] |

### Depended By

| Module | Relationship | Notes |
|--------|-------------|-------|
| [MODULE] | [FK/lookup/triggers] | [DETAILS] |

## Files to Create

```
app/(dashboard)/[module]/
  page.tsx                          -- Server component
  [module]-page-client.tsx          -- Client page wrapper

components/[module]/
  [Module]Panel.tsx                 -- SidePanel (create/edit/view)
  [Module]PanelConfig.ts            -- Field registry
  [Module]Table.tsx                 -- DataTable
  [Module]FilterBar.tsx             -- Filters

lib/actions/[module].ts             -- Server actions
lib/validations/[module].ts         -- Zod schemas
lib/types/[module].ts               -- TypeScript types
```

## Database Migration

File: `scripts/migrations/[DATE]_[module].sql`

```sql
-- Create table
-- Add indexes
-- Add RLS policies
-- Add triggers (updated_at)
-- Insert default lookup_items if needed
```

## Testing Checklist

### Functionality
- [ ] Create new record -- all fields save correctly
- [ ] Edit existing record -- changes persist
- [ ] Delete record -- soft delete works, record hidden from list
- [ ] List loads with correct data
- [ ] Filters work (each filter individually and combined)
- [ ] Sort works (each sortable column)
- [ ] Pagination works

### Validation
- [ ] Required fields show error when empty
- [ ] Invalid input shows inline error
- [ ] Server-side validation catches bypassed client validation
- [ ] Error messages are in Hebrew

### Permissions
- [ ] Each role sees only allowed actions
- [ ] Hidden buttons/actions for unauthorized roles
- [ ] Server actions reject unauthorized requests
- [ ] RLS policies enforce row-level access

### UI/UX
- [ ] RTL layout correct
- [ ] Mobile responsive (320px to 1920px)
- [ ] SidePanel opens/closes properly
- [ ] Loading states display
- [ ] Empty state displays
- [ ] Error state displays
- [ ] Toast notifications on success/error
- [ ] Touch targets minimum 44x44px
- [ ] Padding rules followed (no content touching borders)

# NEW_MODULE_PROMPT.md -- Create a New Module

> Copy the prompt below and paste it when adding a new module to the project.
> Replace all `[PLACEHOLDER]` values with your module details.

---

## Prompt

```
Create a new module: [MODULE_NAME]

BEFORE CODING, read these files in order:
1. /docs/spec-templates/module.spec.template.md
2. /docs/rules/ARCHITECTURE_RULES.md
3. /docs/rules/DESIGN_SYSTEM.md
4. /docs/components/* (all shared component standards)
5. /docs/flows/create-record-flow.md
6. /docs/flows/update-record-flow.md
7. /docs/rules/PERMISSIONS_RULES.md
8. /docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md

MODULE REQUIREMENTS:

Entity: [MODULE_NAME]
- Fields: [list all fields with types]
  Example:
  - id: uuid (auto-generated)
  - name: string (required, max 100 chars)
  - status: enum [ACTIVE, INACTIVE, ARCHIVED]
  - created_at: timestamp
  - updated_at: timestamp
  - created_by: uuid (FK to users)

- Relationships:
  - [belongs_to / has_many / many_to_many] [OTHER_ENTITY]

- Status flow: [describe valid status transitions]
  Example: ACTIVE -> INACTIVE -> ARCHIVED (one-way)

Pages:
- [ ] List page with DataTable (sorting, filtering, pagination)
- [ ] SidePanel for creating new records
- [ ] SidePanel for viewing/editing existing records
- [ ] [Any additional pages]

Permissions:
- [ROLE_1]: [can create, read, update, delete]
- [ROLE_2]: [can read only]
- [ROLE_3]: [can read, update own records]

Integrations:
- Connects to: [list other modules and how]
- Triggers: [any automated actions, e.g., "on status change, send notification"]

DELIVERABLES (in order):

Phase 1: Specification (present for approval before coding)
- Filled module.spec.template.md with all details
- WAIT FOR APPROVAL before proceeding

Phase 2: Database
- Migration SQL file in scripts/migrations/
- Zod validation schema in lib/types/[module].ts

Phase 3: Server Actions
- CRUD actions in lib/actions/[module].ts
- Permission checks on every action
- Input validation with Zod
- Error handling with proper error messages

Phase 4: UI Components
- Page component: app/(dashboard)/[module]/page.tsx
- List with DataTable: components/[module]/[Module]Table.tsx
- FilterBar: components/[module]/[Module]Filters.tsx
- SidePanel (create): components/[module]/Create[Module]Panel.tsx
- SidePanel (edit): components/[module]/Edit[Module]Panel.tsx
- Any sub-components needed

CONSTRAINTS:
- Use ONLY existing shared components (PanelShell, DataTable, FilterBar, etc.)
- Follow the design system exactly -- no new colors, fonts, or spacing
- RTL layout, mobile responsive
- Status shown as border-r-4 (not dots or badges)
- SidePanel for all detail views (no modals)
- No business logic in JSX
- No any types
- No console.log
- Every server action validates input and checks permissions
- Report all files created and architecture decisions

REPORT FORMAT:
1. Files created: [list with purpose of each]
2. Shared components reused: [list]
3. Design tokens used: [list]
4. Architecture decisions: [explain any non-obvious choices]
5. Permission matrix: [table of role vs action]
6. Risks: [what could break or needs attention]
7. Testing steps: [how to verify everything works]
```

---

## Module Checklist

After creating the module, verify:

- [ ] Spec was approved before coding started
- [ ] Migration file exists and is valid SQL
- [ ] Zod schema matches migration exactly
- [ ] All CRUD server actions exist
- [ ] Every action validates input with Zod
- [ ] Every action checks permissions
- [ ] Every action handles errors gracefully
- [ ] Page renders list with DataTable
- [ ] FilterBar works with all relevant fields
- [ ] SidePanel opens for create and edit
- [ ] Status is shown as border-r-4
- [ ] RTL layout is correct
- [ ] Mobile responsive down to 320px
- [ ] Touch targets are 44x44px minimum
- [ ] All containers have proper padding
- [ ] No `any` types in any file
- [ ] No `console.log` in any file
- [ ] No business logic in JSX components
- [ ] No new patterns introduced -- all existing patterns reused

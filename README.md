# Master Project Template Foundation

A reusable, production-grade project foundation for building Hebrew RTL web applications with Next.js 15, Supabase, TypeScript, and Tailwind CSS.

This is **not** a client project. This is the master template that gets copied into every new project. It contains documented rules, design system specifications, shared components, database schema, validation patterns, and Claude instruction files that ensure consistency across all projects.

---

## What This Template Contains

| Layer | Files | Purpose |
|-------|-------|---------|
| **Rules** | 7 docs | Iron rules for design, architecture, mobile, permissions, restrictions |
| **Design System** | 8 docs | Sapphire visual language — colors, typography, forms, tables, states, layouts, mobile, dialogs |
| **Component Standards** | 9 docs | Specifications for how every shared component must behave |
| **Spec Templates** | 5 docs | Fill-in templates for new modules, flows, permissions, panels, tables |
| **Reference Flows** | 5 docs | Standard CRUD and permission flows with full step-by-step documentation |
| **Database** | 3 SQL files | 16 reusable tables, 10 enums, seed data with roles/permissions |
| **Database Docs** | 8 docs | Entity reference, relations, enums, audit, notifications, files, permissions schema |
| **Claude Instructions** | 7 docs | Master CLAUDE.md, START_HERE, and 5 prompt templates |
| **Shared Code** | 61 TS/TSX files | Types, constants, schemas, validators, hooks, services, components, layouts, helpers |

**Total: 113 template files**

---

## Mandatory Folders

These folders must exist in every project built from this template:

```
/claude/                  Claude instruction files
/docs/
  /rules/                 Binding project rules
  /design/                Visual design specifications
  /components/            Component behavior standards
  /spec-templates/        Templates for new features
  /flows/                 Reference CRUD flows
  /database/              Database documentation
/database/                SQL schema, enums, seed
/src/
  /types/                 Shared TypeScript types
  /constants/             Status maps, permissions, config
  /schemas/               Zod validation schemas
  /validators/            Regex patterns, sanitization
  /hooks/                 Shared React hooks
  /services/              Auth, audit, notifications, files
  /components/
    /shared/              Reusable cross-module components
    /ui/                  Base UI primitives (shadcn/ui)
  /layouts/               App shell, page wrapper
  /lib/
    /helpers/             Utility helper modules
```

---

## Files Claude Must Read First

When starting any session in a project built from this template, Claude must read files in this exact order:

| Order | File | Why |
|-------|------|-----|
| 1 | `/claude/START_HERE.md` | Reading order and quick reference |
| 2 | `/claude/CLAUDE.md` | Iron rules, prohibited patterns, reporting format |
| 3 | `/docs/rules/PROJECT_RULES.md` | Project philosophy and conventions |
| 4 | `/docs/rules/DESIGN_SYSTEM.md` | Sapphire design tokens |
| 5 | `/docs/rules/ARCHITECTURE_RULES.md` | Code organization and data flow |
| 6 | `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md` | What must never be done |

Then, based on the task:

| Task | Also Read |
|------|-----------|
| Any UI work | `/docs/rules/DESIGN_SYSTEM.md` + relevant `/docs/design/*` + relevant `/docs/components/*` |
| New module | `/docs/spec-templates/module.spec.template.md` + `/docs/flows/*` |
| Bug fix | Affected files + `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md` |
| Database work | `/docs/database/DATABASE_RULES.md` + relevant `/docs/database/*` |
| Permissions | `/docs/rules/PERMISSIONS_RULES.md` + `/docs/database/PERMISSIONS_SCHEMA.md` |

---

## How to Start a New Project

### Step 1: Copy the template

```bash
cp -r /path/to/template/ /path/to/new-project/
cd /path/to/new-project/
rm -rf .git node_modules .next
git init
```

### Step 2: Initialize the project

```bash
# Create Next.js app (if not already present)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Install required dependencies
pnpm add @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers \
  zustand nuqs @tanstack/react-table @tanstack/react-query sonner lucide-react \
  clsx tailwind-merge

# Install shadcn/ui base components
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input dialog dropdown-menu checkbox
```

### Step 3: Configure the project

1. Set `dir="rtl"` and `lang="he"` on root `<html>` element
2. Load Noto Sans Hebrew font via `next/font/google`
3. Configure Tailwind with Sapphire color tokens from `/docs/rules/DESIGN_SYSTEM.md`
4. Set up `globals.css` as import-only index (max 30 lines)
5. Configure Supabase environment variables
6. Run the database setup:

```bash
# In Supabase SQL Editor, run in order:
# 1. database/enums.sql
# 2. database/schema.sql
# 3. database/seed.sql
```

### Step 4: Use the Claude init prompt

Copy the contents of `/claude/PROJECT_INIT_PROMPT.md` and paste it as the first message in a new Claude session. Fill in the `[PLACEHOLDER]` values for your project.

### Step 5: Build the first module

Copy `/claude/NEW_MODULE_PROMPT.md`, fill in the details for your first module, and paste it. Claude will:
1. Write a specification (present for approval)
2. Create the database migration
3. Build server actions with validation and permissions
4. Build UI components using the shared component library

---

## How to Add a New Module

1. Copy `/claude/NEW_MODULE_PROMPT.md`
2. Fill in: entity name, fields, relationships, permissions, status flow
3. Paste into Claude session
4. Claude writes a spec from `/docs/spec-templates/module.spec.template.md` — **approve before coding**
5. Claude creates: migration, Zod schema, server actions, page, table, panel, filters
6. All using shared components from `/src/components/shared/`

### Module file structure (created per module):

```
app/(dashboard)/[module]/
  page.tsx                          Server component
  [module]-page-client.tsx          Client wrapper

components/[module]/
  [Module]Panel.tsx                 SidePanel (create/edit/view)
  [Module]Table.tsx                 DataTable with columns
  [Module]FilterBar.tsx             Filters

lib/actions/[module].ts             Server actions (CRUD)
lib/validation/[module].ts          Zod schemas
lib/types/[module].ts               TypeScript types

scripts/migrations/YYYY-MM-DD_[module].sql
```

---

## How to Extract Reusable Logic from an Existing Project

When you identify a pattern in a client project that should become part of the template:

### What qualifies for the template

- A component used identically across 2+ projects (e.g., a better FileUpload)
- A hook that solves a generic problem (e.g., useInfiniteScroll)
- A validation pattern applicable to any project (e.g., Israeli bank account regex)
- A helper function with no domain-specific logic (e.g., formatCurrency)
- A database table/pattern used in every project (e.g., activity_log)
- A documentation rule learned from a production incident

### Extraction process

1. **Identify** the reusable piece in the client project
2. **Strip** all domain-specific code (no hotel names, no client business rules)
3. **Generalize** — replace hardcoded values with props/config/constants
4. **Document** — update the relevant `/docs/` file or create a new one
5. **Test** — verify the extracted code works in isolation
6. **Place** in the correct template directory:

| Type | Template Location |
|------|-------------------|
| React component | `/src/components/shared/` |
| Hook | `/src/hooks/` |
| Helper function | `/src/lib/helpers/` |
| Zod schema | `/src/schemas/` |
| Validation pattern | `/src/validators/` |
| TypeScript type | `/src/types/` |
| Constant/enum | `/src/constants/` |
| Service | `/src/services/` |
| Database table | `/database/schema.sql` |
| Database enum | `/database/enums.sql` |
| Seed data | `/database/seed.sql` |
| Component spec | `/docs/components/` |
| Design pattern | `/docs/design/` |
| Rule | `/docs/rules/` |
| Flow pattern | `/docs/flows/` |

7. **Update** barrel exports (`index.ts`) in the target directory
8. **Update** this README if the template structure changed

### What to strip during extraction

- Client names, project names, brand names
- Business-domain entity names (reservations, invoices, patients, etc.)
- Hardcoded URLs, API keys, environment-specific values
- Project-specific validation rules (e.g., "max 3 rooms per booking")
- Comments referencing specific tickets or PRs

---

## How to Update the Template Safely

### Rules for template updates

1. **Never break existing projects** — template updates must be backwards-compatible
2. **Never remove files without deprecation** — add a deprecation note first, remove in the next major version
3. **Document every change** — update the changelog below
4. **Test the update** — create a fresh project from the updated template and verify it builds

### Update process

```bash
# 1. Make changes in the template repo
cd /path/to/template

# 2. Test by copying to a temp project
cp -r . /tmp/test-project
cd /tmp/test-project
pnpm install
pnpm build  # must pass

# 3. Commit with clear message
git add -A
git commit -m "template: add [description of what was added/changed]"
```

### Propagating updates to existing projects

Template updates do **not** auto-propagate. To apply an update to an existing project:

| File Type | How to Apply |
|-----------|-------------|
| Documentation (`/docs/`, `/claude/`) | Safe to copy directly — reference material only |
| Code (`/src/`) | Review for conflicts with project customizations before copying |
| Database (`/database/`) | Create a new migration in the project — never overwrite existing schema |

---

## What Must Never Be Copied Into the Template

These belong **only** in client projects:

| Category | Examples |
|----------|---------|
| **Domain entities** | reservations, rooms, guests, invoices, patients, products, orders |
| **Business rules** | "check-in requires ID", "minimum 2-night stay", "invoice due in 30 days" |
| **Client branding** | logos, brand colors beyond Sapphire, custom fonts |
| **Environment config** | `.env` files, API keys, database URLs, deployment config |
| **Domain migrations** | Any SQL creating domain tables (rooms, bookings, etc.) |
| **Client content** | Hebrew copy specific to a client ("Welcome to Hotel X") |
| **Integration credentials** | Stripe keys, SendGrid config, WhatsApp tokens |
| **Domain components** | ReservationPanel, GuestCard, RoomGrid, InvoiceTable |
| **Domain hooks** | useReservation, useRoomAvailability, useGuestSearch |
| **Domain actions** | createReservation, updateRoom, sendInvoice |
| **Git history** | `.git/` — each project has its own |
| **Dependencies** | `node_modules/`, lockfiles — each project installs fresh |
| **Build output** | `.next/`, `out/`, `dist/` |

### The test

> "Would this file make sense in a completely different project — a restaurant app, a clinic system, an e-commerce store?"

If **yes** — it belongs in the template.
If **no** — it belongs only in the project.

---

## What Belongs Only in Project-Specific Modules

Each client project extends the template with its own domain:

```
# Project-specific (NOT in template):

app/(dashboard)/reservations/      Domain pages
app/(dashboard)/rooms/
app/(dashboard)/guests/

components/reservations/           Domain components
components/rooms/
components/guests/

lib/actions/reservations.ts        Domain server actions
lib/validation/reservation.ts      Domain Zod schemas
lib/types/reservation.ts           Domain types
lib/constants/reservation.ts       Domain constants

scripts/migrations/
  2026-01-15_reservations.sql      Domain tables

.env.local                         Project secrets
```

### The boundary

| Layer | Template Provides | Project Adds |
|-------|-------------------|-------------|
| **Types** | BaseEntity, User, Task, Notification, FileRecord | Reservation, Room, Guest, Invoice |
| **Components** | SidePanel, DataTable, FilterBar, FormField | ReservationPanel, RoomCard, GuestTable |
| **Hooks** | usePermission, useDebounce, usePagination | useReservation, useRoomAvailability |
| **Services** | auth, audit, notifications, files | booking engine, channel manager, payment |
| **Schemas** | user, task, common patterns | reservation, room, guest |
| **Constants** | TASK_STATUS_MAP, ROLE_HIERARCHY | RESERVATION_STATUS, ROOM_TYPE |
| **Database** | users, roles, permissions, tasks, files | reservations, rooms, guests, invoices |
| **Rules** | Design system, architecture, mobile, permissions | Domain business rules |

---

## Template File Inventory

### Documentation (49 files)

```
/claude/                           7 files
  CLAUDE.md                        Master instructions
  START_HERE.md                    Reading order
  PROJECT_INIT_PROMPT.md           New project prompt
  NEW_MODULE_PROMPT.md             New module prompt
  BUG_FIX_PROMPT.md                Bug fix prompt
  UI_CHANGE_PROMPT.md              UI change prompt
  ARCHITECTURE_REVIEW_PROMPT.md    Architecture audit prompt

/docs/rules/                       7 files
  PROJECT_RULES.md                 Philosophy and iron rules
  DESIGN_SYSTEM.md                 Sapphire design tokens
  INTERACTION_RULES.md             UX behavior patterns
  ARCHITECTURE_RULES.md            Code organization
  MOBILE_RULES.md                  Responsive requirements
  PERMISSIONS_RULES.md             RBAC model
  RESTRICTIONS_AND_PROHIBITIONS.md Hard prohibitions

/docs/design/                      8 files
  COLORS.md                        Color system (light + dark)
  TYPOGRAPHY.md                    Type scale + Hebrew rules
  DIALOGS.md                       SidePanel + confirmation
  TABLES.md                        DataTable specs
  FORMS.md                         All input types
  STATES.md                        Loading, empty, error, etc.
  MOBILE_UI.md                     Mobile-specific patterns
  LAYOUTS.md                       Page structure + sidebar

/docs/components/                  9 files
  dialog-standard.md               SidePanel component spec
  table-standard.md                DataTable component spec
  select-standard.md               Select/Combobox spec
  date-picker-standard.md          DatePicker spec
  form-standard.md                 Form + fields spec
  page-layout-standard.md          Page layout spec
  cards-standard.md                Card variants spec
  filters-standard.md              FilterBar spec
  empty-loading-error-standard.md  State components spec

/docs/spec-templates/              5 files
  module.spec.template.md          New module template
  flow.template.md                 Business flow template
  permissions.template.md          Permissions matrix template
  dialog.template.md               SidePanel spec template
  table.template.md                DataTable spec template

/docs/flows/                       5 files
  create-record-flow.md            Standard create flow
  update-record-flow.md            Standard update flow
  delete-record-flow.md            Standard delete flow (soft)
  upload-flow.md                   File upload flow
  permissions-flow.md              9-layer permission flow

/docs/database/                    8 files
  DATABASE_RULES.md                Conventions and patterns
  ENTITIES.md                      All 16 tables documented
  RELATIONS.md                     ER diagram and FK map
  ENUMS.md                         All 10 enum types
  AUDIT_LOGS.md                    Audit system guide
  NOTIFICATIONS.md                 Notification system guide
  FILES_AND_UPLOADS.md             File management guide
  PERMISSIONS_SCHEMA.md            RBAC implementation guide
```

### Database (3 files)

```
/database/
  enums.sql                        10 PostgreSQL enum types
  schema.sql                       16 tables + indexes + RLS
  seed.sql                         Roles, permissions, defaults
```

### Code (61 files)

```
/src/types/                        5 files — TypeScript interfaces
/src/constants/                    4 files — Status maps, config, permissions
/src/schemas/                      4 files — Zod validation schemas
/src/validators/                   3 files — Regex patterns, sanitization
/src/hooks/                        9 files — React hooks (URL state, permissions, media)
/src/services/                     6 files — Auth, audit, notifications, files
/src/components/shared/           16 files — 15 production components + barrel
/src/components/ui/                1 file  — shadcn/ui install guide
/src/layouts/                      3 files — AppShell + PageLayout
/src/lib/helpers/                  9 files — Date, table, filter, upload, etc.
/src/lib/                          1 file  — cn() utility
```

**Grand total: 113 files**

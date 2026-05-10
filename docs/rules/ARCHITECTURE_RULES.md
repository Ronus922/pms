# Architecture Rules

> Code organization, data flow, and structural patterns.
> Every file must have a clear reason for existing in its specific location.

---

## 1. Directory Structure

```
/app
  /(dashboard)/
    /{module}/
      page.tsx              # Server component, data fetching
      {module}-page-client.tsx  # Client component, interactivity
  /api/                     # Route handlers (when needed)
  /styles/                  # CSS partials (imported by globals.css)
  providers.tsx             # Client providers (QueryClient, Theme, etc.)
  globals.css               # Only @import statements (max 30 lines)

/components
  /shared/                  # Cross-module reusable components
    PanelShell.tsx          # SidePanel wrapper
    DataTable.tsx           # Generic data table
    FilterBar.tsx           # Filter/search bar
    StatusPill.tsx          # Status indicator
    SourceBadge.tsx         # Source badge
    SearchableSelect.tsx    # Searchable dropdown
    ConfirmDialog.tsx       # Destructive action confirmation
  /ui/                      # Base shadcn/ui components
    button.tsx
    input.tsx
    dialog.tsx
    ...
  /{module}/                # Module-specific components
    {Module}Panel.tsx       # Entity SidePanel
    {Module}Form.tsx        # Create/edit form
    {Module}Table.tsx       # Module table
    {Module}Filters.tsx     # Module-specific filters

/hooks
  useDebounce.ts
  useLookup.ts
  usePermission.ts
  ...

/lib
  /actions/                 # Server Actions (Next.js)
    {module}.ts             # CRUD actions per module
  /validation/              # Zod schemas
    {module}.ts             # One schema file per entity
  /permissions/
    check.ts                # Permission check utilities
    constants.ts            # Permission definitions
  /stores/                  # Zustand stores
    {module}-store.ts

/services                   # External service clients
  supabase.ts
  email.ts
  ...

/constants                  # Enums, config objects, lookup tables
  reservation.ts
  room.ts
  ...

/types                      # Shared TypeScript interfaces
  {module}.ts
  database.ts
```

---

## 2. Core Principles

### Single Source of Truth

One entity = one panel = one config = one validation schema.

```
Reservation entity:
  - Panel:      components/reservations/ReservationPanel.tsx (one panel, mode prop for create/edit/view)
  - Schema:     lib/validation/reservation.ts (one Zod schema, used by form AND server action)
  - Actions:    lib/actions/reservation.ts (all CRUD in one file)
  - Types:      types/reservation.ts (one type definition)
  - Config:     constants/reservation.ts (status maps, source maps, etc.)
```

### No Parallel Workflows

There must be exactly one data flow path for each operation. If data can be created through a form, it should not also be creatable through a different mechanism that bypasses the same validation.

---

## 3. Data Flow

### Read Path

```
page.tsx (Server Component)
  → Supabase query (server-side)
  → Pass data as props to Client Component
  → Client Component renders UI
  → Client-side filters/sorting via URL params (nuqs)
```

### Write Path

```
User fills form (react-hook-form + zod)
  → Submit calls Server Action (lib/actions/)
  → Server Action validates with same Zod schema
  → Server Action calls Supabase
  → Revalidate path
  → Toast success/error
```

### State Management

| State Type | Tool | Location |
|------------|------|----------|
| Server data | React Query / Server Components | Page level |
| URL state (filters, pagination) | `nuqs` | URL params |
| Form state | `react-hook-form` | Component level |
| UI state (panel open, sidebar collapsed) | `zustand` | `/lib/stores/` |
| Global state (auth, theme) | React Context | `providers.tsx` |

---

## 4. Prohibitions

### No API Calls in UI Components

UI components receive data via props or hooks. They never call Supabase or fetch directly.

```tsx
// Wrong
function RoomCard() {
  const { data } = await supabase.from('rooms').select('*')  // NO
}

// Correct
function RoomCard({ room }: { room: Room }) {
  // Render only
}
```

### No Duplicated Validation

One Zod schema shared between form validation and server action validation.

```tsx
// lib/validation/reservation.ts
export const reservationSchema = z.object({
  guest_name: z.string().min(1, 'Required'),
  check_in: z.string().date(),
  check_out: z.string().date(),
})

// Used in form:
const form = useForm({ resolver: zodResolver(reservationSchema) })

// Used in server action:
export async function createReservation(data: unknown) {
  const parsed = reservationSchema.safeParse(data)
  // ...
}
```

### No Duplicated Permission Checks

One check function per entity, used everywhere that entity is accessed.

```tsx
// lib/permissions/check.ts
export function canEditReservation(userRole: string): boolean {
  return hasPermission(userRole, 'reservations', 'edit')
}

// Used in UI (to show/hide button):
{canEditReservation(role) && <EditButton />}

// Used in server action (to authorize):
if (!canEditReservation(role)) throw new Error('Unauthorized')
```

### No Business Logic in UI Components

Extract to hooks, utilities, or service functions.

```tsx
// Wrong
function PricingTab() {
  const total = nights * rate * (1 + tax) - discount + extras  // Business logic in JSX
}

// Correct
// lib/utils/pricing.ts
export function calculateTotal(params: PricingParams): number { ... }

// Component just calls the function
function PricingTab() {
  const total = calculateTotal({ nights, rate, tax, discount, extras })
}
```

---

## 5. File Size Limits

| File Type | Max Lines | Action When Exceeded |
|-----------|-----------|---------------------|
| Component | 300 | Split into sub-components |
| Server Action file | 500 | Split by operation type |
| CSS partial | 1500 | Split into sub-partials |
| Type file | 200 | Split by domain |
| `globals.css` | 30 | Only `@import` statements |

---

## 6. Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `ReservationPanel.tsx` |
| Hook files | camelCase with `use` prefix | `useDebounce.ts` |
| Action files | kebab-case or entity name | `reservation.ts` |
| Store files | kebab-case with `-store` suffix | `reservation-store.ts` |
| Type files | kebab-case or entity name | `reservation.ts` |
| Constants | UPPER_SNAKE_CASE for values | `RESERVATION_STATUS` |
| CSS files | kebab-case | `calendar-grid.css` |

---

## Related Documents

- [PROJECT_RULES.md](./PROJECT_RULES.md) -- core philosophy and iron rules
- [PERMISSIONS_RULES.md](./PERMISSIONS_RULES.md) -- permission architecture
- [RESTRICTIONS_AND_PROHIBITIONS.md](./RESTRICTIONS_AND_PROHIBITIONS.md) -- code prohibitions

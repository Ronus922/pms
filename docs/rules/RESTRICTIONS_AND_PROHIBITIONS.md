# Restrictions and Prohibitions

> Hard rules that must never be violated. Each prohibition exists because it was learned the hard way.
> If in doubt, the answer is "don't do it."

---

## 1. Design Prohibitions

### No Redesign Without Approval

Do not change colors, layout structure, typography, spacing system, or interaction patterns without explicit approval. The design system is locked. Propose changes -- do not implement them.

### No Replacing Working Patterns

If a pattern is working (e.g., SidePanel for entity details), do not replace it with a "better" generic alternative. Consistency beats novelty.

### No Centered Floating Modals

All forms, details, wizards, and entity views use the **SidePanel** pattern. No centered floating dialogs for content. The only exception is small confirmation dialogs for destructive actions.

### No Material UI / Bootstrap Look

The design system is Sapphire. No default Material Design shadows, no Bootstrap grid-looking layouts, no generic admin dashboard templates.

### No Square Buttons or Cards

Everything uses rounded corners as defined in the design system (`rounded-xl` for buttons/inputs, `rounded-[20px]` for cards). Zero sharp corners.

### No Harsh or Neon Colors

Stay within the defined color palette. No lime green, hot pink, bright orange, or neon blue. Status colors use Tailwind's 500 weight.

### No Inline Styles

Use Tailwind classes exclusively. No `style={{ ... }}` attributes except for truly dynamic values that cannot be expressed as classes (e.g., calculated widths from data).

```tsx
// Wrong
<div style={{ marginTop: '16px', color: '#003aa0' }}>

// Correct
<div className="mt-4 text-primary">
```

---

## 2. Code Prohibitions

### No `any` Type

Every variable, parameter, and return value must have a proper TypeScript type. Use `unknown` and narrow with type guards if the type is genuinely unknown.

```typescript
// Wrong
function processData(data: any) { ... }

// Correct
function processData(data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error('Invalid data')
  // parsed.data is now typed
}
```

### No `console.log` in Production

Remove all `console.log` statements before committing. Use a structured logging utility for server-side logging if needed. Client-side should have no console output.

### No Unused Imports or Dead Code

Every import must be used. Every function must be called. Every variable must be referenced. Remove dead code immediately -- do not comment it out "for later."

### No `@ts-ignore` Without Explanation

If you absolutely must suppress a TypeScript error, use `@ts-expect-error` with a comment explaining why and a plan for fixing it.

```typescript
// Wrong
// @ts-ignore
someFunction(badType)

// Acceptable (rare)
// @ts-expect-error -- library types are incorrect, see issue #123
someFunction(badType)
```

---

## 3. Architecture Prohibitions

### No Business Logic in Visual Components

Components render UI. Business logic (calculations, validation, data transformation) belongs in hooks, utilities, or server actions.

### No Duplicate State

One source of truth for every piece of data. If a value exists in the database, do not also store it in local state and keep them "in sync." Read from one place.

### No Magic Strings for Business-Critical Values

Use constants or enums for status codes, role names, permission keys, and any string that controls business behavior.

```typescript
// Wrong
if (reservation.status === 'confirmed') { ... }

// Correct
import { RESERVATION_STATUS } from '@/constants/reservation'
if (reservation.status === RESERVATION_STATUS.CONFIRMED) { ... }
```

### No Hidden Side Effects

Functions should do what their name says. A function called `formatDate` should not also update a database record. A component called `RoomCard` should not trigger an API call on render.

### No Scattered API Calls

All data access goes through Server Actions (`/lib/actions/`) or a service layer (`/services/`). Components never call `supabase.from(...)` directly.

---

## 4. UX Prohibitions

### No Silent Failures

If an action fails, the user must see a clear error message. Never catch an error and do nothing.

```typescript
// Wrong
try {
  await deleteReservation(id)
} catch {
  // silently fails
}

// Correct
try {
  await deleteReservation(id)
  toast.success('Reservation deleted')
} catch (error) {
  toast.error('Failed to delete reservation. Please try again.')
}
```

### No Fake Success Messages

Never show "Saved successfully" before verifying the server acknowledged the save. Wait for the response.

```typescript
// Wrong
toast.success('Saved!')
await saveData(data)  // Might fail after toast

// Correct
const result = await saveData(data)
if (result.success) {
  toast.success('Saved!')
}
```

### No Vague Completion Claims

When reporting task completion, specify exactly what was done. "Done!" is not acceptable. "Created reservation #12345 for Room 101, check-in 2026-04-15" is acceptable.

---

## 5. Performance Prohibitions

### No Unoptimized Images

All images must use Next.js `Image` component with proper `width`, `height`, and `loading="lazy"` where appropriate.

### No Unnecessary Re-renders

Avoid passing new object/array references on every render. Use `useMemo`, `useCallback`, and proper key props.

### No N+1 Queries

When loading a list of entities with related data, use joins or batch queries. Never loop through a list making individual queries.

```typescript
// Wrong -- N+1
const rooms = await getRooms()
for (const room of rooms) {
  room.reservations = await getReservations(room.id)  // N queries
}

// Correct -- single query with join
const rooms = await supabase
  .from('rooms')
  .select('*, reservations(*)')
```

---

## 6. Security Prohibitions

### No Client-Side-Only Auth Checks

Every permission check in the UI must be backed by a server-side check. The UI check is cosmetic; the server check is the authority.

### No Secrets in Client Code

API keys, database URLs, and service credentials must never appear in client-side code or be importable by client components.

### No Trusting Client Input

All user input is validated server-side with Zod schemas before any database operation. Client-side validation is a convenience, not a security measure.

---

## Quick Reference

| Category | Prohibition |
|----------|------------|
| Design | No centered modals |
| Design | No square corners |
| Design | No harsh/neon colors |
| Design | No inline styles |
| Design | No redesign without approval |
| Code | No `any` type |
| Code | No `console.log` |
| Code | No unused imports |
| Code | No dead code |
| Architecture | No business logic in components |
| Architecture | No duplicate state |
| Architecture | No magic strings |
| Architecture | No scattered API calls |
| UX | No silent failures |
| UX | No fake success messages |
| UX | No vague completion claims |
| Performance | No N+1 queries |
| Security | No client-only auth checks |
| Security | No secrets in client code |

---

## Related Documents

- [PROJECT_RULES.md](./PROJECT_RULES.md) -- what TO do
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) -- correct visual patterns
- [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md) -- correct code patterns
- [PERMISSIONS_RULES.md](./PERMISSIONS_RULES.md) -- correct auth patterns

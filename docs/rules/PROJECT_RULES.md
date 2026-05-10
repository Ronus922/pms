# Project Rules

> Core philosophy and iron rules that govern every line of code in this project.
> All contributors must follow these rules without exception.

---

## Philosophy

1. **Consistency over cleverness** -- every screen, component, and interaction must feel like part of one cohesive product.
2. **Production-ready always** -- no mock data, no placeholder logic, no "temporary" workarounds in committed code.
3. **Explicit over implicit** -- every decision should be traceable. No hidden side effects, no magic behavior.

---

## Iron Rules

### 1. No Redesign Without Approval

Do not change the visual language, layout structure, or interaction patterns without explicit approval. The design system (see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)) is the single source of truth. If you think something needs changing, propose it -- do not implement it.

### 2. Preserve the Four Pillars

Every change must maintain:

| Pillar | Requirement |
|--------|-------------|
| **Consistency** | Matches existing patterns and design tokens |
| **Accessibility** | Keyboard navigable, screen-reader friendly, proper contrast |
| **Mobile compatibility** | Works at 320px, no overflow, touch targets met |
| **RTL correctness** | Right-to-left layout, mirrored icons where needed |

### 3. No Duplicate Logic

- One Zod schema per entity, shared by form and server action.
- One permission check function per entity, not scattered across components.
- One panel configuration per entity, not separate create/edit windows.
- If you find yourself copying code, extract a shared component or utility.

### 4. No Hidden Business Rules

Business logic must live in clearly named functions, not buried inside UI components. If a reservation requires a minimum stay of 2 nights, that rule belongs in a validation schema or a constants file -- not in a ternary inside JSX.

### 5. No Mock Logic in Production

No `if (process.env.NODE_ENV === 'development')` blocks that fake API responses. No hardcoded data pretending to be dynamic. No `setTimeout` simulating loading states.

### 6. DRY Components -- Reuse Before Creating

Before creating a new component, check:

```
ls components/shared/
ls components/ui/
```

If a similar component exists, extend it with props. Do not create a parallel version.

### 7. CSS Cleanup

When removing or disabling a UI element, always ask: "Should the associated CSS/classes be removed too?" Never leave orphan styles.

### 8. Gap Over Margin

The parent element controls spacing between children using `gap`. Children should not add their own margins to create spacing between siblings.

```tsx
// Correct -- parent controls spacing
<div className="flex flex-col gap-4">
  <Input />
  <Input />
</div>

// Wrong -- children manage their own spacing
<div className="flex flex-col">
  <Input className="mb-4" />
  <Input />
</div>
```

### 9. Content Never Touches Border

Every container with a visible border or background must have padding. No exceptions.

| Element | Minimum Padding |
|---------|----------------|
| Button | `px-4 py-2` |
| Card / Container | `p-4` |
| Input | `px-3 py-2` |
| Badge | `px-2 py-0.5` |
| Table Cell | `px-4 py-3` |
| List Item | `p-3` |
| Modal / Panel | `p-6` |

### 10. TypeScript Strict Mode

- No `any` type. Use `unknown` and narrow, or define proper interfaces.
- No `console.log` in committed code. Use a proper logging utility or remove before commit.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.

---

## Task Accountability

Every completed task must report:

| Item | Description |
|------|-------------|
| **Files reviewed** | Which files were read before making changes |
| **Files changed** | Which files were modified and why |
| **Root cause** | What triggered the need for this change |
| **Why here** | Why the change belongs in this specific file/location |
| **Risks** | What could break as a side effect |
| **Intentionally unchanged** | What was considered but deliberately left alone |

---

## Related Documents

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) -- visual language and tokens
- [INTERACTION_RULES.md](./INTERACTION_RULES.md) -- UX behavior patterns
- [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md) -- code organization
- [MOBILE_RULES.md](./MOBILE_RULES.md) -- responsive requirements
- [PERMISSIONS_RULES.md](./PERMISSIONS_RULES.md) -- role-based access
- [RESTRICTIONS_AND_PROHIBITIONS.md](./RESTRICTIONS_AND_PROHIBITIONS.md) -- hard prohibitions

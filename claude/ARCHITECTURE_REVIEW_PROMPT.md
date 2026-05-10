# ARCHITECTURE_REVIEW_PROMPT.md -- Architecture Audit

> Copy the prompt below and paste it when running an architecture review.
> Replace all `[PLACEHOLDER]` values with the review scope.

---

## Prompt

```
Architecture Review: [SCOPE]

Scope: [specific module / specific feature / full project]
Depth: [quick scan / thorough review / deep audit]
Focus areas: [all / specific concerns, e.g., "permission checks" or "data flow"]

READ FIRST:
1. /docs/rules/ARCHITECTURE_RULES.md
2. /docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md
3. /docs/rules/PERMISSIONS_RULES.md
4. /docs/rules/DESIGN_SYSTEM.md (for component structure rules)

REVIEW CHECKLIST:

1. Business Logic Placement
   - [ ] No business logic in JSX components
   - [ ] Logic lives in hooks, utils, or server actions
   - [ ] Components only render and delegate events

2. Validation
   - [ ] Zod schemas exist for all entities
   - [ ] Server actions validate input before processing
   - [ ] Form validation uses the same Zod schema (single source of truth)
   - [ ] No duplicated validation logic between client and server

3. Permissions
   - [ ] Every server action checks permissions
   - [ ] RLS policies exist for all tables
   - [ ] UI hides actions the user cannot perform
   - [ ] Permission checks are not only client-side

4. Data Flow
   - [ ] API calls are in server actions or lib/actions/, not in components
   - [ ] No direct Supabase calls from components
   - [ ] Data fetching follows a consistent pattern
   - [ ] Error states are handled at every level

5. State Management
   - [ ] No duplicate state (same data in multiple stores or components)
   - [ ] Zustand stores are minimal and focused
   - [ ] URL state used for filters, search, pagination (via nuqs)
   - [ ] Form state managed by react-hook-form, not manual useState

6. Type Safety
   - [ ] No any types anywhere
   - [ ] No as any assertions
   - [ ] No @ts-ignore comments
   - [ ] All function parameters and returns are typed
   - [ ] Database types match Zod schemas

7. Constants and Configuration
   - [ ] No magic strings or numbers
   - [ ] All constants in lib/constants/
   - [ ] Enum values defined once and imported
   - [ ] Configuration in a single location

8. Error Handling
   - [ ] Server actions return structured errors
   - [ ] Components display errors to users
   - [ ] Network errors are caught and handled
   - [ ] No silent failures (empty catch blocks)

9. Code Organization
   - [ ] Files are in correct directories per ARCHITECTURE_RULES.md
   - [ ] No orphan files (unused imports, dead code, unreferenced components)
   - [ ] Naming conventions followed consistently
   - [ ] Shared code is in components/shared/ or lib/utils/

10. Component Architecture
    - [ ] Shared components are used (not rebuilt)
    - [ ] SidePanel used for all detail/edit views (no modals)
    - [ ] Status shown as border-r-4 (not dots/badges)
    - [ ] Single source of truth: one entity = one panel = one config

11. Performance
    - [ ] No unnecessary re-renders (check dependency arrays)
    - [ ] Large lists use pagination or virtualization
    - [ ] Images are optimized (next/image)
    - [ ] No blocking operations on the main thread

12. Security
    - [ ] No secrets in client-side code
    - [ ] Input sanitized before database operations
    - [ ] CSRF protection on mutations
    - [ ] No SQL injection vectors (parameterized queries)

REPORT FORMAT:

| # | Issue | File | Line | Severity | Description | Recommended Fix |
|---|-------|------|------|----------|-------------|-----------------|
| 1 | [short name] | [path] | [line] | [severity] | [what is wrong] | [how to fix] |

SEVERITY LEVELS:
- CRITICAL: Security vulnerability, data loss risk, broken functionality
- WARNING: Architecture violation, maintenance risk, performance issue
- INFO: Style inconsistency, naming convention, minor improvement

SUMMARY (at the end of the report):
- Total issues: [count by severity]
- Most affected area: [which part of the codebase has the most issues]
- Top 3 priorities: [the 3 most important things to fix first]
- Architecture health: [HEALTHY / NEEDS ATTENTION / AT RISK]
- Recommended next steps: [ordered list of actions]
```

---

## Review Scope Guide

| Scope | What to Review | Time Estimate |
|-------|----------------|---------------|
| **Single component** | The component + its imports + its consumers | 5-10 min |
| **Single module** | All files in the module directory + its server actions + its types | 15-30 min |
| **Feature** | All modules involved in the feature + data flow between them | 30-60 min |
| **Full project** | Everything above + cross-cutting concerns (auth, permissions, shared) | 1-2 hours |

---

## Architecture Anti-Patterns to Flag

| Anti-Pattern | Why It Matters | Correct Pattern |
|--------------|----------------|-----------------|
| God component (500+ lines) | Unmaintainable, untestable | Split into smaller components |
| Prop drilling (3+ levels) | Fragile, hard to refactor | Zustand store or Context |
| Copy-paste components | Diverge over time, bugs multiply | Shared component with props |
| Mixed concerns (UI + logic + data) | Cannot test or reuse | Separate layers |
| Direct DB calls from components | Security risk, no validation | Server actions in lib/actions/ |
| Client-side permission only | Can be bypassed | Server-side check + client hint |
| Magic strings | Typos cause silent bugs | Constants in lib/constants/ |
| Catch-all error handler | Hides real issues | Specific error handling per case |
| Circular imports | Build fails, runtime errors | Restructure dependency graph |
| Barrel exports (index.ts) | Tree-shaking issues, slow builds | Direct imports |

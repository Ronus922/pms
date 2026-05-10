# TEMPLATE_INTEGRATION_PROMPT.md -- Integrate Template Into Existing Project

> Copy the prompt below when you need to bring an existing project into alignment with this template.
> This is for projects that were NOT started from the template but should adopt its standards.

---

## Prompt

```
Integrate the Master Template Foundation into this existing project.

BEFORE MAKING ANY CHANGES:
1. Read /claude/START_HERE.md
2. Read /claude/CLAUDE.md
3. Read /claude/PROJECT_MEMORY.md
4. Read all files in /docs/rules/
5. Read /docs/rules/ARCHITECTURE_RULES.md carefully — understand the target structure
6. Read /docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md — understand what must change

EXISTING PROJECT:
- Name: [PROJECT_NAME]
- Current state: [describe — how many modules, what stack, what works, what doesn't]
- Known issues: [list architectural problems, inconsistencies, technical debt]
- What must NOT break: [list critical functionality that must keep working]

INTEGRATION PHASES:

Phase 1: Audit (DO NOT CHANGE CODE YET)
1. Map current directory structure against /docs/rules/ARCHITECTURE_RULES.md
2. Identify files in wrong locations
3. Identify duplicated logic (validation, permissions, components)
4. Identify design system violations (colors, spacing, corners, modals)
5. Identify missing shared components (using custom one-offs instead)
6. Identify missing TypeScript types or uses of `any`
7. Identify scattered API calls (should be in server actions)
8. Present audit report with severity ratings

Phase 2: Foundation (no UI changes, no breaking changes)
1. Copy /src/types/ into project (merge with existing types)
2. Copy /src/constants/ (merge status maps, add missing ones)
3. Copy /src/validators/ (merge patterns)
4. Copy /src/schemas/common.ts (reusable Zod patterns)
5. Copy /src/lib/helpers/ (date, filter, table, upload helpers)
6. Copy /src/lib/utils.ts (cn helper if missing)
7. Copy /src/hooks/ (replace per-component copies with shared hooks)
8. Run TypeScript check — fix any type errors from new types

Phase 3: Shared Components (gradual replacement)
1. Copy /src/components/shared/ into project
2. For each existing component that duplicates a shared one:
   a. Compare props and behavior
   b. Migrate to the shared component one usage at a time
   c. Test after each migration
   d. Delete the old component when all usages are migrated
3. Do NOT migrate all at once — one component at a time

Phase 4: Architecture Alignment (refactor)
1. Move scattered API calls into /lib/actions/ server actions
2. Consolidate duplicate Zod schemas into /schemas/
3. Consolidate duplicate permission checks into shared hook
4. Move business logic out of JSX into hooks/utils
5. Ensure URL state for filters (install nuqs if missing)

Phase 5: Documentation
1. Copy /docs/ into project
2. Update project-specific values (entity names, custom rules)
3. Copy /claude/ into project
4. Create project-specific PROJECT_MEMORY.md entries
5. Update INDEX.md with project-specific files

CONSTRAINTS:
- Do NOT break existing functionality
- Do NOT change business logic during migration
- Do NOT redesign UI during migration (architecture only)
- Migrate one module at a time
- Test after every change
- Report after every phase

REPORT FORMAT (after each phase):
1. Files reviewed: [list]
2. Files changed: [list with what changed]
3. Files created: [list]
4. Files deleted: [list with reason]
5. Risks: [what could break]
6. What was NOT changed: [and why]
7. Next phase prerequisites: [what must be true before next phase]
```

---

## Integration Checklist

After all phases, verify:

- [ ] Directory structure matches /docs/rules/ARCHITECTURE_RULES.md
- [ ] All shared components from /src/components/shared/ are available
- [ ] No duplicate Zod schemas — one per entity
- [ ] No duplicate permission checks — one shared function
- [ ] No direct Supabase calls from components — all in server actions
- [ ] No `any` types remaining
- [ ] No `console.log` in committed code
- [ ] URL state for all filters/pagination (nuqs)
- [ ] SidePanel for all entity detail/edit views (no centered modals)
- [ ] Status shown as border-r-4 (no dots/badges)
- [ ] RTL layout correct on all pages
- [ ] Mobile responsive at 320px
- [ ] Touch targets 44x44px minimum
- [ ] Padding on all containers (per minimum padding table)
- [ ] /claude/CLAUDE.md present and accurate
- [ ] /claude/INDEX.md up to date
- [ ] /claude/PROJECT_MEMORY.md contains project-specific decisions

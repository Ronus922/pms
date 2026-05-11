# START_HERE.md -- Read This First

> You are working on a project built from the **Master Template Foundation**.
> This file defines the exact reading order. Follow it before writing any code.

---

## Reading Order

Read these files in this exact sequence:

| Step | File | Purpose |
|------|------|---------|
| 1 | `/claude/START_HERE.md` | You are here |
| 2 | `/claude/CLAUDE.md` | Master instruction file -- iron rules, governance, prohibited patterns |
| 3 | `/claude/PROJECT_MEMORY.md` | Permanent decisions, conventions, non-negotiable rules |
| 4 | `/claude/INDEX.md` | Complete template file navigation |
| 5 | `/docs/rules/PROJECT_RULES.md` | Project-wide conventions -- naming, file structure, commit style |
| 6 | `/docs/rules/DESIGN_SYSTEM.md` | Sapphire design system -- colors, typography, spacing, tokens |
| 7 | `/docs/rules/INTERACTION_RULES.md` | User interaction patterns -- SidePanel, toasts, confirmations, loading |
| 8 | `/docs/rules/ARCHITECTURE_RULES.md` | Code architecture -- layers, data flow, validation, state management |
| 9 | `/docs/rules/MOBILE_RULES.md` | Mobile-first responsive rules -- breakpoints, touch targets, layout shifts |
| 10 | `/docs/rules/PERMISSIONS_RULES.md` | Role-based access -- permission matrix, field locking, RLS policies |
| 11 | `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md` | Forbidden patterns -- what you must never do |

### Then, based on your task:

| If your task involves... | Also read |
|--------------------------|-----------|
| UI / visual changes | `/docs/design/*` relevant files |
| Building components | `/docs/components/*` relevant files |
| Creating a new module | `/docs/spec-templates/module.spec.template.md` |
| CRUD operations | `/docs/flows/create-record-flow.md`, `/docs/flows/update-record-flow.md` |
| Bug fixing | The affected files + `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md` |

---

## Quick Reference -- Critical Rules

These are the rules most commonly violated. Memorize them.

### Layout

- **RTL first**: `dir="rtl"` on root. `flex-row-reverse` for sequential items (steps, breadcrumbs).
- **Mobile first**: Start at 320px. Use `sm:`, `md:`, `lg:` to scale up.
- **Gap over margin**: Parent sets `gap-*`. Children never use `margin` for layout spacing.
- **Padding always**: Content never touches its container border.

### Components

- **SidePanel, not modals**: All forms, wizards, detail views open in a SidePanel from the left (RTL).
- **Status = border-r-4**: Entity status is a colored right border. Never use dots or badges.
- **Single source of truth**: One entity has one panel, one config, one validation schema. No duplicates.
- **DRY**: If a pattern repeats, extract it into a shared component.

### Code Quality

- **TypeScript strict**: No `any`, no `as any`, no `@ts-ignore`.
- **No console.log**: Remove all debug logging before committing.
- **No business logic in JSX**: Extract to hooks, utils, or server actions.
- **Lucide icons only**: No mixing icon libraries.

### Design System

- **Primary color**: `#1e40af` (Azure Ethos — replaced Sapphire `#003aa0` on 2026-05-08; see `PROJECT_MEMORY.md` → Azure Ethos colors)
- **Font**: Noto Sans Hebrew
- **Corners**: Always rounded (`rounded-lg` minimum)
- **Touch targets**: 44x44px minimum for interactive elements
- **Spacing**: 4px grid (Tailwind default)

### Minimum Padding

| Element | Minimum |
|---------|---------|
| Button | `px-4 py-2` |
| Card | `p-4` |
| Input | `px-3 py-2` |
| Badge | `px-2 py-0.5` |
| Table Cell | `px-4 py-3` |
| List Item | `p-3` |
| Panel | `p-6` |

---

## Prompt Templates

Use these prompt templates for common tasks:

| Task | Prompt File |
|------|-------------|
| Start a new project | `/claude/PROJECT_INIT_PROMPT.md` |
| Create a new module | `/claude/NEW_MODULE_PROMPT.md` |
| Fix a bug | `/claude/BUG_FIX_PROMPT.md` |
| Make a UI change | `/claude/UI_CHANGE_PROMPT.md` |
| Architecture audit | `/claude/ARCHITECTURE_REVIEW_PROMPT.md` |
| Integrate template into existing project | `/claude/TEMPLATE_INTEGRATION_PROMPT.md` |

---

## Governance Reminder

Before completing ANY task, check whether the task requires updates to:

| File | Update When |
|------|-------------|
| `/claude/PROJECT_MEMORY.md` | A permanent decision was made |
| `/claude/CHANGELOG.md` | Any file was created, modified, or deleted |
| `/claude/INDEX.md` | Any new file was created |
| `/docs/rules/*` | A rule was added or changed |
| `/docs/components/*` | A component standard was added or changed |
| `/docs/database/*` | A database change was made |
| `/docs/flows/*` | A flow was added or changed |

If yes: update them as part of the same task. Do not leave the template out of sync.

---

## Acknowledgment

After reading all required files, confirm by listing:
1. The iron rules you will follow
2. The design system tokens you will use
3. The prohibited patterns you will avoid
4. The architecture layers you will respect
5. The governance files you will maintain

Then proceed with the task.

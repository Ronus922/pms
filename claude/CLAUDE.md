# CLAUDE.md -- Master Instruction File

> This project is built from the **Master Template Foundation**.
> All documentation under `/docs/` is **binding** -- not suggestions.

---

## First Steps

1. Read `/claude/START_HERE.md` before doing anything
2. Follow the reading order specified there
3. Never skip documentation -- every rule exists for a reason

---

## Documentation Map

```
/claude/
  CLAUDE.md              -- You are here
  START_HERE.md          -- Reading order and quick reference
  PROJECT_INIT_PROMPT.md -- Prompt for starting a new project
  NEW_MODULE_PROMPT.md   -- Prompt for creating a new module
  BUG_FIX_PROMPT.md      -- Prompt for fixing bugs
  UI_CHANGE_PROMPT.md    -- Prompt for UI changes
  ARCHITECTURE_REVIEW_PROMPT.md -- Prompt for architecture audits

/docs/
  rules/
    PROJECT_RULES.md              -- Project-wide conventions
    DESIGN_SYSTEM.md              -- Sapphire design system tokens
    INTERACTION_RULES.md          -- User interaction patterns
    ARCHITECTURE_RULES.md         -- Code architecture standards
    MOBILE_RULES.md               -- Responsive / mobile-first rules
    PERMISSIONS_RULES.md          -- Role-based access control
    RESTRICTIONS_AND_PROHIBITIONS.md -- Forbidden patterns
  design/                         -- Per-component design specs
  components/                     -- Shared component standards
  spec-templates/                 -- Module and feature spec templates
  flows/                          -- Standard CRUD flow diagrams
```

---

## Iron Rules (Mandatory)

These rules apply to every file, every commit, every session.

| # | Rule | Detail |
|---|------|--------|
| 1 | **RTL First** | Every layout is right-to-left. `dir="rtl"` on root. `flex-row-reverse` for sequential items. |
| 2 | **Mobile First** | Design for 320px, then scale up. All breakpoints must work. |
| 3 | **TypeScript Strict** | No `any`. No `as any`. No `@ts-ignore`. No `console.log` in committed code. |
| 4 | **Gap Over Margin** | Parent controls spacing with `gap`. Children never set margins for layout. |
| 5 | **Padding Always** | Content never touches its border. Every container has padding. See table below. |
| 6 | **Touch Targets** | Minimum 44x44px for all interactive elements. |
| 7 | **SidePanel Only** | No centered modals. No floating dialogs. All forms, wizards, and detail views use SidePanel. |
| 8 | **Single Source of Truth** | One entity = one panel = one config = one validation schema. No duplicates. |
| 9 | **Status = Border Color** | Entity status is shown as `border-r-4` with status color. Never dots or badges. |
| 10 | **DRY Components** | Repeating structure = shared component with props. No copy-paste. |
| 11 | **No Business Logic in JSX** | Extract to hooks, utils, or server actions. Components render, nothing more. |
| 12 | **Lucide Icons Only** | No other icon libraries. Consistent across the project. |
| 13 | **Noto Sans Hebrew** | Single font family for all text. |

---

## Minimum Padding Table

| Element | Minimum Padding |
|---------|-----------------|
| Button | `px-4 py-2` |
| Card / Container | `p-4` |
| Input | `px-3 py-2` |
| Badge | `px-2 py-0.5` |
| Table Cell | `px-4 py-3` |
| List Item | `p-3` |
| Modal / Panel | `p-6` |

```tsx
// Correct
<div className="border rounded-lg p-4">content</div>
<button className="border rounded-lg px-4 py-2">click</button>

// Wrong -- content touches border
<div className="border rounded-lg">content</div>
<button className="border">click</button>
```

---

## Design System Reference

- **Primary**: `#003aa0` (Sapphire)
- **Font**: Noto Sans Hebrew
- **Icons**: Lucide React
- **Corners**: Always rounded (`rounded-lg` minimum). No square corners.
- **Colors**: Use only design system tokens. Never invent new colors.
- **Spacing**: 4px grid (Tailwind default scale)

Full specification: `/docs/rules/DESIGN_SYSTEM.md`

---

## Prohibited Patterns

| Pattern | Why | Use Instead |
|---------|-----|-------------|
| Centered / floating modals | Blocks content, bad mobile UX | SidePanel |
| Square corners on containers | Violates design system | `rounded-lg` or higher |
| Harsh/neon colors | Violates Sapphire palette | Design system tokens |
| Business logic in JSX | Unmaintainable, untestable | Hooks, utils, server actions |
| `any` type | Defeats TypeScript purpose | Proper types or `unknown` |
| `console.log` | Debug noise in production | Remove before commit |
| `margin` for layout spacing | Fragile, hard to maintain | Parent `gap` |
| Status shown as dots/badges | Inconsistent with system | `border-r-4` with status color |
| New icon libraries | Inconsistent icons | Lucide React only |
| Inline styles | Unmaintainable | Tailwind classes |
| `!important` | Specificity war | Fix the cascade properly |

Full list: `/docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md`

---

## Task Reporting Format

After every task, report:

```
## Task Report
- **Files reviewed**: [list of files read before making changes]
- **Files changed**: [list of files modified/created with summary of each change]
- **Root cause**: [for bug fixes -- what caused the issue]
- **Architecture decisions**: [any non-obvious choices and why]
- **Risks**: [what could break, what to watch for]
- **What was NOT changed**: [things deliberately left alone and why]
- **Testing steps**: [how to verify the work]
```

---

## File Organization

```
app/
  (dashboard)/[module]/page.tsx   -- Page components (thin, no logic)
  styles/                         -- CSS partials (globals.css only has @import)
components/
  [module]/                       -- Module-specific components
  shared/                         -- Cross-module shared components
  ui/                             -- Base UI primitives (shadcn)
lib/
  actions/                        -- Server Actions
  stores/                         -- Zustand stores
  types/                          -- TypeScript type definitions
  constants/                      -- Constants and enums
  utils/                          -- Pure utility functions
  hooks/                          -- Custom React hooks
```

---

## CSS Rules

- `globals.css` contains only `@import` statements (30 lines max)
- All CSS lives in `app/styles/` as partials
- Each partial is 1500 lines max
- When deleting an element, delete its CSS too -- no orphan styles

---

## Governance Rules (Permanent)

These rules control the template over time. They are not optional.

### A. Folder Hierarchy Is Mandatory

Never place files randomly. Every file has a documented location. See `/claude/INDEX.md` for the full map.

```
/claude/          Instructions, memory, changelog, index, prompts
/docs/
  /rules/         Binding rules (design, architecture, mobile, permissions)
  /design/        Visual design specifications
  /components/    Component behavior standards
  /database/      Database documentation
  /flows/         Reference CRUD flows
  /spec-templates/ Templates for new modules
/database/        SQL schema, enums, seed, migrations/
/src/
  /types/         TypeScript types
  /constants/     Status maps, config, permissions
  /schemas/       Zod validation schemas
  /validators/    Regex patterns, sanitization
  /hooks/         React hooks
  /services/      Auth, audit, notifications, files
  /components/shared/  Reusable components
  /components/ui/      shadcn base
  /layouts/       AppShell, PageLayout
  /lib/helpers/   Utility helpers
  /modules/       Project-specific modules
```

### B. Design Consistency Is Mandatory

All UI must follow `/docs/rules/DESIGN_SYSTEM.md`. No random styles, no local one-off decisions. If a new UI pattern is introduced: (1) document it, (2) update the relevant docs file, (3) create/update the shared component.

### C. Interaction Consistency Is Mandatory

All interactions must follow `/docs/rules/INTERACTION_RULES.md`. If a new interaction pattern is introduced: (1) document it in `/docs/rules/` or `/docs/components/`, (2) connect it to the correct shared component.

### D. Architecture Discipline Is Mandatory

No business logic in visual components. No duplicate filtering/permission/validation logic. Every new file must fit the documented architecture in `/docs/rules/ARCHITECTURE_RULES.md`.

### E. Database Discipline Is Mandatory

No random tables, enums, or relations. Every database change must update: (1) schema.sql, (2) relevant `/docs/database/` docs, (3) types, (4) schemas if affected, (5) related flows if affected.

### F. Project Memory Is Mandatory

Maintain these files at all times:
- `/claude/PROJECT_MEMORY.md` -- permanent decisions
- `/claude/CHANGELOG.md` -- all changes with dates
- `/claude/INDEX.md` -- complete file navigation

### G. Indexing Is Mandatory

Every new file must be added to `/claude/INDEX.md`. The template must always be easy to navigate.

### H. Documentation Synchronization Is Mandatory

When a new module or rule is added: (1) update the relevant doc, (2) update PROJECT_MEMORY.md if permanent, (3) update CHANGELOG.md, (4) update INDEX.md, (5) update component/database docs if relevant.

### I. No Chat-Only Knowledge

If a rule, decision, or pattern is important, move it into the file system. Do not leave important knowledge only in chat.

### J. Output Rule for Every Task

After every task, report:
1. Files reviewed
2. Files changed
3. Why each change belongs there
4. Whether docs were updated
5. Whether PROJECT_MEMORY.md was updated
6. Whether INDEX.md was updated
7. What was intentionally not changed

---

## כללי ברזל (מחייבים!)
1. **RTL First** - כל עיצוב מימין לשמאל
2. **Mobile First** - responsive תמיד
3. **TypeScript Strict** - אין `any`, אין `console.log`
4. **Gap Over Margin** - Parent שולט על ריווח
5. **תוכן לא נוגע בבורדר** - padding תמיד!
6. **Touch Target** - מינימום 44x44px
7. **globals.css = תוכן עניינים** - globals.css מכיל רק `@import` (30 שורות מקס). כל CSS בתת-קבצים ב-`app/styles/`. קובץ partial מקסימום 1500 שורות
8. **DRY Components** - מבנה שחוזר → קומפוננטה רוחבית עם props לתוכן/צבעים. אין קוד כפול!
9. **CSS Cleanup** - כשמוחקים/מבטלים אלמנט → תמיד שאל: "למחוק גם את ה-CSS שלו?" אל תשאיר CSS יתום!
10. **ניהול context (קריטי!)** - אחרי כל 2 משימות חייבים להריץ `/compact`. אם המשתמש מסרב - להזהיר: "השיחה תתקע בקרוב ולא יהיה אפשר לשחזר". לפני סגירה - `/end`. **אסור לחכות ל-3+ משימות בלי compact!**

---

## Minimum Padding (חובה!)
| Element | Minimum |
|---------|---------|
| Button | `px-4 py-2` |
| Card/Container | `p-4` |
| Input | `px-3 py-2` |
| Badge | `px-2 py-0.5` |
| Table Cell | `px-4 py-3` |
| List Item | `p-3` |
| Modal | `p-6` |

```tsx
// ✅ Always
<div className="border p-4">content</div>
<button className="border px-4 py-2">click</button>

// ❌ Never
<div className="border">content</div>
<button className="border">click</button>
```

---

---

## Ruflo — תמיד פעיל (ALWAYS ON)

**Ruflo/claude-flow v3 הוא שכבת האורקסטרציה הקבועה של כל שיחה.**

| פלטפורמה | אחריות |
|----------|--------|
| 🔵 Claude Code | ארכיטקטורה, אבטחה, בדיקות, code review, PRD |
| 🟢 Codex (OMX) | מימוש, ריפקטורינג, אופטימיזציה, boilerplate |

- כל החלטת ארכיטקטורה → כתוב לזיכרון: `npx claude-flow@v3alpha memory write --namespace collaboration`
- משימות מורכבות → `npx claude-flow-codex dual run --namespace collaboration`
- Swarm → `npx claude-flow@v3alpha swarm run --topology hierarchical --max-agents 8`
- תמיד `doctor --fix` לפני swarm
- `/ruflo` לטעינת הסקייל המלא

---

---

## OMX Runtime (ברירת מחדל תפעולית)
- `omx` מריץ את Codex תחת `oh-my-codex`
- עבודה רחבה, רב-קובצית, refactor, debug ארוך או handoff-heavy: ברירת המחדל היא `omx team`
- `om "<task>"` הוא ה־shortcut הראשי: `omx team 3:executor "<task>"`
- `/prompts:planner`, `/prompts:architect`, `/prompts:executor`, `/prompts:verifier` הם משטחי העבודה הדיפולטיים של OMX
- `omd` מפעיל `omx doctor --team`
- `omx team status <team>`, `omx team resume <team>`, `omx team shutdown <team>` הם כלי הבקרה
- לא מריצים `omx agents-init .` בפרויקט KIT רגיל; התבניות של ה־KIT הן ה־source of truth ל־`CLAUDE.md` ו־`AGENTS.md`

---

---

## Recommended Dependencies (Standard Stack)

Every CRM/Dashboard/Web project should include these libraries. Install with `--full` flag in `new-project`.

### Tier 1 — חובה (כל פרויקט)

```bash
pnpm add @tanstack/react-table @tanstack/react-query recharts \
  react-hook-form @hookform/resolvers zod nuqs
```

| Library | Purpose | RTL |
|---------|---------|-----|
| `@tanstack/react-table` | Headless tables — sorting, filtering, pagination. Shadcn DataTable built on it. | Headless = full RTL control |
| `@tanstack/react-query` | Server state — cache, background refresh, loading/error. Every Supabase fetch. | N/A |
| `recharts` | Charts for dashboards. Shadcn Chart component built on it. | `direction="rtl"` |
| `react-hook-form` + `@hookform/resolvers` | Form state. Shadcn Form built on it. Minimal re-renders. | N/A |
| `zod` | Schema validation — forms, Server Actions, API. | N/A |
| `nuqs` | URL state — filters, search, pagination as URL params. | N/A |

### Tier 2 — מומלץ

```bash
pnpm add zustand next-safe-action @formkit/auto-animate sonner cmdk
```

| Library | Purpose |
|---------|---------|
| `zustand` | Client state (~1KB) — sidebar, wizard, UI toggles. Replaces Context bloat. |
| `next-safe-action` | Type-safe Server Actions with Zod validation + middleware (auth, rate-limit). |
| `@formkit/auto-animate` | One hook, zero config — auto-animates DOM additions/removals (~2KB). |
| `sonner` | Toast notifications — already used in pye9/synthesis. |
| `cmdk` | Command palette (⌘K) — quick search in any CRM. |

### Tier 3 — לפי צורך

| Library | When |
|---------|------|
| `@react-pdf/renderer` | PDF generation (invoices, reports) — JSX → PDF with Hebrew fonts |
| `ai` (Vercel AI SDK) | AI chat interface — `useChat`, streaming, multi-provider |
| `uploadthing` | File uploads — full-stack (S3 + validation + webhooks) |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop, Kanban boards |
| `next-intl` | Full i18n (Hebrew + English + Arabic) |
| `react-resizable-panels` | Split views, resizable sidebars |


---

## Agents & Skills

**מקור-אמת יחיד:** בחירת agent, decision trees, task decomposition, וקטלוג מלא של כל ה-skills/agents — טען `/master`.

- כל ה-skills זמינים אוטומטית כ-`/<name>` (auto-discovery) — לדוגמה `/design`, `/api`, `/security`, `/qa`, `/ruflo`.
- כל ה-agents זמינים דרך כלי ה-Task (Design, API, Security, QA, Fullstack, Ruflo, ועוד).
- הרשימה החיה המלאה נוצרת אוטומטית ב-`/master` (`gen-catalog.sh`) — לעולם לא ידנית, לעולם לא מתיישנת.

---

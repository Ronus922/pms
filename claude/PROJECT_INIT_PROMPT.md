# PROJECT_INIT_PROMPT.md -- New Project Setup

> Copy the prompt below and paste it when starting a new project from this template.
> Replace all `[PLACEHOLDER]` values with your project details.

---

## Prompt

```
You are starting a new project based on the Master Template Foundation.

BEFORE WRITING ANY CODE:
1. Read /claude/START_HERE.md
2. Read /claude/CLAUDE.md
3. Read all files in /docs/rules/ (in the order specified in START_HERE.md)
4. Acknowledge that you understand and will follow all documented rules

After reading, confirm:
- List the iron rules you will follow
- List the design tokens you will use
- List the patterns you will avoid
- List the architecture layers you will respect

PROJECT DETAILS:
- Name: [PROJECT_NAME]
- Type: [CRM / Dashboard / E-commerce / SaaS / Booking / PMS / etc.]
- Language: [Hebrew RTL / English LTR / Bilingual]
- Database: [Supabase / PostgreSQL / other]
- Auth provider: [Supabase Auth / NextAuth / custom]
- Deployment: [Vercel / VPS / Docker / etc.]
- Modules needed: [list all modules, e.g., Users, Reservations, Invoices, Reports]
- External integrations: [list any, e.g., Stripe, SendGrid, WhatsApp]

FIRST TASKS (in order):
1. Set up project structure following /docs/rules/ARCHITECTURE_RULES.md
   - Create directory structure (app/, components/, lib/)
   - Configure TypeScript strict mode
   - Set up Tailwind with design tokens from /docs/rules/DESIGN_SYSTEM.md
   - Configure RTL in root layout

2. Set up design system
   - Import Noto Sans Hebrew font
   - Configure Sapphire color palette
   - Set up CSS with globals.css as import-only index
   - Create base partials in app/styles/

3. Create shared components following /docs/components/*
   - PanelShell (SidePanel wrapper)
   - DataTable (with sorting, filtering, pagination)
   - FilterBar (standard filter layout)
   - StatusBorder (border-r-4 status indicator)
   - FormField (consistent form inputs)
   - PageHeader (standard page header)

4. Set up permission system following /docs/rules/PERMISSIONS_RULES.md
   - Define roles and permission matrix
   - Create permission check utilities
   - Set up RLS policies in Supabase

5. Create first module using /docs/spec-templates/module.spec.template.md
   - Write the spec first (present for approval before coding)
   - Follow the spec-driven development flow

CONSTRAINTS:
- Follow every rule in /docs/rules/
- Use only design system tokens
- RTL-first, mobile-first
- SidePanel for all detail/edit views
- TypeScript strict, no shortcuts
```

---

## After Initialization Checklist

Verify these before moving to feature development:

- [ ] `dir="rtl"` on root `<html>` element
- [ ] Noto Sans Hebrew font loaded and applied
- [ ] Tailwind configured with Sapphire design tokens
- [ ] `globals.css` contains only `@import` statements
- [ ] TypeScript strict mode enabled (no `any` allowed)
- [ ] Directory structure matches `/docs/rules/ARCHITECTURE_RULES.md`
- [ ] Shared components created and following design system
- [ ] Permission utilities in place
- [ ] Mobile responsive at 320px minimum
- [ ] Touch targets are 44x44px minimum
- [ ] All containers have proper padding
- [ ] Lucide React is the only icon library installed

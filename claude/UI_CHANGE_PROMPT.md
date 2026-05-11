# UI_CHANGE_PROMPT.md -- Make a UI Change

> Copy the prompt below and paste it when making UI changes.
> Replace all `[PLACEHOLDER]` values with the change details.

---

## Prompt

```
UI Change: [DESCRIPTION]

Affected page/component: [path]
What it looks like now: [describe current state]
What it should look like: [describe desired state]
Figma/screenshot: [link if available]

BEFORE CHANGING:
1. Read /docs/rules/DESIGN_SYSTEM.md
2. Read relevant files in /docs/design/*
3. Read relevant files in /docs/components/*
4. Read /docs/rules/INTERACTION_RULES.md
5. Read /docs/rules/MOBILE_RULES.md
6. Read /docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md
7. Check existing components in components/shared/ and components/ui/ for reuse
8. Read the current component code completely before modifying

RULES:
- Follow the Sapphire design system exactly
- Use ONLY existing design tokens (colors, spacing, typography)
- Do NOT introduce new colors, fonts, spacing values, or visual patterns
- Do NOT redesign other parts of the page that were not requested
- Do NOT change component APIs unless necessary for this change
- Maintain RTL layout correctness
- Maintain mobile responsiveness (test mentally at 320px, 768px, 1024px, 1440px)
- Maintain accessibility (contrast, focus states, screen reader)
- Maintain existing interaction patterns (hover, focus, active states)
- Use shared components whenever possible -- do not rebuild what exists
- Preserve all padding minimums (see table below)

PADDING MINIMUMS (never go below):
| Element | Minimum |
|---------|---------|
| Button | px-4 py-2 |
| Card | p-4 |
| Input | px-3 py-2 |
| Badge | px-2 py-0.5 |
| Table Cell | px-4 py-3 |
| List Item | p-3 |
| Panel | p-6 |

DESIGN SYSTEM CONSTRAINTS:
- Primary: #003aa0 (Sapphire)
- Font: Noto Sans Hebrew
- Icons: Lucide React only
- Corners: rounded-lg minimum (no square corners)
- Touch targets: 44x44px minimum
- Spacing: 4px grid (Tailwind scale)
- Status: border-r-4 (never dots or badges)

REPORT (mandatory):
1. Design system tokens used: [list colors, spacing, typography]
2. Existing components reused: [list component names]
3. New components created: [list, or "none"]
4. Files changed: [list with summary of each change]
5. RTL verified: [yes -- describe what was checked]
6. Mobile responsive: [yes -- list breakpoints mentally tested]
7. Accessibility: [contrast ratios, focus states, ARIA attributes]
8. Risks: [visual regression concerns, affected sibling components]
9. CSS changes: [any new classes added, any classes removed]
```

---

## UI Change Checklist

After making the change, verify:

- [ ] Follows Sapphire design system exactly
- [ ] No new colors, fonts, or spacing values introduced
- [ ] RTL layout is correct (text alignment, flex direction, margins/paddings)
- [ ] Mobile responsive at 320px (no overflow, no cut-off content)
- [ ] Mobile responsive at 768px (tablet layout works)
- [ ] Desktop layout works at 1024px and 1440px
- [ ] Touch targets are 44x44px minimum
- [ ] All containers have minimum padding
- [ ] Corners are rounded (no square corners)
- [ ] Icons are from Lucide React
- [ ] Hover states are defined
- [ ] Focus states are visible (keyboard navigation)
- [ ] Status indicators use border-r-4
- [ ] No orphan CSS left behind
- [ ] Shared components used where possible
- [ ] No other parts of the page were changed

---

## Common UI Mistakes to Avoid

| Mistake | Correct Approach |
|---------|-----------------|
| Using `ml-*` for RTL spacing | Use `gap-*` on parent, or `me-*` / `ms-*` for logical margins |
| Hardcoding `text-left` | Use `text-start` / `text-end` for RTL compatibility |
| Fixed widths on containers | Use `max-w-*` with fluid width |
| Hiding content on mobile | Reorganize layout, do not hide important content |
| Adding `!important` | Fix specificity at the source |
| Using `px` for font sizes | Use Tailwind `text-*` classes |
| Mixing icon libraries | Lucide React only |
| Forgetting dark mode | Check if project uses dark mode, maintain consistency |

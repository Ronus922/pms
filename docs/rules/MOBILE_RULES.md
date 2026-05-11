# Mobile Rules

> Every page and component must work on screens as narrow as 320px.
> Mobile is not an afterthought -- it is the first breakpoint designed for.

---

## 1. Breakpoints

| Name | Width | Class Prefix |
|------|-------|-------------|
| Small Mobile | 320px | (default) |
| Mobile | 375px | `min-[375px]:` |
| Large Mobile | 428px | `min-[428px]:` |
| Small Tablet | 640px | `sm:` |
| Tablet | 768px | `md:` |
| Small Desktop | 1024px | `lg:` |
| Desktop | 1280px | `xl:` |
| Large Desktop | 1536px | `2xl:` |
| TV / Ultra-wide | 2560px | `min-[2560px]:` |

**Rule:** Design for 320px first, then add complexity at wider breakpoints.

---

## 2. No Horizontal Overflow

Test every page at 320px width. Nothing should cause horizontal scrolling.

Common causes to watch for:
- Fixed-width elements wider than the viewport
- Long unbroken strings (URLs, email addresses) -- use `break-all` or `truncate`
- Tables with many columns -- switch to card layout or add horizontal scroll
- Absolutely positioned elements that extend past viewport edges

```tsx
// Prevent overflow on the page container
<main className="w-full overflow-x-hidden">
```

---

## 3. SidePanel on Mobile

The SidePanel switches to **100% width** on mobile. No partial-width panels on small screens.

```tsx
// Panel width classes
className="w-full md:w-[55%]"
```

---

## 4. No Clipped Dialogs

Confirmation dialogs and popovers must never extend beyond the viewport on mobile. Use dynamic positioning and max-height constraints.

```tsx
// Popover positioning
className="max-h-[80vh] overflow-y-auto"
```

---

## 5. Grid Column Collapse

Grids must collapse to a single column on small screens and progressively expand.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

Common patterns:

| Layout | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| Form fields | 1 col | 2 col | 2-3 col |
| KPI cards | 1 col | 2 col | 4 col |
| Room grid | 1 col | 2 col | 3-4 col |
| Filter bar | Stacked | 2 col | Inline row |

---

## 6. Tables on Mobile

Tables with more than 3 columns should transform on mobile using one of these patterns:

### Option A: Card View

Replace the table with stacked cards on mobile. Each card shows the key fields.

```tsx
<div className="hidden md:block">
  <DataTable ... />
</div>
<div className="md:hidden flex flex-col gap-3">
  {data.map(item => <MobileCard key={item.id} item={item} />)}
</div>
```

### Option B: Horizontal Scroll with Frozen Column

Keep the table but allow horizontal scrolling. Freeze the first column (usually the entity name).

```tsx
<div className="overflow-x-auto">
  <table className="min-w-[600px]">
    <thead>
      <tr>
        <th className="sticky right-0 bg-card z-10">Name</th>
        ...
      </tr>
    </thead>
  </table>
</div>
```

---

## 7. Footer Actions

Action buttons (Save, Cancel, Submit) must always be visible on mobile. Use a sticky footer.

```tsx
<footer className="sticky bottom-0 border-t border-border/15 px-4 py-3 bg-card/80 backdrop-blur-sm">
  <div className="flex items-center justify-between gap-3">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </div>
</footer>
```

---

## 8. Input Behavior on Mobile

### Auto-Zoom Prevention

iOS Safari zooms in on inputs with font-size below 16px. All inputs must use at least 16px font size.

```tsx
// Safe -- 16px prevents zoom
<input className="text-base" />

// Dangerous -- 14px triggers zoom on iOS
<input className="text-sm" />  // Only if min-h and font-size are handled in CSS
```

### Keyboard Types

Use appropriate input types to trigger the correct mobile keyboard.

| Data | Input Type |
|------|-----------|
| Email | `type="email"` |
| Phone | `type="tel"` |
| Number | `type="number"` or `inputMode="numeric"` |
| URL | `type="url"` |
| Search | `type="search"` |
| Date | `type="date"` or custom date picker |

---

## 9. Safe Areas

Respect iOS safe areas (notch, home indicator, status bar).

```css
/* In CSS */
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

```tsx
/* In Tailwind -- use arbitrary values */
<div className="pb-[env(safe-area-inset-bottom)]">
```

---

## 10. Orientation

Test both portrait and landscape orientations. Key considerations:

- SidePanel in landscape tablet: keep at 55% width (enough space).
- SidePanel in portrait tablet: may need 75% or 100% width.
- Long forms in landscape: consider 2-column layout.

---

## 11. Touch Targets

Every interactive element must be at least **44x44px**. This is non-negotiable.

Elements that commonly violate this rule:
- Icon-only buttons (make at least `w-11 h-11`)
- Checkbox/radio buttons (add padding to increase touch area)
- Close buttons (use `p-2` minimum)
- Tab headers (use `py-3 px-4` minimum)
- Breadcrumb links (use `py-2` minimum)

```tsx
// Correct -- 44px touch target
<button className="w-11 h-11 flex items-center justify-center">
  <X className="w-5 h-5" />
</button>

// Wrong -- too small
<button>
  <X className="w-4 h-4" />
</button>
```

---

## 12. Sticky Headers

Page headers and table headers should remain visible during scrolling.

```tsx
<header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm">
  ...
</header>
```

---

## 13. Bottom Sheet Pattern

On mobile, use bottom sheets instead of popovers for:
- Filter panels
- Sort options
- Action menus with more than 3 items
- Date/time pickers

Bottom sheets slide up from the bottom, can be dismissed by swiping down, and use the full viewport width.

---

## Testing Checklist

Before marking any UI task as complete, verify:

- [ ] Page renders correctly at 320px width
- [ ] No horizontal scrollbar appears
- [ ] All touch targets are at least 44x44px
- [ ] SidePanel is full-width on mobile
- [ ] Footer actions are visible without scrolling
- [ ] Forms are usable with a mobile keyboard open
- [ ] Inputs do not trigger iOS auto-zoom
- [ ] Tables are readable (card view or horizontal scroll)
- [ ] Popovers and dropdowns stay within viewport

---

## Related Documents

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) -- spacing and sizing tokens
- [INTERACTION_RULES.md](./INTERACTION_RULES.md) -- touch interactions
- [PROJECT_RULES.md](./PROJECT_RULES.md) -- mobile compatibility requirement

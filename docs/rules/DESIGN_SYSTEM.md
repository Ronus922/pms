# Design System -- Sapphire

> Complete visual language definition. Every UI element in the application must conform to these specifications.
> This is the single source of truth for colors, typography, spacing, and component styles.

---

## 1. Color System

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#003aa0` | Brand color, primary buttons, active states |
| `--primary-container` | `#3F51B5` | Gradients, header accents |
| `--secondary` | `#3F51B5` | Indigo accent |
| `--tertiary` | `#a2315f` | Dusty rose, decorative accents |
| `--background` | `#f6f8fb` | Page background |
| `--card` | `#ffffff` | Card and panel backgrounds |
| `--border` | `#e2e8f0` | Default borders |
| `--accent` | `#f1f5f9` | Input backgrounds, hover fills |
| `--muted-foreground` | `#4b5563` | Secondary text, labels |
| `--foreground` | `#1a1b22` | Primary text |
| `--destructive` | `#ba1a1a` | Errors, danger actions |

### Dark Mode

| Token | Value |
|-------|-------|
| `--primary` | `#a4c9ff` |
| `--primary-container` | `#2976c7` |
| `--background` | `#0f172a` |
| `--card` | `#1a1c22` |
| `--accent` | `#262830` |
| `--muted-foreground` | `#8e9099` |
| `--destructive` | `#ffb4ab` |

### Status Colors

| Status | Color | Use Cases |
|--------|-------|-----------|
| Success / Available | `emerald-500` | Available rooms, paid invoices, confirmed reservations |
| Warning / Pending | `amber-500` | Cleaning in progress, pending payment, partial |
| Danger / Blocked | `red-500` / `red-600` | Maintenance, blocked, failed payment |
| Active / Occupied | `primary` / `blue-400` | Occupied rooms, checked-in guests |
| Neutral | `gray-400` / `slate` | Unavailable, draft, archived |

**Rule:** Never use harsh or neon colors. All status colors use the 500 weight from Tailwind's palette.

---

## 2. Typography

### Font Stack

```
"Noto Sans Hebrew", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

### Scale

| Element | Size | Weight | Font Family |
|---------|------|--------|-------------|
| H1 | 28px (`text-[28px]`) | 800 (extrabold) | `font-headline` |
| H2 | 22px (`text-[22px]`) | 700 (bold) | `font-headline` |
| H3 | 18px (`text-lg`) | 600 (semibold) | `font-headline` |
| H4 | 16px (`text-base`) | 600 (semibold) | `font-headline` |
| H5 | 14px (`text-sm`) | 700 (bold, uppercase) | `font-headline` |
| Body | 16px (`text-base`) | 400 (normal) | body |
| Labels | 14px (`text-sm`) | 700 (bold) | body |
| Caption | 13px (`text-[13px]`) | 400 (normal) | body |
| Tags / Badges | 12px (`text-xs`) | 700 (bold) | body |
| Tiny UI | 11px (`text-[11px]`) | 700 (bold) | body |

### Rules

- All text is right-aligned by default (`text-right`).
- Numbers use `tabular-nums` for alignment in tables and counters.
- Never go below 11px for any visible text.
- Input text must be at least 16px to prevent iOS auto-zoom.

---

## 3. Spacing System

| Context | Value | Class |
|---------|-------|-------|
| Between form fields | 12-16px | `gap-3` / `gap-4` |
| Between sections | 24-32px | `gap-6` / `gap-8` |
| Page padding (desktop) | 24px | `px-8 py-6` |
| Page padding (mobile) | 16px | `px-4 py-4` |
| Card internal padding | 20px | `p-5` |
| Panel internal padding | 24px | `p-6` |
| Footer / Header padding | -- | `px-6 py-4` |

**Rule:** Parent controls spacing via `gap`. Children never add margin for sibling spacing.

---

## 4. Border Radius

| Element | Value | Class |
|---------|-------|-------|
| Inputs / Selects | 12px | `rounded-xl` |
| Buttons | 12px | `rounded-xl` |
| Cards / Containers | 20px | `rounded-[20px]` |
| SidePanel corners | 0.65rem | `rounded-tr-[0.65rem] rounded-br-[0.65rem]` |
| Chips / Pills | full | `rounded-full` |
| Step circles | full | `rounded-full` |

**Rule:** No sharp corners anywhere in the UI.

---

## 5. Shadows

| Usage | Class |
|-------|-------|
| Cards (rest) | `shadow-sm` |
| Cards (hover) | `shadow-md` |
| Primary buttons | `shadow-md` (rest), `shadow-lg` (hover) |
| SidePanel | `shadow-2xl` |
| Confirmation dialogs | `shadow-2xl` |
| Active step circle | `shadow-md` |

**Rule:** Soft shadows only. No heavy, aggressive, or colored shadows.

---

## 6. Card Styles

### Standard Card

```
bg-card rounded-[20px] p-5 shadow-sm border border-border/20
```

### Section Card (inside forms/panels)

```
bg-card rounded-[20px] border border-border/15 p-5 shadow-sm
```

Title inside section card: `text-sm font-bold text-foreground mb-4`

### KPI Card

```
bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-2
```

### Status Card (rooms, tasks, entities)

```
bg-card rounded-[20px] p-5 shadow-sm border-r-4 border-{status-color}
```

**Rule:** Entity status is always shown as `border-r-4` on the card. Never use dots or colored badges for status indication.

---

## 7. Button Variants

### Primary (Gradient)

```
bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm
rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95
min-h-[44px] px-8 py-3
```

### Secondary (Outline)

```
border border-border/30 text-muted-foreground font-bold text-sm
rounded-xl hover:bg-accent transition-colors min-h-[44px] px-6 py-3
```

### Ghost (Text only)

```
text-muted-foreground text-sm hover:text-foreground transition-colors
min-h-[44px] px-4 py-3
```

### Action Icon

```
w-9 h-9 rounded-xl bg-accent hover:bg-border/40
flex items-center justify-center transition-colors
```

### Header Action Icon (on gradient background)

```
w-9 h-9 rounded-xl bg-white/15 hover:bg-white/30
flex items-center justify-center transition-colors
```

**Rule:** All interactive elements must have a minimum touch target of 44x44px.

---

## 8. Input Style

### Shared Base

```
w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm
focus:ring-2 focus:ring-primary/20 focus:border-primary/40
transition-all outline-none min-h-[48px]
```

### Variants

| Type | Additional Classes |
|------|-------------------|
| Select | `appearance-none cursor-pointer` |
| Textarea | `resize-none` |

### Labels and Errors

| Element | Style |
|---------|-------|
| Label | `text-sm font-bold text-muted-foreground` |
| Required indicator | `text-destructive mr-0.5` (red asterisk) |
| Error text | `text-[11px] text-destructive` |

---

## 9. SidePanel

**Rule:** No centered or floating modals. All forms, details, and wizards open in a SidePanel.

### Structure

| Property | Value |
|----------|-------|
| Position | `fixed left-0 inset-y-0` |
| Width (desktop) | 55% |
| Width (mobile) | 100% |
| Background | `bg-card/90 backdrop-blur-xl` |
| Border radius | `rounded-tr-[0.65rem] rounded-br-[0.65rem]` |
| Shadow | `shadow-2xl` |
| Z-index | 50 |
| Animation | Slide from left, 0.4s ease-in-out |
| Overlay | `bg-black/65` |

### Header

```
bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4
Title: text-lg font-bold text-white font-headline
Subtitle: text-sm text-blue-100
Close button: absolute left-4 top-4, rounded-xl bg-white/20 hover:bg-white/40, min 44x44px
```

### Content Area

```
flex-1 overflow-y-auto p-6 text-right
```

### Footer

```
border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm
flex items-center justify-between
```

The footer is sticky at the bottom. Save button uses the primary gradient style. Cancel button uses secondary outline style.

---

## 10. Status Pills

```
Base: inline-flex items-center font-bold rounded-full border
Small: px-2.5 py-1 text-[11px] gap-1
Medium: px-3 py-1.5 text-xs gap-1.5
```

| Color | Background | Text | Border |
|-------|-----------|------|--------|
| Emerald | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| Amber | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| Red | `bg-red-50` | `text-red-700` | `border-red-200` |
| Blue | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| Purple | `bg-purple-50` | `text-purple-700` | `border-purple-200` |
| Slate | `bg-slate-100` | `text-slate-600` | `border-slate-200` |

---

## 11. Table Style

| Property | Value |
|----------|-------|
| Header background | Gradient: `from-[#003aa0] to-[#3F51B5]` |
| Header text | `text-white font-bold text-sm` |
| Row background (even) | `bg-accent/50` (striped) |
| Row hover | `hover:bg-accent` |
| Cell padding | `px-4 py-3` |
| Border | `border-b border-border/10` |

---

## 12. Empty / Loading / Error States

### Empty State

```
Container: centered, py-12
Icon: size 32px, opacity-30, mx-auto mb-4
Title: text-lg font-medium
Subtitle: text-sm text-muted-foreground
```

### Loading State

Use skeleton placeholders that match the shape of the content being loaded. Animate with a pulse effect.

### Error State

```
Banner: bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3
Title: text-sm font-bold text-red-800
Detail: text-xs text-red-700
```

---

## 13. Icons

| Property | Value |
|----------|-------|
| Library | Lucide only |
| Size (small) | 16px |
| Size (medium) | 18-20px |
| Size (large) | 24px |
| Size (extra large) | 32px |
| Stroke width | 1.8 |
| Style | Outline only |

**Prohibited:** Material Icons, Bootstrap Icons, Font Awesome, Heroicons, or any other icon library.

---

## Related Documents

- [PROJECT_RULES.md](./PROJECT_RULES.md) -- core philosophy
- [INTERACTION_RULES.md](./INTERACTION_RULES.md) -- behavior patterns
- [RESTRICTIONS_AND_PROHIBITIONS.md](./RESTRICTIONS_AND_PROHIBITIONS.md) -- what not to do

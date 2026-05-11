# PMS Design System & Interaction Patterns — Full Extraction

> Extracted from `/var/www/pms` (GuestHub PMS) — Next.js 16 + React 19 + Tailwind v4.
> Source of truth for rebuilding the same visual language in a new project.

---

## 1. Stack & Libraries

Everything is **Tailwind CSS v4** driven (no `tailwind.config.{js,ts}` file — config lives in `@theme inline` inside `app/styles/base.css`).

| Library | Version | Purpose |
|---|---|---|
| `tailwindcss` | `^4` | Core utility CSS, CSS-first config (`@theme inline`) |
| `@tailwindcss/postcss` | `^4` | PostCSS pipeline |
| `shadcn/ui` | style `"base-nova"`, baseColor `"neutral"`, `rtl: true`, `cssVariables: true` — configured in `components.json` | **Not installed yet** — `src/components/ui/index.ts` is only a placeholder barrel. UI is hand-rolled with Tailwind classes and CSS vars following the shadcn conventions |
| Radix UI primitives | לא קיים (not installed) | — |
| `lucide-react` | `^1.7.0` | All icons, wrapped by `components/shared/Icon.tsx` that maps Material-Icons-style names → Lucide components |
| `framer-motion` | `^12.38.0` | Panel slide-ins, step-content x-transitions (see `SidePanel`, `ReservationModal`) |
| `@lottiefiles/dotlottie-react` | `^0.18.10` | Lottie animations (e.g. `menu-close.lottie` in SidePanel close button) |
| `@tanstack/react-table` | `^8.21.3` | Installed; headless table engine (shared `DataTable` uses manual `<table>` without it currently) |
| `recharts` | `^3.8.1` | Charts (reports module) |
| `react-hook-form` + `@hookform/resolvers` | `^7.72.1` / `^5.2.2` | Forms |
| `zod` | `^4.3.6` | Validation |
| `nuqs` | `^2.8.9` | URL state — wired in `app/providers.tsx` via `NuqsAdapter` |
| `sonner` | `^2.0.7` | Toasts — `<Toaster position="top-center" dir="rtl" richColors />` |
| `zustand` | `^5.0.12` | Client state — every entity panel has its own store (`reservation-form-store`, `room-form-store`, …) |
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | `^6.3.1` / `^10.0.0` / `^3.2.2` | Drag & drop (calendar board) |
| `@tiptap/react` + `starter-kit` + `link` + `placeholder` + `underline` | `^3.22.2` | Rich-text editor |
| `next-themes` | `^0.4.6` | Dark mode (class-based) |
| `date-fns` | `^4.1.0` | Date math |
| `clsx` + `tailwind-merge` | `^2.1.1` / `^3.5.0` | `cn()` helper in `lib/utils.ts` |
| `postgres` | `^3.4.9` | DB driver (server-side) |
| `@supabase/ssr` + `@supabase/supabase-js` | Auth only |

Framework: **Next.js 16.2.2 + React 19.2.4 + TypeScript 5**.

---

## 2. Color Palette

Defined as CSS vars in `app/styles/base.css` and exposed to Tailwind via `@theme inline`. Values are exact HEX from the source.

### Light mode (`:root`)
| Token | HEX |
|---|---|
| `--background` | `#f6f8fb` |
| `--foreground` | `#1a1b22` |
| `--muted` | `#f3f4f5` |
| `--muted-foreground` | `#4b5563` |
| `--card` | `#ffffff` |
| `--card-foreground` | `#1a1b22` |
| `--border` | `#e2e8f0` |
| `--input` | `#e2e8f0` |
| `--primary` | `#003aa0` |
| `--primary-foreground` | `#ffffff` |
| `--primary-container` | `#3F51B5` |
| `--secondary` | `#3F51B5` |
| `--secondary-foreground` | `#ffffff` |
| `--secondary-container` | `#7986CB` |
| `--tertiary` | `#a2315f` |
| `--tertiary-foreground` | `#ffffff` |
| `--accent` | `#f1f5f9` |
| `--accent-foreground` | `#191c1d` |
| `--destructive` | `#ba1a1a` |
| `--destructive-foreground` | `#ffffff` |
| `--ring` | `#003aa0` |
| `--sidebar` | `#f8fafc` |
| `--sidebar-foreground` | `#64748b` |
| `--sidebar-border` | `rgba(226, 232, 240, 0.5)` |
| `--sidebar-active` | `#ffffff` |
| `--outline` | `#717783` |
| `--outline-variant` | `#c1c7d3` |
| `--surface` | `#f6f8fb` |
| `--surface-container` | `#edeeef` |
| `--surface-container-low` | `#f3f4f5` |
| `--surface-container-high` | `#e7e8e9` |

### Dark mode (`.dark`)
| Token | HEX |
|---|---|
| `--background` | `#0f172a` |
| `--foreground` | `#e2e2e6` |
| `--muted` | `#1e2025` |
| `--muted-foreground` | `#8e9099` |
| `--card` | `#1a1c22` |
| `--card-foreground` | `#e2e2e6` |
| `--border` | `#2c2e35` |
| `--input` | `#2c2e35` |
| `--primary` | `#a4c9ff` |
| `--primary-foreground` | `#003062` |
| `--primary-container` | `#2976c7` |
| `--secondary` | `#c5c0ff` |
| `--secondary-foreground` | `#2b2178` |
| `--secondary-container` | `#a19afd` |
| `--tertiary` | `#ffb1c8` |
| `--tertiary-foreground` | `#5e1133` |
| `--accent` | `#262830` |
| `--accent-foreground` | `#e2e2e6` |
| `--destructive` | `#ffb4ab` |
| `--destructive-foreground` | `#690005` |
| `--ring` | `#a4c9ff` |
| `--sidebar` | `#111318` |
| `--sidebar-foreground` | `#8e9099` |
| `--sidebar-border` | `rgba(44, 46, 53, 0.5)` |
| `--sidebar-active` | `#1a1c22` |
| `--outline` | `#8e9099` |
| `--outline-variant` | `#44474e` |
| `--surface` | `#111318` |
| `--surface-container` | `#1e2025` |
| `--surface-container-low` | `#191b20` |
| `--surface-container-high` | `#282a30` |

### Status colors (from Tailwind palette, used inline + in `app/styles/status-colors.css`)
Entity status is rendered as a **right border (4px)** on the row/card. Colors from `lib/constants/reservation.ts`:

| Status | Border HEX | Bg | Text |
|---|---|---|---|
| confirmed | `#003aa0` | `#003aa0/10` | `#003aa0` (`bg-[#003aa0]/10 text-[#003aa0]`) |
| checked_in | `#22c55e` | `bg-emerald-50` | `text-emerald-700` |
| checked_out | `#9ca3af` | `bg-accent` | `text-muted-foreground` |
| cancelled | `#ef4444` | `bg-red-50/80` | `text-red-600` |
| no_show | `#f97316` | `bg-orange-50` | `text-orange-600` |
| pending | `#eab308` | `bg-amber-50` | `text-amber-700` |
| draft | `#9ca3af` | `bg-accent` | `text-muted-foreground` |

Room state colors (from `lib/constants/room-display.ts`):
- occupied `#003aa0` · available `#22c55e` · dirty `#f59e0b` · in_progress `#fbbf24` · blocked `#ef4444` · maintenance `#dc2626`

Booking-ribbon classes (`.ribbon-confirmed` etc. in `status-colors.css`) use `color-mix(in srgb, … 10%, transparent)` for tinted backgrounds and a `border-right: 4px` accent.

Success/warning/error/info are expressed with Tailwind's `emerald-*`, `amber-*`, `red-*`, `blue-*` scales — no custom semantic tokens exist (except `--destructive`).

Gradient brand is used heavily: `bg-gradient-to-l from-[#003aa0] to-[#3F51B5]` (primary CTAs, SidePanel header).

---

## 3. Typography

Defined in `app/styles/base.css`.

**Font families** (loaded from Google Fonts in `app/layout.tsx`):
```
--font-headline: "Noto Sans Hebrew", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-body:     "Noto Sans Hebrew", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```
Weights loaded: `400;500;600;700;800`.

**Body defaults:** `font-weight: 400; font-size: 16px; line-height: 1.6;`

**Type scale:**
| Element | Size | Weight | Line-height | Notes |
|---|---|---|---|---|
| h1 | `1.75rem` (28px) | `800` | `1.3` | `letter-spacing: -0.01em` — page titles use `text-[28px] max-sm:text-[22px] font-extrabold tracking-tight` |
| h2 | `1.375rem` (22px) | `700` | `1.3` | |
| h3 | `1.125rem` (18px) | `600` | `1.3` | |
| h4 | `1rem` (16px) | `600` | `1.3` | |
| h5 | `0.875rem` (14px) | `700` | `1.3` | UPPERCASE, `letter-spacing: 0.03em`, `color: var(--muted-foreground)` |
| h6 | `0.8125rem` (13px) | `700` | `1.3` | `color: var(--muted-foreground)` |
| body p | 16px | `400` | `1.6` | |
| small / `.text-caption` | `0.8125rem` (13px) | — | `1.4` | |

**Important Tailwind overrides** (in `base.css`):
- `.text-xs { font-size: 16px !important; line-height: 1.5; }` ← `text-xs` is **redefined to 16px** (not 12px).
- `.text-\[11px\] { font-size: 13px !important; line-height: 1.4; }` ← `text-[11px]` renders as 13px.

UI vs content: body text is 16px; form labels are 14px bold in muted-foreground (`text-sm font-bold text-muted-foreground`); table headers are `text-xs font-bold text-foreground/70` (rendered 16px thanks to override); status pills are `text-[11px] font-bold` (rendered 13px).

---

## 4. Spacing & Sizing

Tailwind v4 defaults (no custom `spacing` scale in `@theme inline`).

**Border radius (from `@theme inline`):**
| Token | Value |
|---|---|
| `--radius-sm` | `0.5rem` (8px) |
| `--radius-md` | `0.75rem` (12px) |
| `--radius-lg` | `1rem` (16px) |
| `--radius-xl` | `1.375rem` (22px) |
| `--radius-2xl` | `1.5rem` (24px) |
| `--radius-3xl` | `3rem` (48px) |

Most cards use the custom `rounded-[20px]`; KPI cards use `.kpi-card { border-radius: 22px }`; pill badges `rounded-full`; inputs/buttons `rounded-xl` (12px).

**Common heights:**
- Buttons / inputs / selects: **min-height 44px** (touch target). Large inputs `min-h-[48px]`.
- Topbar: `py-4` (no fixed height) + `sticky top-0`.
- Sidebar: `w-72` expanded, `w-20` collapsed. Fixed right (RTL).
- Main content: `px-8 py-6` (dashboard shell).

**Container:** No global `max-w` — layout expands full-width inside content area. Forms inside panels occasionally use `max-w-[520px]` for step-progress.

**Breakpoints:** default Tailwind (`sm: 640, md: 768, lg: 1024, xl: 1280, 2xl: 1536`). No customizations.

**Minimum padding rules** (from project CLAUDE.md — enforced everywhere):
| Element | Minimum |
|---|---|
| Button | `px-4 py-2` |
| Card / Container | `p-4` |
| Input | `px-3 py-2` (actual standard is `px-5 py-3.5`) |
| Badge | `px-2 py-0.5` |
| Table cell | `px-4 py-3` (actual standard is `px-5 py-4`) |
| List item | `p-3` |
| Modal / SidePanel content | `p-6` |

---

## 5. Layout Structure

**Root** (`app/layout.tsx`): `<html lang="he" dir="rtl" className="h-full antialiased">`, `<body className="min-h-full flex flex-col font-body">`.

**Providers stack** (`app/providers.tsx`): `NuqsAdapter` → `ThemeProvider (next-themes, class, defaultTheme=light, enableSystem)` → children → `<Toaster position="top-center" dir="rtl" richColors />`.

**Dashboard shell** (`app/(dashboard)/dashboard-shell.tsx`):
```
<TenantProvider>
  <div className="flex min-h-screen">
    <Sidebar /> ← fixed right, w-72 (or w-20 collapsed)
    <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "mr-20" : "mr-72"}`}>
      <TopBar title={title} />  ← sticky top-0 z-40 glass-topbar
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
    <ReservationModal />           ← single instance at shell level
    <ExistingReservationPanel />   ← single instance at shell level
  </div>
</TenantProvider>
```

Sidebar is **fixed right** (`h-screen fixed right-0 top-0 border-l`). The content wrapper uses `mr-72` / `mr-20` to clear it (RTL = right is the "start" edge). TopBar is `sticky top-0 z-40` with `.glass-topbar` (rgba(255,255,255,0.8) + `backdrop-filter: blur(24px)`).

**Page pattern:**
```tsx
<div className="space-y-6">
  {/* Header row */}
  <div className="flex items-center justify-between">
    <h1 className="text-3xl font-extrabold font-headline">Title</h1>
    <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] ...">+ Action</button>
  </div>
  {/* Filters row — flex flex-wrap gap-4 */}
  {/* Content: grid / table in card */}
</div>
```

**Grid patterns:**
- KPI cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`.
- Room cards: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`.
- Tasks row: `grid grid-cols-1 md:grid-cols-3 gap-4`.

**SidePanel layout** (`components/shared/SidePanel.tsx`):
Opens from the **left** in RTL (`absolute inset-y-0 left-0`), default width `w-[55%] max-sm:w-full`, with gradient header, scrollable body `p-6`, optional sticky footer.

---

## 6. Component Styles

### Buttons

**Primary (gradient) — the brand CTA** (from `components/layout/Sidebar.tsx` and reservations/rooms pages):
```
bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 min-h-[44px]
```
Sidebar large variant: `from-primary to-primary-container py-3 rounded-xl font-semibold shadow-sm active:scale-95`.

**Secondary / outline:**
```
border border-border/40 text-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-accent transition-all flex items-center gap-2 min-h-[44px]
```

**Ghost / icon-only (topbar, panels):**
```
p-2.5 text-muted-foreground hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center
```

**Small action-icon (ReservationModal header):**
```
w-9 h-9 rounded-xl bg-accent hover:bg-border/40 flex items-center justify-center transition-colors
```

**Destructive:** no reusable class — pages use `text-red-500` / `text-destructive` on text buttons, or `bg-red-50 border-red-200 text-red-700` on filled variants.

**Sizes (observed):**
- sm: `px-4 py-2 text-xs min-h-[44px]`
- md: `px-5 py-2.5 text-sm min-h-[44px]`
- lg: `px-6 py-3 text-sm min-h-[48px]`
- xl (submit): `px-8 py-3 text-sm min-h-[44px]`

**Pill tabs / filter pills** (custom CSS classes in base.css):
- `.pill-tab` — `padding: 0.625rem 1.25rem; font-size: 0.875rem; font-weight: 700; border-radius: 9999px; min-height: 44px; background: linear-gradient(135deg, #f0eef5, #e8e5f0); color: #6b6280;`
- `.pill-tab-active` — `background: linear-gradient(135deg, #d8d0f0, #c4b8e8); color: #4a2fa0; border-color: #b8a8e0; box-shadow: 0 2px 8px rgba(74,47,160,0.12);`
- `.pill-filter` — smaller variant, `padding: 0.5rem 1rem; font-size: 0.75rem; min-height: 36px`.

### Form Inputs

Standard classes from `src/components/shared/FormField.tsx`:

```ts
// inputClass / selectClass / textareaClass
'w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm text-right focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[48px]'
```
- select adds: `appearance-none cursor-pointer`
- textarea adds: `resize-none`
- error state: add `border-destructive/60 ring-1 ring-destructive/20`
- disabled: `opacity-60 cursor-not-allowed`

Shorter filter-row variant (from FilterBar): `pr-9 pl-3 py-2.5 text-sm min-h-[44px]`.

**Labels** (from FormField):
```
block text-sm font-bold text-muted-foreground mr-1
```
Required marker: `<span className="text-destructive mr-0.5"> *</span>`.

**Error messages:**
```
text-[11px] text-destructive mr-1  (role="alert")
```

**Checkbox / Radio / Switch:** no custom wrappers — use native `<input type="checkbox">`. `Sabbath` toggles and other booleans are implemented ad-hoc per screen.

**NumberStepper** (`components/shared/NumberStepper.tsx`):
```
flex items-center justify-between bg-accent rounded-full px-4 py-2
  buttons: w-11 h-11 text-xl hover:bg-card rounded-full disabled:opacity-30
  value:   text-lg font-bold tabular-nums min-w-[2ch] text-center
```

**DateInput / TimeInput** (`components/shared/DateInput.tsx`, `TimeInput.tsx`):
Native `<input type="date|time">` with `.picker-no-icon` class (hides webkit picker indicator), wrapped in `relative cursor-pointer` div that calls `ref.current.showPicker()` on click. Icon rendered absolutely at `left-4 top-1/2 -translate-y-1/2`.

### Cards

**Standard card** (dashboard, settings, sections):
```
bg-card rounded-[20px] border border-border/15 p-5 shadow-sm
```
or with `border-border/20` / `border-border/40` on variant pages.

**KPI card** (`app/(dashboard)/dashboard/page.tsx`):
```
kpi-card bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-2
```
`.kpi-card { border-radius: 22px }` set in base.css.

**Entity card with status border** (rooms grid):
```
bg-card rounded-[20px] p-5 shadow-sm border-r-4 hover:shadow-md transition-all cursor-pointer group ${item.borderClass}
```
`border-r-4` + e.g. `border-primary` or `border-emerald-500` = **status as right border** — core pattern.

**Section card inside panel** (reservation steps):
```
bg-card rounded-[20px] border border-border/15 p-5 shadow-sm
```
Section header: `w-9 h-9 rounded-xl bg-primary/10 text-primary` icon wrapper + `text-sm font-bold text-foreground` title.

### Tables

Outer wrapper:
```
bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden
overflow-x-auto → <table className="w-full min-w-[1100px] text-sm" dir="rtl">
```

**Header row:**
```
<tr className="bg-[#e1e7fa]">
  <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">…</th>
```
(Or `bg-accent/50 sticky top-0 z-10` + `text-muted-foreground` — used by `DataTable` shared component.)

**Body row:**
```
<tr
  style={{ borderRightWidth: "4px", borderRightStyle: "solid", borderRightColor: STATUS_BORDER_COLORS[r.status] }}
  className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${isEven ? "bg-accent/40" : ""}`}
>
  <td className="px-5 py-4">…</td>
```
Zebra striping on odd rows (`bg-accent/40`). Hover `bg-primary/5`. Status expressed as inline `border-right` color.

**Skeleton loader:**
```
<tr className="border-b border-border/10">
  <td className="px-5 py-4"><div className="h-4 bg-accent rounded w-3/4 animate-pulse" /></td>
```

**Sort indicators** (`src/components/shared/DataTable.tsx`):
`<ChevronUp size={14} />` / `<ChevronDown size={14} />` / `<ChevronsUpDown size={14} className="opacity-40" />` inline beside header. Three-state cycle: asc → desc → null.

**Pagination:**
```
flex items-center justify-between px-4 py-3 border-t border-border/30 text-sm text-muted-foreground
  pager buttons: p-2 rounded-lg hover:bg-accent disabled:opacity-30 min-w-[44px] min-h-[44px]
```
Text: `{total} תוצאות | עמוד {page} מתוך {totalPages}`.

### Modals / Dialogs

**Standard: SidePanel, not centered modal.** Project rule ("No modals — SidePanel only").

`components/shared/SidePanel.tsx`:
- Overlay: `absolute inset-0 bg-black/65` with `fade 0.4s easeInOut`
- Panel: `absolute inset-y-0 left-0 w-[55%] max-sm:w-full flex flex-col shadow-2xl rounded-tr-[0.65rem] rounded-br-[0.65rem] bg-card/90 backdrop-blur-xl`
- Motion: `initial={{ x: "-100%", opacity: 0 }}` → `{{ x: 0, opacity: 1 }}`, `duration: 0.4, ease: "easeInOut"`
- Header: `bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4 rounded-tr-[0.65rem]` — title `text-lg font-bold text-white text-right font-headline`, subtitle `text-sm text-blue-100 mt-1`
- Close button: top-left `w-11 h-11 rounded-xl bg-white/20 hover:bg-white/40` with Lottie animation (`/lottie/menu-close.lottie`)
- Body: `flex-1 min-h-0 overflow-y-auto p-6 text-right`
- Sticky footer: `shrink-0 border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between`

**Small centered dialog pattern** (e.g. `AddTargetDialog`) still uses overlay + centered card but is rare.

### Badges / Chips / Tags

**Status pill** (`components/reservations/StatusPill.tsx`):
```
inline-flex items-center font-bold rounded-full border
  sm:  px-2.5 py-1 text-[11px] gap-1
  md:  px-3 py-1.5 text-xs gap-1.5
  colors by palette key (emerald/amber/red/blue/purple/slate/gray):
    bg-emerald-50 text-emerald-700 border-emerald-200
    dark: bg-emerald-950/20 text-emerald-400 border-emerald-800
```

**Generic pill badge** (inside tables):
```
inline-flex items-center px-3 py-1 rounded-full bg-accent text-foreground text-xs font-bold
```

**Trend badge** (KPI cards):
```
text-xs font-bold px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-50   (up)
                                              text-red-600 bg-red-50        (down)
```

**Count badge** (rooms page header):
```
text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full
```

### Dropdowns / Popovers

Native `<select>` with `app/styles/base.css` `.select-arrow` class (SVG chevron positioned `left 0.75rem center`, used implicitly through `appearance-none`). Guest search dropdown (Step1Guest) is a **manual absolute-positioned list** with outside-click handling.

### Tooltips

`components/shared/InfoTooltip.tsx` — small "ⓘ" icon with an on-hover info popup. No Radix tooltip library; it's hand-rolled.

### Toasts / Notifications

`sonner` via `<Toaster position="top-center" dir="rtl" richColors />`. Usage:
```ts
toast.success("ההזמנה נוצרה בהצלחה", { description: `מספר: ${n}`, duration: 4000 })
toast.error(result.error || "שגיאה")
```
Additional UX touch: `new Audio("/sounds/success.wav").play().catch(() => {})` after successful creates.

### Loading states

**Skeleton row** — rendered manually as `<div className="h-4 bg-accent rounded w-3/4 animate-pulse" />` inside `<td>`s, 6 rows.

**Page-level spinner:**
```
<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
```

**Inline button spinner:** `<Icon name="hourglass_empty" size="sm" className="animate-spin" />` (Lucide `Loader2`).

**Empty state** (`src/components/shared/EmptyState.tsx`):
```
flex flex-col items-center justify-center py-16 px-6 text-center
  icon wrapper: mb-4 text-muted-foreground/30 (Inbox, size 64, strokeWidth 1)
  title: text-lg font-bold text-foreground mb-1
  subtitle: text-sm text-muted-foreground max-w-sm mb-6
```

---

## 7. Interaction Patterns

### Inline editing (double-click)
- **Only active on the reservations table row** (`app/(dashboard)/reservations/page.tsx:181`). `onDoubleClick={() => openEdit(r.id, tenantId)}` opens the shared `ExistingReservationPanel` (SidePanel).
- There is **no cell-level inline editor** in the codebase. Editing always happens in the SidePanel form.
- Save is explicit (button in panel footer); Escape closes the panel (`SidePanel` listens globally for `Escape`).
- After save, the edit store bumps `savedTick`; list pages subscribe and re-fetch silently so the row updates without a skeleton flash.
- Double-click on tables is used to *open* a panel, not to swap a cell into edit mode.

### Bulk actions
- `src/components/shared/ActionBar.tsx`: appears above the table when `selectedCount > 0`.
- Style: `px-5 py-3 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200`.
- Contents: `X {count} נבחרו` on the right, action buttons on the left.
- Row selection pattern is not wired into DataTable yet — pages use custom `Set<string>` state.

### Filtering & Search
- **Top of page, in a flex-wrap row** alongside the header. No sidebar filters.
- Search = `<input>` with absolute Lucide `Search` icon at `right-4 top-1/2 -translate-y-1/2` (RTL: search icon on the right).
- Status/segment filter = pill-tabs group:
  ```
  flex bg-card rounded-xl border border-border/20 p-1 gap-1 overflow-x-auto no-scrollbar
    button: px-4 py-2.5 text-xs font-bold rounded-xl min-h-[44px]
    active: bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white shadow-sm
    idle:   text-muted-foreground hover:bg-accent
  ```
- Filters are **local state** per page (`useState`); array filter on render.
- Debounce: **300ms** (`src/hooks/use-debounce.ts`, default `DEFAULT_DELAY = 300`). Used for guest-search autocomplete in Step1Guest.

### Navigation
- No breadcrumbs.
- Sidebar links carry `{ href, icon, label, module }`; `isActive` is `startsWith` (except dashboard exact match).
- Opening an entity = SidePanel (never a new route). Entity panels live at the shell level (single instance) and are driven by Zustand stores (`useReservationFormStore`, `useRoomFormStore`, …).
- Back between pages = browser back — no custom in-page back button except inside multi-step panels.

### Forms
- Validation: **step-by-step** inside multi-step panels. `validateStep(n)` runs on Next / Submit; errors populate `store.errors`.
- Errors are shown **twice**: (1) a red banner at the top of the step:
  ```
  bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3
  ```
  with a bulleted list of messages (`flex flex-col gap-1 ps-6`); (2) per-field as `text-[11px] text-destructive mr-1` under each input.
- Autosave: no generic autosave. A "Save Draft" button appears only on the last step of reservation creation.
- "Saved" feedback: button swaps its icon/text between `save` / "שומר..." / `check` "נשמר" (observed in settings save flow).

### Keyboard shortcuts
- Escape: closes SidePanel (global `keydown` listener inside `SidePanel`).
- Native date picker: `Enter` / arrow keys handled by the browser. No custom shortcut layer (⌘K, etc.) — `cmdk` is not installed.

---

## 8. Animation & Transitions

**Default durations** (observed):
- Tailwind `transition-all` / `transition-colors` with default `150ms ease`.
- SidePanel overlay + slide: `duration: 0.4, ease: "easeInOut"` (framer-motion).
- Step content transition: `duration: 0.2, { opacity, x: 20 → 0 → -20 }` (AnimatePresence mode="wait").
- Sidebar collapse: `transition-all duration-300`.
- ActionBar appear: `animate-in fade-in slide-in-from-top-2 duration-200` (Tailwind animate-in plugin syntax).
- Button press: `active:scale-95` is the standard micro-interaction on all primary CTAs.

**Hover effects (standard):**
- Cards: `hover:shadow-md transition-all` (shadow lift only, no translate).
- Table rows: `hover:bg-primary/5 cursor-pointer transition-colors`.
- Ghost buttons: `hover:bg-accent rounded-xl transition-colors`.
- Primary CTAs: `hover:shadow-lg transition-all` (shadow only; the gradient stays).

**Modal (SidePanel) open/close:** overlay fades, panel slides from `x: "-100%"` (RTL = from the left edge). Exit mirrors.

**List item animations:** none explicit at the row level; `@formkit/auto-animate` is **not** installed.

---

## 9. RTL & Hebrew

- Root is RTL: `<html lang="he" dir="rtl">`. Main content is rendered RTL by default.
- Sidebar is fixed **right**: `h-screen fixed right-0 top-0 border-l border-sidebar-border`. Border-**left** in RTL visually sits on the inner edge.
- SidePanel: `absolute inset-y-0 left-0` (opens from the **left** side in RTL — the "end" edge in terms of visual intuition). Close button is `absolute left-4 top-4` (in RTL, "end" side).
- Logical properties used where spacing is direction-sensitive: `insetInlineStart / insetInlineEnd` (see ReservationModal step progress bar), `me-*` / `ms-*`, `ps-6`.
- Directional icons flip by intention, not automatically: "next" uses `chevron_left` (in RTL, left = forward); "back" uses `chevron_right`. Table pagination: "previous page" = `<ChevronRight size={18} />`, "next page" = `<ChevronLeft size={18} />`.
- Phone numbers forced LTR inside a cell but floated right: `<td dir="ltr"><span className="float-right">{phone}</span></td>`.
- Numbers/currency: `{Number(price).toLocaleString("he-IL")} ₪` (currency symbol after the number, with a space). `tabular-nums` on numeric table cells.
- Dates: `fmtDate(v)` returns `DD/MM` (short), using `String(d.getDate()).padStart(2, "0")/…`. `date-fns` is used for ranges and math.
- Sticky calendar column: `.room-sticky-col { position: sticky; right: 0; }` + `[dir="rtl"] .room-sticky-col { right: 0; left: auto }` in base.css.
- Status text inline-LTR fragments (e.g. "Booking.com", "WhatsApp") are accepted as-is alongside Hebrew — no explicit bidi wrappers are used; `tabular-nums` is applied to reservation numbers.
- shadcn overrides for RTL: none exist yet (shadcn not installed); the custom inputs/selects are designed RTL-first (`text-right`, icons on the correct side, select-arrow SVG at `left 0.75rem center`).

---

## 10. Iconography

- **Library**: `lucide-react` — single library, no mixes.
- **Wrapper**: `components/shared/Icon.tsx` maps ~200 Material-Icons-style string names (`"add"`, `"book_online"`, `"calendar_month"`, …) to Lucide components. Benefit: CMS/data strings stay stable if the icon library changes.
- **Sizes:** `sm: 16, md: 20, lg: 24, xl: 32` (passed as the `size` prop to Lucide). Default `strokeWidth={1.8}`.
- **Usage rules:**
  - Icon alone (ghost/icon buttons) always wrapped with `min-w-[44px] min-h-[44px] flex items-center justify-center`.
  - Icon + text in buttons: `flex items-center gap-2`. Primary CTA pattern: `<Icon name="add" size="sm" /> הזמנה חדשה`.
  - Nav items: `Icon name={...} filled={active} size="md"` (filled prop doesn't currently change rendering, but is kept for future Material-style variation).
  - Inside badges: `size="sm"` (16px), with `gap-1` / `gap-1.5`.

---

## 11. Dark Mode

- **Supported.** Enabled via `next-themes` in `app/providers.tsx` with `attribute="class"`, `defaultTheme="light"`, `enableSystem`, `disableTransitionOnChange`.
- Class-based (`<html class="dark">`), not `prefers-color-scheme`.
- Every CSS var has a dark-mode counterpart under `.dark { … }` (`app/styles/base.css`).
- Dark overrides for ribbon statuses (`color-mix(… 15%, transparent)`) in `status-colors.css`.
- UI toggle: TopBar button (`components/layout/TopBar.tsx`):
  ```tsx
  <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2.5 text-muted-foreground hover:bg-accent rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center">
    <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size="sm" />
  </button>
  ```
- Status-pill colors explicitly carry dark variants (`dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800`). Red error banner: `bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300`.

---

## 12. Key Files Reference

Copy these to reproduce the visual system from scratch:

**Base (design tokens, globals, utils):**
- `app/globals.css` — 6 lines of `@import`s
- `app/styles/base.css` — CSS vars, `@theme inline`, typography, pill classes, glass effects
- `app/styles/status-colors.css` — ribbon classes for reservation statuses
- `app/styles/calendar.css`, `editor.css`, `reports.css` — module-specific partials
- `app/layout.tsx` — `<html lang="he" dir="rtl">`, Noto Sans Hebrew font link
- `app/providers.tsx` — `NuqsAdapter` + `ThemeProvider` + `<Toaster>`
- `components.json` — shadcn config (RTL, cssVariables, "base-nova" style, baseColor "neutral")
- `lib/utils.ts` — `cn()` helper

**Layout:**
- `components/layout/Sidebar.tsx`
- `components/layout/TopBar.tsx`
- `components/layout/DashboardShell.tsx` + `app/(dashboard)/dashboard-shell.tsx`

**Shared primitives:**
- `components/shared/Icon.tsx`
- `components/shared/SidePanel.tsx`
- `components/shared/FormField.tsx` + `src/components/shared/FormField.tsx`
- `components/shared/DateInput.tsx`, `TimeInput.tsx`, `DateRangePicker.tsx`
- `components/shared/NumberStepper.tsx`
- `components/shared/InfoTooltip.tsx`, `FileViewer.tsx`
- `src/components/shared/DataTable.tsx`
- `src/components/shared/PageHeader.tsx`
- `src/components/shared/KpiCard.tsx`
- `src/components/shared/FilterBar.tsx`
- `src/components/shared/ActionBar.tsx`
- `src/components/shared/EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`
- `src/components/shared/StatusBadge.tsx`

**Hooks:**
- `src/hooks/use-debounce.ts`

**Constants that shape the UI:**
- `lib/constants/reservation.ts` — status labels, border colors, payment labels
- `lib/constants/room-display.ts` — 6 room states with label/color/border/hex/icon
- `lib/constants/area-display.ts`

**Static assets:**
- `/public/lottie/menu-close.lottie` — SidePanel close animation
- `/public/sounds/success.wav` — create-success chime

No `tailwind.config.{js,ts}` — v4 config lives entirely in CSS (`@theme inline`).

---

## 13. Code Snippets

### 1. Primary button (exact copy from `components/layout/TopBar.tsx`)

```tsx
<button
  onClick={() => openNewReservation()}
  className="bg-gradient-to-l from-primary to-primary-container text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow-md transition-all hidden sm:flex items-center gap-2 min-h-[44px]"
>
  <Icon name="add" size="sm" />
  הזמנה חדשה
</button>
```

And the hex-literal variant used on pages (`app/(dashboard)/reservations/page.tsx`):

```tsx
<button
  onClick={() => openNew()}
  className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 min-h-[44px]"
>
  <Icon name="add" size="sm" /> הזמנה חדשה
</button>
```

### 2. Table row with status-border + double-click to edit (from `app/(dashboard)/reservations/page.tsx`)

```tsx
{filtered.map((r, idx) => {
  const isEven = idx % 2 === 1
  return (
    <tr
      key={r.id}
      onDoubleClick={() => openEdit(r.id, tenantId)}
      style={{ borderRightWidth: "4px", borderRightStyle: "solid", borderRightColor: STATUS_BORDER_COLORS[r.status] || "#9ca3af" }}
      className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${isEven ? "bg-accent/40" : ""}`}
    >
      <td className="px-5 py-4 font-bold text-primary tabular-nums whitespace-nowrap">
        {r.reservation_number}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{r.guest_name?.charAt(0) || "?"}</span>
          </div>
          <span className="font-bold text-foreground text-base whitespace-nowrap">{r.guest_name}</span>
          {r.is_vip && <Icon name="star" size="sm" className="text-amber-500 shrink-0" />}
        </div>
      </td>
      <td className="px-5 py-4 text-foreground tabular-nums whitespace-nowrap" dir="ltr">
        <span className="float-right">{r.guest_phone || "—"}</span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent text-foreground text-xs font-bold">
          {r.room_numbers || "—"}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-accent text-muted-foreground"}`}>
          {STATUS_LABELS[r.status] || r.status}
        </span>
      </td>
      <td className="px-5 py-4 font-bold text-primary tabular-nums whitespace-nowrap">
        {Number(r.total_price).toLocaleString("he-IL")} ₪
      </td>
    </tr>
  )
})}
```

### 3. Form field with validation error (shared FormField + typical usage)

From `src/components/shared/FormField.tsx`:

```tsx
export function FormField({ label, required, error, children, className, htmlFor }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold text-muted-foreground mr-1">
        {label}
        {required && <span className="text-destructive mr-0.5"> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-destructive mr-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm text-right focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[48px]'
```

Consumer:

```tsx
<FormField label="שם פרטי" required error={errors.firstName} htmlFor="firstName">
  <input
    id="firstName"
    className={`${inputClass} ${errors.firstName ? "border-destructive/60 ring-1 ring-destructive/20" : ""}`}
    value={store.firstName}
    onChange={(e) => store.setField("firstName", e.target.value)}
  />
</FormField>
```

### 4. SidePanel open (from `components/shared/SidePanel.tsx`)

```tsx
<motion.aside
  initial={{ x: "-100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: "-100%", opacity: 0 }}
  transition={{ duration: 0.4, ease: "easeInOut" }}
  className={`absolute inset-y-0 left-0 ${widthClass ?? "w-[55%] max-sm:w-full"} flex flex-col shadow-2xl rounded-tr-[0.65rem] rounded-br-[0.65rem] bg-card/90 backdrop-blur-xl dark:bg-card/90`}
  role="dialog"
  aria-modal="true"
  aria-label={title}
>
  <div className="relative bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4 rounded-tr-[0.65rem] shrink-0">
    <button
      onClick={onClose}
      className="absolute left-4 top-4 z-10 p-1.5 rounded-xl bg-white/20 hover:bg-white/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label="סגור"
    >
      <DotLottieReact src="/lottie/menu-close.lottie" loop={false} autoplay className="w-6 h-6" />
    </button>
    <h2 className="text-lg font-bold text-white text-right font-headline">{title}</h2>
    {subtitle && <p className="text-sm text-blue-100 mt-1 text-right">{subtitle}</p>}
  </div>

  <div className={`flex-1 min-h-0 text-right ${noPadding ? "overflow-hidden" : "overflow-y-auto p-6"}`}>
    {children}
  </div>

  {footer && <div className="shrink-0">{footer}</div>}
</motion.aside>
```

### 5. KPI card (from `app/(dashboard)/dashboard/page.tsx`)

```tsx
{KPI_CARDS.map((card) => (
  <div key={card.label} className="kpi-card bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className={`p-2 rounded-xl ${card.color}`}>
        <Icon name={card.icon} />
      </span>
      {card.trend && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${card.trendUp ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
          {card.trend}
        </span>
      )}
    </div>
    <p className="text-3xl font-extrabold mt-2">{card.value}</p>
    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
  </div>
))}
```

With card data shape:
```ts
const KPI_CARDS = [
  { icon: "percent",        label: "תפוסה",          value: "84%", trend: "+2.4%", trendUp: true,  color: "text-primary bg-primary/10" },
  { icon: "meeting_room",   label: "חדרים פנויים",    value: "12",                                color: "text-secondary bg-secondary/10" },
  { icon: "login",          label: "צ'ק-אין היום",    value: "24",                                color: "text-tertiary bg-tertiary/10" },
  { icon: "construction",   label: "חדרים בתחזוקה",  value: "3",                                 color: "text-amber-600 bg-amber-50" },
]
```

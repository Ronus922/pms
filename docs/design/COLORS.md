# Sapphire Design System -- Colors

## Brand Colors

| Token | Light | Dark | Tailwind |
|-------|-------|------|----------|
| Primary | `#003aa0` | `#a4c9ff` | `text-primary` / `bg-primary` |
| Primary Container | `#3F51B5` | `#1a237e` | `bg-primary-container` |
| Primary Gradient | `from-[#003aa0] to-[#3F51B5]` | `from-[#1a237e] to-[#3F51B5]` | `bg-gradient-to-l from-[#003aa0] to-[#3F51B5]` |

### Brand Gradient Usage

```tsx
// Header gradient (RTL: gradient flows right-to-left)
<div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white">
  Panel Header
</div>

// Primary button with gradient
<button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white rounded-xl px-4 py-2">
  Save
</button>
```

---

## Surface Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Background | `#f6f8fb` | `#0f172a` | Page background |
| Card | `#ffffff` | `#1a1c22` | Cards, panels, containers |
| Accent | `#f1f5f9` | `#1e293b` | Subtle highlights, input bg, table header |
| Border | `#e2e8f0` | `#334155` | Borders, dividers |

```tsx
// Card on page background
<div className="bg-card rounded-[20px] border border-border p-4 shadow-sm">
  Card content
</div>

// Accent surface for inputs
<input className="bg-accent border border-border/40 rounded-xl px-5 py-3.5 min-h-[48px]" />

// Page background
<main className="bg-background min-h-screen">
  ...
</main>
```

---

## Text Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Foreground | `#0f172a` (slate-900) | `#f1f5f9` (slate-100) | Primary text |
| Muted Foreground | `#64748b` (slate-500) | `#94a3b8` (slate-400) | Labels, captions, secondary text |
| Primary Foreground | `#ffffff` | `#0f172a` | Text on primary bg |

```tsx
// Primary text
<h2 className="text-foreground font-bold">Title</h2>

// Secondary / muted text
<span className="text-muted-foreground text-sm">Label text</span>

// Text on primary surface
<div className="bg-primary text-primary-foreground">White on blue</div>
```

---

## Semantic / Status Colors

| Status | Color Family | Light BG | Light Text | Border | Dark BG | Dark Text |
|--------|-------------|----------|------------|--------|---------|-----------|
| Success | Emerald | `bg-emerald-50` | `text-emerald-700` | `border-emerald-500` | `bg-emerald-950` | `text-emerald-400` |
| Warning | Amber | `bg-amber-50` | `text-amber-700` | `border-amber-500` | `bg-amber-950` | `text-amber-400` |
| Danger | Red | `bg-red-50` | `text-red-700` | `border-red-500` | `bg-red-950` | `text-red-400` |
| Active / Info | Blue | `bg-blue-50` | `text-blue-700` | `border-blue-500` | `bg-blue-950` | `text-blue-400` |
| Neutral | Slate | `bg-slate-100` | `text-slate-600` | `border-slate-400` | `bg-slate-800` | `text-slate-400` |

### Status Border Pattern

Entities show status via a thick right border (RTL), never dots or badges:

```tsx
// Reservation status — border on the right (RTL)
<div className="border-r-4 border-emerald-500 bg-card rounded-[20px] p-4">
  Confirmed reservation
</div>

<div className="border-r-4 border-amber-500 bg-card rounded-[20px] p-4">
  Pending reservation
</div>

<div className="border-r-4 border-red-500 bg-card rounded-[20px] p-4">
  Cancelled reservation
</div>

<div className="border-r-4 border-blue-500 bg-card rounded-[20px] p-4">
  Checked-in reservation
</div>
```

### Status Mapping Table

| Entity Status | Color | Border Class |
|---------------|-------|-------------|
| Confirmed / Active / Clean | Emerald | `border-r-4 border-emerald-500` |
| Pending / In-Progress | Amber | `border-r-4 border-amber-500` |
| Cancelled / Overdue / Dirty | Red | `border-r-4 border-red-500` |
| Checked-in / Current | Blue | `border-r-4 border-blue-500` |
| Checked-out / Archived | Slate | `border-r-4 border-slate-400` |

---

## Status Badges (Inline)

When inline status is needed (table cells, tags):

```tsx
// Success badge
<span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 text-xs font-bold">
  Confirmed
</span>

// Warning badge
<span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-bold">
  Pending
</span>

// Danger badge
<span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-bold">
  Cancelled
</span>
```

---

## Dark Mode

All colors use CSS custom properties via Tailwind. Dark mode is toggled via `class="dark"` on `<html>`.

```tsx
// Automatic dark mode support
<div className="bg-background text-foreground">
  <div className="bg-card border border-border rounded-[20px] p-4">
    <h3 className="text-foreground">Title</h3>
    <p className="text-muted-foreground">Description</p>
  </div>
</div>
```

### Dark Mode Token Map

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--background` | `#f6f8fb` | `#0f172a` |
| `--card` | `#ffffff` | `#1a1c22` |
| `--foreground` | `#0f172a` | `#f1f5f9` |
| `--muted-foreground` | `#64748b` | `#94a3b8` |
| `--primary` | `#003aa0` | `#a4c9ff` |
| `--border` | `#e2e8f0` | `#334155` |
| `--accent` | `#f1f5f9` | `#1e293b` |
| `--destructive` | `#ef4444` | `#f87171` |

---

## Forbidden Colors

These colors are **never** used in the Sapphire system:

- Neon / saturated colors (`#00ff00`, `#ff00ff`, hot pink, lime, cyan)
- Pure black `#000000` for text (use slate-900 / foreground)
- Pure white `#ffffff` for page background (use `#f6f8fb` / background)
- Any color not listed in this document
- Gradients other than the brand gradient
- Opacity below 10% for interactive elements

---

## Quick Reference -- Common Combinations

```tsx
// Page
<main className="bg-background text-foreground" />

// Card
<div className="bg-card border border-border rounded-[20px] p-4 shadow-sm" />

// Hover card
<div className="bg-card border border-border rounded-[20px] p-4 shadow-sm hover:shadow-md transition-shadow" />

// Active card
<div className="bg-card border-2 border-primary rounded-[20px] p-4 ring-2 ring-primary/20" />

// Muted section
<div className="bg-accent rounded-xl p-4" />

// Primary button
<button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white rounded-xl px-4 py-2" />

// Outline button
<button className="border border-border bg-card text-foreground rounded-xl px-4 py-2 hover:bg-accent" />

// Destructive button
<button className="bg-red-600 text-white rounded-xl px-4 py-2 hover:bg-red-700" />
```

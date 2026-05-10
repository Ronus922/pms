# Sapphire Design System -- Mobile UI Patterns

## Breakpoints

| Name | Min Width | Tailwind Prefix | Usage |
|------|-----------|-----------------|-------|
| Small Mobile | 320px | (default) | Small phones |
| Mobile | 375px | `xs:` | Standard phones |
| Large Mobile | 428px | `sm:` | Large phones |
| Small Tablet | 640px | `sm:` | Portrait tablets |
| Tablet | 768px | `md:` | Landscape tablets |
| Small Desktop | 1024px | `lg:` | Laptops |
| Desktop | 1280px | `xl:` | Standard monitors |
| Large Desktop | 1536px | `2xl:` | Wide monitors |
| TV / Ultra-wide | 2560px | `3xl:` | Projectors, TV |

Design mobile-first: default styles target 320px, then layer up with breakpoints.

---

## SidePanel on Mobile

On screens below `lg` (1024px), the SidePanel becomes full-width.

```tsx
<div className="fixed left-0 top-0 bottom-0
                w-full lg:w-[55%]
                bg-background flex flex-col shadow-2xl z-50">
  {/* Same structure as desktop */}
</div>
```

---

## Tables to Cards

Tables collapse into card lists on mobile.

```tsx
{/* Desktop table */}
<div className="hidden lg:block">
  <table className="w-full">...</table>
</div>

{/* Mobile card list */}
<div className="lg:hidden space-y-3 px-4">
  {items.map(item => (
    <div
      key={item.id}
      className="bg-card rounded-[20px] border border-border p-4 shadow-sm
                 border-r-4 border-r-emerald-500 active:bg-accent/30"
      onClick={() => openPanel(item)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-foreground">{item.title}</span>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{item.field1}</span>
        <span>{item.field2}</span>
      </div>
    </div>
  ))}
</div>
```

---

## Grid Collapse

Multi-column grids collapse to single column on mobile.

```tsx
// KPI grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <KPICard />
  <KPICard />
  <KPICard />
  <KPICard />
</div>

// Form grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InputField />
  <InputField />
</div>

// Dashboard charts
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <ChartCard />
  <ChartCard />
</div>
```

---

## Bottom Sheet

Replaces dropdowns and select menus on mobile.

```tsx
// Bottom sheet container
<div className="fixed inset-0 z-50 lg:hidden">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/65" onClick={onClose} />

  {/* Sheet */}
  <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-[20px]
                  shadow-2xl max-h-[80vh] flex flex-col animate-slide-up">
    {/* Handle */}
    <div className="flex justify-center py-3">
      <div className="w-10 h-1 rounded-full bg-border" />
    </div>

    {/* Title */}
    <div className="px-6 pb-3 border-b border-border">
      <h3 className="text-lg font-bold text-foreground">Select Room Type</h3>
    </div>

    {/* Options */}
    <div className="flex-1 overflow-y-auto p-4">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => { select(option.value); onClose() }}
          className={cn(
            "w-full p-4 rounded-xl text-right flex items-center justify-between",
            "active:bg-accent transition-colors",
            selected === option.value && "bg-primary/5 border border-primary/20"
          )}
        >
          <span className="text-base text-foreground">{option.label}</span>
          {selected === option.value && (
            <Check className="w-5 h-5 text-primary" />
          )}
        </button>
      ))}
    </div>
  </div>
</div>
```

### Bottom Sheet Animation

```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.animate-slide-up {
  animation: slide-up 0.3s ease forwards;
}
```

---

## Floating Action Button (FAB)

Primary create action on mobile.

```tsx
{/* Mobile FAB */}
<button
  className="fixed bottom-6 left-6 z-30 lg:hidden
             w-14 h-14 rounded-full shadow-lg
             bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
             flex items-center justify-center
             active:scale-95 transition-transform"
  onClick={onCreate}
>
  <Plus className="w-6 h-6 text-white" />
</button>
```

Position: `bottom-6 left-6` (RTL: left side is the natural FAB position).

---

## Pull to Refresh

```tsx
// Visual indicator (pulled down from top)
{isPulling && (
  <div className="flex justify-center py-4">
    <RefreshCw className={cn(
      "w-5 h-5 text-primary transition-transform",
      isRefreshing && "animate-spin"
    )} />
  </div>
)}
```

---

## Swipe Gestures

### Swipe to Reveal Actions

```tsx
<div className="relative overflow-hidden rounded-[20px]">
  {/* Action buttons (behind card) */}
  <div className="absolute inset-y-0 left-0 flex items-center gap-1 px-2">
    <button className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
      <Trash2 className="w-5 h-5 text-white" />
    </button>
    <button className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
      <Edit className="w-5 h-5 text-white" />
    </button>
  </div>

  {/* Card content (swipeable) */}
  <div
    className="bg-card border border-border p-4 relative z-10
               transition-transform touch-pan-y"
    style={{ transform: `translateX(${swipeOffset}px)` }}
  >
    Card content
  </div>
</div>
```

Note: In RTL, swipe **left-to-right** reveals actions on the left side.

---

## Compact Header

Mobile headers use smaller titles and icon-only action buttons.

```tsx
// Mobile page header
<div className="flex items-center justify-between px-4 py-3">
  <div>
    <h1 className="text-lg font-bold text-foreground sm:text-[28px]">
      Reservations
    </h1>
    <p className="text-sm text-muted-foreground hidden sm:block">
      Manage all reservations
    </p>
  </div>

  {/* Icon-only on mobile, full button on desktop */}
  <button className="w-11 h-11 rounded-xl bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
                     flex items-center justify-center lg:hidden">
    <Plus className="w-5 h-5 text-white" />
  </button>
  <button className="hidden lg:flex bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
                     text-white rounded-xl px-4 py-2 font-bold items-center gap-2">
    <Plus className="w-4 h-4" />
    New Reservation
  </button>
</div>
```

---

## Bottom Navigation

For mobile-first apps that need persistent navigation.

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border
                z-40 lg:hidden safe-area-bottom">
  <div className="flex justify-around py-2">
    {navItems.map(item => (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px]",
          "min-h-[44px] justify-center",
          isActive(item.href) ? "text-primary" : "text-muted-foreground"
        )}
      >
        <item.icon className="w-5 h-5" />
        <span className="text-[11px] font-bold">{item.label}</span>
      </Link>
    ))}
  </div>
</nav>

{/* Add bottom padding to main content */}
<main className="pb-20 lg:pb-0">
  ...
</main>
```

---

## Touch-Friendly Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Button min size | 44x44px | 44x44px (same) |
| Input height | 48px | 48px (same) |
| List item padding | `p-3` | `p-4` |
| Icon button | `w-9 h-9` | `w-11 h-11` |
| Tap gap between items | `gap-2` | `gap-3` |
| Card padding | `p-4` | `p-4` |
| Page padding | `px-8 py-6` | `px-4 py-4` |

---

## Input Zoom Prevention

iOS Safari zooms in on inputs smaller than 16px. Prevent this:

```tsx
// All inputs MUST be at least 16px (text-base)
<input className="text-base ..." />
<select className="text-base ..." />
<textarea className="text-base ..." />

// NEVER use text-sm or text-xs on form inputs
// text-sm is OK for labels, captions, and non-input elements
```

---

## Safe Area Handling

For devices with notches, home indicators, etc.

```css
/* Safe area padding */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.safe-area-top {
  padding-top: env(safe-area-inset-top, 0);
}
```

```tsx
// Bottom nav with safe area
<nav className="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)]">
  ...
</nav>
```

---

## Responsive Patterns Summary

| Desktop Pattern | Mobile Replacement |
|----------------|--------------------|
| SidePanel (55%) | Full-screen panel |
| Data table | Card list |
| Multi-column grid | Single column |
| Dropdown select | Bottom sheet |
| Button with text | Icon-only button or FAB |
| Page header + subtitle | Compact header |
| Sidebar navigation | Bottom navigation |
| Hover effects | Active/press effects |
| Right-click menu | Long-press or swipe |
| Tooltip | No tooltip (content inline) |

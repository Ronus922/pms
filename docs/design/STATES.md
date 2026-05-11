# Sapphire Design System -- UI States

## Loading State: Skeleton Shimmer

Skeletons match the shape and size of the content they replace.

```tsx
// Text skeleton
<div className="h-4 w-32 bg-accent rounded animate-pulse" />

// Title skeleton
<div className="h-6 w-48 bg-accent rounded animate-pulse" />

// Avatar skeleton
<div className="w-10 h-10 bg-accent rounded-full animate-pulse" />

// Card skeleton
<div className="bg-card rounded-[20px] border border-border p-6 space-y-4">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-accent rounded-full animate-pulse" />
    <div className="space-y-2 flex-1">
      <div className="h-4 w-32 bg-accent rounded animate-pulse" />
      <div className="h-3 w-24 bg-accent rounded animate-pulse" />
    </div>
  </div>
  <div className="space-y-2">
    <div className="h-4 w-full bg-accent rounded animate-pulse" />
    <div className="h-4 w-3/4 bg-accent rounded animate-pulse" />
  </div>
</div>

// KPI card skeleton
<div className="bg-card rounded-[20px] border border-border p-4">
  <div className="h-3 w-20 bg-accent rounded animate-pulse mb-3" />
  <div className="h-8 w-16 bg-accent rounded animate-pulse" />
</div>

// Table row skeleton
<tr className="border-b border-border/10">
  <td className="px-4 py-3"><div className="h-4 w-28 bg-accent rounded animate-pulse" /></td>
  <td className="px-4 py-3"><div className="h-4 w-16 bg-accent rounded animate-pulse" /></td>
  <td className="px-4 py-3"><div className="h-4 w-24 bg-accent rounded animate-pulse" /></td>
</tr>
```

### Rules

- Always use `bg-accent` for skeleton color (matches surface hierarchy)
- Always use `animate-pulse` for shimmer effect
- Match `rounded` to the element being replaced (rounded-full for avatars, rounded for text)
- Provide 3-5 skeleton rows for tables
- Skeleton width should approximate real content width

---

## Empty State

Centered within the content area, with an icon, title, description, and optional CTA.

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
  {/* Icon */}
  <div className="mb-4">
    <Inbox className="w-16 h-16 text-muted-foreground opacity-30" />
  </div>

  {/* Title */}
  <h3 className="text-lg font-bold text-foreground mb-1">
    No results found
  </h3>

  {/* Description */}
  <p className="text-muted-foreground text-sm max-w-sm mb-6">
    There are no items matching your criteria. Try adjusting your filters or create a new item.
  </p>

  {/* Optional CTA */}
  <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                     rounded-xl px-6 py-2.5 font-bold min-h-[44px]">
    Create New Item
  </button>
</div>
```

### Empty State Variants

```tsx
// Filtered empty (different from truly empty)
<div className="text-center py-12">
  <Search className="w-12 h-12 text-muted-foreground opacity-30 mx-auto mb-3" />
  <h3 className="text-lg font-bold text-foreground mb-1">No matches</h3>
  <p className="text-muted-foreground text-sm">Try different search terms</p>
</div>

// First-time empty (onboarding)
<div className="text-center py-12">
  <Sparkles className="w-12 h-12 text-primary opacity-50 mx-auto mb-3" />
  <h3 className="text-lg font-bold text-foreground mb-1">Get started</h3>
  <p className="text-muted-foreground text-sm mb-4">Create your first reservation</p>
  <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                     rounded-xl px-6 py-2.5 font-bold">
    + New Reservation
  </button>
</div>
```

---

## Error State

### Inline Error Banner

```tsx
<div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-bold text-red-800 mb-1">
      Failed to save changes
    </h4>
    <ul className="text-sm text-red-700 space-y-0.5">
      <li>Check-out date must be after check-in date</li>
      <li>Room is not available for the selected dates</li>
    </ul>
  </div>
</div>
```

### Page-Level Error

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
    <AlertTriangle className="w-8 h-8 text-red-600" />
  </div>
  <h3 className="text-lg font-bold text-foreground mb-1">Something went wrong</h3>
  <p className="text-muted-foreground text-sm max-w-sm mb-6">
    We could not load this page. Please try again.
  </p>
  <button onClick={retry}
          className="border border-border rounded-xl px-6 py-2.5 min-h-[44px]
                     hover:bg-accent font-bold">
    Try Again
  </button>
</div>
```

---

## Success State: Toast Notification

Toasts appear at the bottom-right (bottom-left in RTL) and auto-dismiss after 3 seconds.

```tsx
// Using sonner
import { toast } from 'sonner'

// Success toast
toast.success('Reservation saved successfully')

// Error toast
toast.error('Failed to save reservation')

// Custom toast styling (via Toaster config)
<Toaster
  position="bottom-left"  // RTL: left side
  toastOptions={{
    className: 'rounded-xl border border-border shadow-lg',
    style: {
      fontFamily: 'var(--font-sans)',
    },
  }}
/>
```

---

## Disabled State

```tsx
// Disabled button
<button
  disabled
  className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
             rounded-xl px-4 py-2 font-bold min-h-[44px]
             opacity-50 cursor-not-allowed"
>
  Save
</button>

// Disabled input
<input
  disabled
  className="w-full min-h-[48px] bg-accent border border-border/40 rounded-xl
             px-5 py-3.5 opacity-50 cursor-not-allowed"
/>

// Disabled card
<div className="bg-card rounded-[20px] border border-border p-4
                opacity-50 pointer-events-none">
  Disabled content
</div>
```

| Property | Value |
|----------|-------|
| Opacity | `opacity-50` |
| Cursor | `cursor-not-allowed` |
| Interaction | `pointer-events-none` (for non-focusable elements) |

---

## Active / Selected State

```tsx
// Selected card
<div className="bg-card rounded-[20px] border-2 border-primary p-4
                ring-2 ring-primary/20 shadow-md">
  Selected item
</div>

// Selected list item
<div className="bg-primary/5 border-r-4 border-primary p-3 rounded-xl">
  Active item
</div>

// Selected tab
<button className="px-4 py-2 text-sm font-bold border-b-2 border-primary text-primary">
  Active Tab
</button>

// Unselected tab
<button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
  Inactive Tab
</button>
```

---

## Hover State

```tsx
// Card hover
<div className="bg-card rounded-[20px] border border-border p-4 shadow-sm
                hover:shadow-md transition-shadow cursor-pointer">
  Hoverable card
</div>

// Row hover
<tr className="hover:bg-accent/30 transition-colors cursor-pointer">
  ...
</tr>

// Button hover
<button className="bg-accent hover:bg-accent/80 transition-colors rounded-xl px-4 py-2">
  Hover me
</button>

// Icon button hover
<button className="w-9 h-9 flex items-center justify-center rounded-lg
                   hover:bg-accent transition-colors">
  <MoreHorizontal className="w-4 h-4" />
</button>
```

---

## Focus State

```tsx
// Input focus
<input className="... focus:outline-none focus:ring-2 focus:ring-primary/20
                  focus:border-primary/40 transition-all" />

// Button focus
<button className="... focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-primary/20 focus-visible:ring-offset-2" />

// Card focus (keyboard navigation)
<div tabIndex={0}
     className="... focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary/20 focus-visible:ring-offset-2">
  Focusable card
</div>
```

---

## Dirty Form / Unsaved Changes

```tsx
// Unsaved indicator in header
{isDirty && (
  <span className="bg-amber-50 text-amber-700 border border-amber-200
                   rounded-full px-2 py-0.5 text-xs font-bold">
    Unsaved changes
  </span>
)}

// Leave confirmation
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [isDirty])
```

---

## Offline State

```tsx
// Offline banner (top of page)
{!isOnline && (
  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2
                  flex items-center justify-center gap-2">
    <WifiOff className="w-4 h-4 text-amber-600" />
    <span className="text-sm font-bold text-amber-700">
      You are offline. Changes will be saved when connection is restored.
    </span>
  </div>
)}
```

---

## Shadow Scale

| State | Shadow | Usage |
|-------|--------|-------|
| Rest | `shadow-sm` | Cards, containers at rest |
| Hover | `shadow-md` | Cards on hover, elevated elements |
| Overlay | `shadow-2xl` | SidePanel, dropdowns, popovers |
| None | `shadow-none` | Flat elements, disabled |

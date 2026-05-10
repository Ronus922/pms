# SidePanel Component Standard

> Sapphire Design System -- All entity views, forms, and wizards use SidePanel instead of centered modals.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | `false` | Controls visibility |
| `onClose` | `() => void` | required | Close handler |
| `title` | `string` | required | Panel header title |
| `subtitle` | `string` | `undefined` | Optional subtitle below title |
| `icon` | `LucideIcon` | `undefined` | Optional icon next to title |
| `children` | `ReactNode` | required | Panel body content |
| `footer` | `ReactNode` | `undefined` | Sticky footer slot (action buttons) |
| `width` | `string` | `"55%"` | Panel width on desktop |
| `variant` | `"view" \| "edit" \| "wizard"` | `"view"` | Panel mode |
| `wizardStep` | `number` | `undefined` | Current step (wizard mode only) |
| `wizardTotalSteps` | `number` | `undefined` | Total steps (wizard mode only) |

## Structure

```
Overlay (fixed inset-0, bg-black/40, z-50)
  Panel (fixed top-0 left-0 h-full, w-[55%], bg-background)
    Header (gradient bg, px-6 py-4)
      Close button (top-left, X icon)
      Title + Subtitle (white text)
      Optional action icons (top-right)
    Content (flex-1, overflow-y-auto, p-6)
      {children}
    Footer (sticky bottom, border-t, backdrop-blur, px-6 py-4)
      {footer}
```

## Header

```tsx
{/* Gradient header */}
<div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4 text-white">
  {/* Close button - top left for RTL */}
  <button
    onClick={onClose}
    className="absolute top-4 left-4 rounded-lg p-2 text-white/80
               hover:bg-white/10 hover:text-white transition-colors
               min-h-[44px] min-w-[44px] flex items-center justify-center"
    aria-label="סגור"
  >
    <X className="h-5 w-5" strokeWidth={1.8} />
  </button>

  {/* Title area */}
  <div className="flex items-center gap-3 text-right pr-2">
    {icon && <Icon className="h-6 w-6" strokeWidth={1.8} />}
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && (
        <p className="text-sm text-white/70">{subtitle}</p>
      )}
    </div>
  </div>
</div>
```

## Content Area

```tsx
<div className="flex-1 overflow-y-auto p-6 text-right" dir="rtl">
  {children}
</div>
```

## Footer

```tsx
<div className="sticky bottom-0 border-t border-border/30 bg-background/80
                backdrop-blur-sm px-6 py-4 flex items-center gap-3
                flex-row-reverse">
  {footer}
</div>
```

## Animation

```tsx
// Panel slides in from the left (RTL layout)
// Duration: 400ms ease-out

// Tailwind classes for animation:
// Enter: translate-x-0 (from -translate-x-full)
// Exit: -translate-x-full (from translate-x-0)

const panelClasses = cn(
  "fixed top-0 left-0 h-full bg-background shadow-2xl z-50",
  "transition-transform duration-[400ms] ease-out",
  open ? "translate-x-0" : "-translate-x-full"
);

// Overlay fade
const overlayClasses = cn(
  "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
  open ? "opacity-100" : "opacity-0 pointer-events-none"
);
```

## Keyboard and Accessibility

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="panel-title"
  aria-describedby="panel-subtitle"
>
```

- **Escape**: closes the panel
- **Focus trap**: Tab cycles within panel only while open
- **Return focus**: on close, focus returns to the trigger element
- **Overlay click**: closes the panel

```tsx
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) onClose();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [open, onClose]);
```

## Mobile Behavior

```tsx
// Mobile: full width
// Desktop: 55% width (configurable)

const widthClasses = cn(
  "w-full md:w-[55%]",
  // Override with custom width prop on desktop
  width && `md:w-[${width}]`
);
```

## Variants

### View Mode
- Read-only content display
- Footer may contain "edit" button or be absent
- Content sections use cards with border-r-4 for status

### Edit Mode
- Form fields in content area
- Footer always present: Cancel + Save buttons
- Dirty state tracking: warn before close if unsaved changes

### Wizard Mode
- Step progress indicator below header
- Footer: Back + Next/Submit buttons
- Steps shown as `flex-row-reverse` (RTL)

```tsx
{/* Wizard progress bar */}
<div className="px-6 py-3 border-b border-border/20 bg-accent/30">
  <div className="flex flex-row-reverse items-center gap-2">
    {Array.from({ length: totalSteps }, (_, i) => (
      <div
        key={i}
        className={cn(
          "h-2 flex-1 rounded-full transition-colors",
          i < currentStep ? "bg-primary" : "bg-border"
        )}
      />
    ))}
  </div>
  <p className="text-xs text-muted-foreground text-right mt-1">
    שלב {currentStep} מתוך {totalSteps}
  </p>
</div>
```

## Do / Don't

| Do | Don't |
|----|-------|
| Use SidePanel for ALL entity views | Never use centered/floating modals |
| Gradient header with white text | Plain white/gray headers |
| Sticky footer for actions | Actions scattered in content |
| Slide from left (RTL) | Slide from right or fade in |
| 55% width on desktop | Full width on desktop |
| Full width on mobile | Narrow panel on mobile |
| Focus trap when open | Allow focus outside panel |
| Close on Escape + overlay click | Only close via X button |
| `p-6` content padding | No padding on content |
| border-r-4 for status indication | Dots or badges for status |

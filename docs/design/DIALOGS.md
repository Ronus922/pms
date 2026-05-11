# Sapphire Design System -- Dialogs and Panels

## Core Rule: NO Centered Modals

The Sapphire system **never** uses centered floating modals for forms, wizards, or detail views. All such interactions use the **SidePanel** pattern.

The only exceptions:
1. **Confirmation Dialog** -- small destructive action confirmation (delete, cancel)
2. **Quick View Popup** -- lightweight preview triggered by eye icon

---

## SidePanel

### Position and Sizing

| Property | Desktop | Mobile |
|----------|---------|--------|
| Position | `fixed left-0 top-0 bottom-0` | `fixed inset-0` |
| Width | `w-[55%]` | `w-full` |
| Z-index | `z-50` | `z-50` |
| Direction | Opens from left (RTL layout) | Full screen |

### Backdrop

```tsx
// Backdrop overlay
<div className="fixed inset-0 bg-black/65 z-40" onClick={onClose} />
```

### Animation

```css
/* Slide in from left */
@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slide-out-left {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

.side-panel-enter {
  animation: slide-in-left 0.4s ease forwards;
}

.side-panel-exit {
  animation: slide-out-left 0.3s ease forwards;
}
```

### Structure

```tsx
<div className="fixed inset-0 z-50">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/65" onClick={onClose} />

  {/* Panel */}
  <div className="fixed left-0 top-0 bottom-0 w-[55%] max-lg:w-full bg-background
                  flex flex-col shadow-2xl animate-slide-in-left z-50">

    {/* Header */}
    <div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-4
                    flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-bold">Panel Title</h2>
        <p className="text-white/70 text-sm">Subtitle or context</p>
      </div>
      <button
        onClick={onClose}
        className="w-10 h-10 flex items-center justify-center rounded-lg
                   hover:bg-white/10 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-6">
      {children}
    </div>

    {/* Footer */}
    <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm
                    px-6 py-4 flex items-center gap-3">
      <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                         rounded-xl px-6 py-2.5 font-bold min-h-[44px]">
        Save
      </button>
      <button className="border border-border bg-card text-foreground
                         rounded-xl px-6 py-2.5 min-h-[44px] hover:bg-accent"
              onClick={onClose}>
        Cancel
      </button>
    </div>
  </div>
</div>
```

### Header Variants

```tsx
// Standard header
<div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-4">
  <h2 className="text-lg font-bold">New Reservation</h2>
</div>

// Header with status badge
<div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-4
                flex items-center gap-3">
  <h2 className="text-lg font-bold">Reservation #1234</h2>
  <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
    Confirmed
  </span>
</div>

// Header with tabs
<div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white">
  <div className="px-6 py-4">
    <h2 className="text-lg font-bold">Edit Reservation</h2>
  </div>
  <div className="flex gap-1 px-6">
    <button className="px-4 py-2 text-sm font-bold border-b-2 border-white">
      Details
    </button>
    <button className="px-4 py-2 text-sm text-white/60 hover:text-white/80">
      Payments
    </button>
  </div>
</div>
```

---

## Wizard Variant (Multi-Step)

The SidePanel supports a wizard mode with a step progress bar.

```tsx
// Wizard progress bar (below header)
<div className="bg-accent border-b border-border px-6 py-3 shrink-0">
  <div className="flex flex-row-reverse items-center gap-2">
    {steps.map((step, i) => (
      <div key={i} className="flex flex-row-reverse items-center gap-2">
        {/* Step indicator */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
          i < currentStep && "bg-emerald-500 text-white",       // Completed
          i === currentStep && "bg-primary text-white",          // Current
          i > currentStep && "bg-border text-muted-foreground"   // Future
        )}>
          {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
        </div>

        {/* Step label */}
        <span className={cn(
          "text-sm font-bold hidden sm:block",
          i === currentStep ? "text-foreground" : "text-muted-foreground"
        )}>
          {step.label}
        </span>

        {/* Connector line */}
        {i < steps.length - 1 && (
          <div className={cn(
            "h-0.5 w-8",
            i < currentStep ? "bg-emerald-500" : "bg-border"
          )} />
        )}
      </div>
    ))}
  </div>
</div>

// Wizard footer with back/next
<div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm
                px-6 py-4 flex items-center justify-between">
  <button
    onClick={onBack}
    disabled={currentStep === 0}
    className="border border-border rounded-xl px-4 py-2 min-h-[44px]
               disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Back
  </button>
  <div className="flex gap-3">
    <button onClick={onClose}
            className="border border-border rounded-xl px-4 py-2 min-h-[44px]">
      Cancel
    </button>
    <button
      onClick={isLastStep ? onSubmit : onNext}
      className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                 rounded-xl px-6 py-2.5 font-bold min-h-[44px]"
    >
      {isLastStep ? 'Save' : 'Next'}
    </button>
  </div>
</div>
```

---

## Confirmation Dialog

The **only** centered dialog allowed. Used for destructive confirmations.

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/65" onClick={onCancel} />

  {/* Dialog */}
  <div className="relative bg-card rounded-[20px] shadow-2xl p-6 w-full max-w-md
                  border border-border z-10">
    {/* Icon */}
    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center
                    mx-auto mb-4">
      <AlertTriangle className="w-6 h-6 text-red-600" />
    </div>

    {/* Content */}
    <h3 className="text-lg font-bold text-foreground text-center mb-2">
      Delete Reservation?
    </h3>
    <p className="text-muted-foreground text-center mb-6">
      This action cannot be undone. The reservation will be permanently removed.
    </p>

    {/* Actions */}
    <div className="flex gap-3 justify-center">
      <button onClick={onCancel}
              className="border border-border rounded-xl px-6 py-2.5 min-h-[44px]
                         hover:bg-accent">
        Cancel
      </button>
      <button onClick={onConfirm}
              className="bg-red-600 text-white rounded-xl px-6 py-2.5 font-bold
                         min-h-[44px] hover:bg-red-700">
        Delete
      </button>
    </div>
  </div>
</div>
```

### Confirmation Dialog Rules

- Maximum width: `max-w-md` (448px)
- Always has an icon indicating severity (red for destructive, amber for warning)
- Maximum 2 lines of description text
- Always 2 buttons: Cancel (outline) + Confirm (colored)
- Destructive confirm button uses `bg-red-600`
- Non-destructive confirm button uses primary gradient

---

## Quick View Popup

Lightweight preview for eye-icon hover/click. Not for editing.

```tsx
// Triggered by eye icon on table row or card
<button
  onClick={() => setQuickView(item)}
  className="w-9 h-9 flex items-center justify-center rounded-lg
             hover:bg-accent transition-colors"
  aria-label="Quick view"
>
  <Eye className="w-4 h-4 text-muted-foreground" />
</button>

// Quick view popover
<div className="absolute left-0 top-full mt-2 w-80 bg-card rounded-[20px]
                shadow-2xl border border-border p-4 z-30">
  <div className="flex items-center gap-3 mb-3">
    <h4 className="font-bold text-foreground">Guest Name</h4>
    <span className="bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5
                     text-xs font-bold">
      Confirmed
    </span>
  </div>
  <div className="space-y-2 text-sm text-muted-foreground">
    <p>Check-in: 15 Apr 2026</p>
    <p>Room: Suite 201</p>
    <p>Nights: 3</p>
  </div>
  <button
    onClick={() => openSidePanel(item)}
    className="mt-3 w-full text-center text-primary text-sm font-bold
               hover:underline"
  >
    Open Full Details
  </button>
</div>
```

---

## Keyboard and Accessibility

| Action | Key | Behavior |
|--------|-----|----------|
| Close panel | `Escape` | Closes SidePanel or dialog |
| Close on backdrop | Click backdrop | Closes SidePanel or dialog |
| Focus trap | Tab | Focus stays within open panel |
| Scroll lock | Auto | Body scroll disabled when panel open |

```tsx
// Escape key handler
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', handleEscape)
  return () => document.removeEventListener('keydown', handleEscape)
}, [onClose])

// Body scroll lock
useEffect(() => {
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = '' }
}, [])
```

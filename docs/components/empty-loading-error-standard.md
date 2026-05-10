# Empty, Loading, and Error State Standards

> Sapphire Design System -- Consistent feedback states across all components and pages.

## Empty State

Used when a list, table, or container has no data to display.

### Standard Empty State

```tsx
function EmptyState({
  icon: Icon = SearchX,
  title = "לא נמצאו תוצאות",
  subtitle,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon
        className="h-14 w-14 text-muted-foreground/30 mb-4"
        strokeWidth={1.8}
      />
      <p className="text-lg font-medium text-foreground">
        {title}
      </p>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
                     text-white rounded-xl px-4 py-2.5 min-h-[44px]
                     font-medium text-sm flex items-center gap-2
                     hover:opacity-90 transition-opacity"
        >
          {action.icon && <action.icon className="h-4 w-4" strokeWidth={1.8} />}
          {action.label}
        </button>
      )}
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `LucideIcon` | `SearchX` | Large centered icon |
| `title` | `string` | `"לא נמצאו תוצאות"` | Main message |
| `subtitle` | `string` | `undefined` | Helper text |
| `action` | `{ label: string, onClick: () => void, icon?: LucideIcon }` | `undefined` | CTA button |

### Context-Specific Empty States

```tsx
{/* Table empty */}
<EmptyState
  icon={Table2}
  title="אין הזמנות"
  subtitle="צור הזמנה חדשה כדי להתחיל"
  action={{ label: "הזמנה חדשה", onClick: openCreate, icon: Plus }}
/>

{/* Search empty */}
<EmptyState
  icon={SearchX}
  title="לא נמצאו תוצאות"
  subtitle="נסה לשנות את החיפוש או הסינון"
/>

{/* First use */}
<EmptyState
  icon={Sparkles}
  title="ברוכים הבאים!"
  subtitle="הגדר את החדרים שלך כדי להתחיל"
  action={{ label: "הגדרת חדרים", onClick: goToSettings, icon: Settings }}
/>
```

---

## Loading States

### Full Page Skeleton

Used for initial page load.

```tsx
function PageSkeleton() {
  return (
    <div className="flex-1 px-8 py-6 max-md:px-4 max-md:py-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-accent" />
          <div className="h-4 w-60 rounded-lg bg-accent" />
        </div>
        <div className="h-11 w-32 rounded-xl bg-accent" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-[20px] border border-border/20 p-5 h-[120px]">
            <div className="h-10 w-10 rounded-xl bg-accent mb-3" />
            <div className="h-7 w-16 rounded-lg bg-accent mb-1" />
            <div className="h-4 w-24 rounded-lg bg-accent" />
          </div>
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
```

### Table Skeleton

Matches the column layout of the target table.

```tsx
function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-[20px] border border-border/20 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-3 bg-accent/50">
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="h-4 flex-1 rounded bg-accent" />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-border/10"
        >
          {Array.from({ length: columns }, (_, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-accent"
              style={{ maxWidth: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Card Skeleton

```tsx
function CardSkeleton() {
  return (
    <div className="rounded-[20px] border border-border/20 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-accent" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-32 rounded bg-accent" />
          <div className="h-3 w-24 rounded bg-accent" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-accent" />
        <div className="h-3 w-4/5 rounded bg-accent" />
      </div>
    </div>
  );
}
```

### Inline Spinner

Used next to a triggering element (e.g., save button, refresh link).

```tsx
<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.8} />
```

### Button Loading State

Spinner replaces text, button is disabled during loading.

```tsx
<button
  disabled={isLoading}
  className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
             text-white rounded-xl px-6 py-2.5 min-h-[44px]
             font-medium text-sm transition-opacity
             hover:opacity-90 disabled:opacity-70"
>
  {isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin mx-auto" strokeWidth={1.8} />
  ) : (
    "שמירה"
  )}
</button>
```

### Data Refresh Indicator

Subtle loading indicator for background data refreshes (not initial load).

```tsx
{isRefetching && (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} />
    מעדכן...
  </div>
)}
```

---

## Error States

### Block Error

Full error display for failed data fetches or critical errors.

```tsx
function ErrorState({
  title = "שגיאה בטעינת הנתונים",
  details,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3"
         dir="rtl">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-5 w-5 text-red-500 shrink-0 mt-0.5"
          strokeWidth={1.8}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">{title}</p>
          {details && (
            <p className="text-xs text-red-600 mt-1">{details}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-xs font-medium text-red-700
                         hover:text-red-900 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              נסה שוב
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"שגיאה בטעינת הנתונים"` | Error title |
| `details` | `string` | `undefined` | Technical details or user guidance |
| `onRetry` | `() => void` | `undefined` | Retry callback |

### Inline Field Error

Below form fields (see form-standard.md).

```tsx
<p className="text-[11px] text-destructive text-right">
  {errorMessage}
</p>
```

---

## Toast Notifications (Sonner)

### Configuration

```tsx
// In app/providers.tsx or layout.tsx
import { Toaster } from "sonner";

<Toaster
  position="bottom-left"  // RTL-aware: bottom-left
  dir="rtl"
  toastOptions={{
    className: "rounded-xl text-right",
  }}
/>
```

### Usage

```tsx
import { toast } from "sonner";

// Success
toast.success("ההזמנה נשמרה בהצלחה");

// Error
toast.error("שגיאה בשמירת ההזמנה", {
  description: "נסה שוב מאוחר יותר",
});

// Info
toast.info("ההזמנה עודכנה");

// Loading → Success
const toastId = toast.loading("שומר...");
// After async operation:
toast.success("נשמר בהצלחה", { id: toastId });

// With action
toast("הפריט נמחק", {
  action: {
    label: "ביטול",
    onClick: () => undoDelete(),
  },
});
```

### Toast Variants

| Variant | When to use |
|---------|-------------|
| `toast.success()` | Operation completed successfully |
| `toast.error()` | Operation failed |
| `toast.info()` | Informational notification |
| `toast.loading()` | Long-running operation in progress |
| `toast.warning()` | Warning that needs attention |

---

## State Decision Tree

```
Component loading for first time?
  → Full skeleton (page, table, or card skeleton)

Background data refresh?
  → Subtle refresh indicator (small spinner + text)

Button triggered async action?
  → Button loading state (spinner replaces text)

Data fetched but empty?
  → Empty state with contextual icon + message + optional CTA

Data fetch failed?
  → Error state with retry button

Form field validation failed?
  → Inline error text below field

Operation succeeded?
  → Toast success (bottom-left)

Operation failed?
  → Toast error + optional block error if critical
```

## Do / Don't

| Do | Don't |
|----|-------|
| Skeleton matching target layout | Generic spinner for initial load |
| `animate-pulse` on skeleton elements | Spinning loader for page load |
| `bg-accent` for skeleton color | Gray or transparent skeletons |
| `rounded-[20px]` on skeleton containers | Sharp skeleton containers |
| Empty state centered with icon + text | Just "no data" text |
| Contextual empty state messages | Same generic message everywhere |
| Error with retry button | Error without recovery option |
| Sonner toasts, `bottom-left` position | Alert boxes or custom notifications |
| Button spinner replaces text | Spinner next to button text |
| Disabled button during loading | Active button during loading |
| `text-[11px]` for field errors | Large error messages |
| `opacity-30` on large empty icons | Full opacity empty state icons |

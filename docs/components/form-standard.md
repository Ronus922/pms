# Form Component Standard

> Sapphire Design System -- Structured forms with section cards, Zod validation, and react-hook-form integration.

## Structure Hierarchy

```
SidePanel (edit mode or wizard mode)
  Content area (p-6)
    Form
      Section Card 1
        Section title (h3)
        Field Group (grid)
          Field (label + input + error)
          Field
      Section Card 2
        ...
  Footer (sticky)
    Cancel + Save buttons
```

## Section Card

```tsx
<div className="rounded-[20px] border border-border/20 p-5 bg-card">
  <h3 className="text-sm font-bold text-foreground mb-4">
    פרטים אישיים
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Fields */}
  </div>
</div>
```

## Field Layout

```tsx
{/* Single field wrapper */}
<div className="flex flex-col gap-1.5">
  {/* Label */}
  <label
    htmlFor={fieldId}
    className="text-sm font-bold text-muted-foreground text-right"
  >
    {label}
    {required && <span className="text-destructive mr-1">*</span>}
  </label>

  {/* Input */}
  <input
    id={fieldId}
    {...register(fieldName)}
    className={cn(
      "min-h-[48px] rounded-xl bg-accent px-3 py-2",
      "text-right text-sm border border-transparent",
      "transition-colors duration-200",
      "hover:border-border/40",
      "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
      "placeholder:text-muted-foreground",
      error && "border-destructive focus:ring-destructive/20"
    )}
    dir="rtl"
    placeholder={placeholder}
  />

  {/* Error message */}
  {error && (
    <p className="text-[11px] text-destructive text-right">
      {error.message}
    </p>
  )}
</div>
```

## Responsive Grid

```tsx
{/* 1 column mobile, 2 tablet, 3 desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Field name="firstName" label="שם פרטי" required />
  <Field name="lastName" label="שם משפחה" required />
  <Field name="phone" label="טלפון" />
</div>

{/* Full-width field (spans all columns) */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div className="md:col-span-2 lg:col-span-3">
    <Field name="notes" label="הערות" type="textarea" />
  </div>
</div>
```

## Textarea

```tsx
<textarea
  {...register(fieldName)}
  rows={3}
  className={cn(
    "w-full rounded-xl bg-accent px-3 py-2",
    "text-right text-sm border border-transparent",
    "transition-colors duration-200 resize-none",
    "hover:border-border/40",
    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
    "placeholder:text-muted-foreground",
    error && "border-destructive focus:ring-destructive/20"
  )}
  dir="rtl"
/>
```

## Zod Validation Schema

```ts
import { z } from "zod";

const reservationSchema = z.object({
  guestName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().regex(/^0\d{9}$/, "מספר טלפון לא תקין"),
  checkIn: z.date({ required_error: "נדרש תאריך כניסה" }),
  checkOut: z.date({ required_error: "נדרש תאריך יציאה" }),
  roomId: z.string().min(1, "נדרש לבחור חדר"),
  notes: z.string().max(500, "הערות עד 500 תווים").optional(),
});

type ReservationFormData = z.infer<typeof reservationSchema>;
```

## React Hook Form Integration

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

function ReservationForm({ defaultValues, onSubmit }: Props) {
  const form = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} dir="rtl">
      {/* Section cards with fields */}
    </form>
  );
}
```

## Footer Actions (in SidePanel)

```tsx
<div className="flex items-center gap-3 flex-row-reverse">
  {/* Primary action */}
  <button
    type="submit"
    disabled={isSubmitting || !isDirty}
    className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
               text-white rounded-xl px-6 py-2.5 min-h-[44px]
               font-medium text-sm transition-opacity
               hover:opacity-90 disabled:opacity-50"
  >
    {isSubmitting ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      "שמירה"
    )}
  </button>

  {/* Cancel */}
  <button
    type="button"
    onClick={() => {
      if (isDirty) {
        // Show confirmation
        confirmClose();
      } else {
        onClose();
      }
    }}
    className="rounded-xl px-4 py-2.5 min-h-[44px] text-sm
               border border-border/30 hover:bg-accent transition-colors"
  >
    ביטול
  </button>
</div>
```

## Dirty State Warning

```tsx
// Warn on close if form has unsaved changes
function confirmClose() {
  const confirmed = window.confirm("יש שינויים שלא נשמרו. לצאת בכל זאת?");
  if (confirmed) {
    reset();
    onClose();
  }
}

// Also warn on browser back/refresh
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
    }
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);
```

## Field States

### Normal
```tsx
<input className="bg-accent border-transparent" />
```

### Disabled (locked)
```tsx
<div className="relative">
  <input className="bg-accent/50 border-transparent opacity-70 cursor-not-allowed" disabled />
  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5
                   text-muted-foreground" strokeWidth={1.8} />
</div>
```

### Warning (external field)
```tsx
<div className="relative">
  <input className="bg-amber-50 border-amber-200" />
  <div className="absolute left-3 top-1/2 -translate-y-1/2">
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100
                     text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
      <AlertTriangle className="h-3 w-3" strokeWidth={1.8} />
      חיצוני
    </span>
  </div>
</div>
```

## Multiple Sections Example

```tsx
<div className="flex flex-col gap-6">
  {/* Section 1 */}
  <div className="rounded-[20px] border border-border/20 p-5 bg-card">
    <h3 className="text-sm font-bold text-foreground mb-4">פרטי אורח</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field name="guestName" label="שם מלא" required />
      <Field name="phone" label="טלפון" required />
      <Field name="email" label="אימייל" />
      <Field name="idNumber" label="ת.ז." />
    </div>
  </div>

  {/* Section 2 */}
  <div className="rounded-[20px] border border-border/20 p-5 bg-card">
    <h3 className="text-sm font-bold text-foreground mb-4">פרטי שהייה</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DateField name="checkIn" label="צ'ק-אין" required />
      <DateField name="checkOut" label="צ'ק-אאוט" required />
      <SelectField name="roomId" label="חדר" required options={rooms} />
      <SelectField name="source" label="ערוץ הזמנה" options={sources} />
    </div>
  </div>

  {/* Section 3: Full-width */}
  <div className="rounded-[20px] border border-border/20 p-5 bg-card">
    <h3 className="text-sm font-bold text-foreground mb-4">הערות</h3>
    <TextareaField name="notes" label="הערות פנימיות" />
  </div>
</div>
```

## Do / Don't

| Do | Don't |
|----|-------|
| Section cards with `rounded-[20px]` | Flat dividers between sections |
| `p-5` card padding | No padding on section containers |
| `gap-4` between fields in grid | Margin on individual fields |
| Label above input, `text-sm font-bold` | Labels to the side or inside input |
| Red asterisk for required fields | No required indication |
| Error `text-[11px]` below field | Error in tooltip or alert |
| Zod schema for all validation | Inline validation logic |
| Submit in SidePanel footer (sticky) | Submit button inside form content |
| Dirty state warning before close | Silent close with data loss |
| `min-h-[48px]` on all inputs | Short inputs |
| `bg-accent` input background | White input background |
| `rounded-xl` inputs | `rounded-md` or sharp corners |
| `text-right` and `dir="rtl"` | Left-aligned form fields |
| Responsive grid (1-2-3 cols) | Fixed column layout |

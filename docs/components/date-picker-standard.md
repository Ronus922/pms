# DatePicker Component Standard

> Sapphire Design System -- Calendar date picker with range support, RTL layout, and Hebrew locale.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Date \| null` | `null` | Selected date |
| `onChange` | `(date: Date \| null) => void` | required | Change handler |
| `minDate` | `Date` | `undefined` | Earliest selectable date |
| `maxDate` | `Date` | `undefined` | Latest selectable date |
| `range` | `boolean` | `false` | Enable range selection mode |
| `rangeValue` | `DateRange` | `undefined` | `{ from: Date, to: Date }` |
| `onRangeChange` | `(range: DateRange) => void` | `undefined` | Range change handler |
| `disabled` | `boolean` | `false` | Disable interaction |
| `error` | `string` | `undefined` | Error message |
| `placeholder` | `string` | `"DD/MM/YYYY"` | Placeholder text |
| `label` | `string` | `undefined` | Field label |
| `required` | `boolean` | `false` | Show required asterisk |

### Types

```ts
interface DateRange {
  from: Date | null;
  to: Date | null;
}
```

## Trigger Input

```tsx
<button
  type="button"
  disabled={disabled}
  className={cn(
    "flex items-center gap-2 w-full",
    "min-h-[48px] rounded-xl bg-accent px-3 py-2",
    "text-right text-sm border border-transparent",
    "transition-colors duration-200",
    "hover:border-border/40",
    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
    disabled && "opacity-50 cursor-not-allowed",
    error && "border-destructive focus:ring-destructive/20"
  )}
  dir="rtl"
>
  {/* Calendar icon */}
  <CalendarDays
    className="h-4 w-4 text-muted-foreground shrink-0"
    strokeWidth={1.8}
  />

  {/* Date display */}
  <span className={cn(
    "flex-1 text-right",
    !value && "text-muted-foreground"
  )}>
    {value ? formatDate(value) : placeholder}
  </span>

  {/* Clear button (when value exists) */}
  {value && !disabled && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(null);
      }}
      className="rounded-full p-1 hover:bg-foreground/10
                 min-h-[28px] min-w-[28px] flex items-center justify-center"
    >
      <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
    </button>
  )}
</button>
```

## Calendar Popup

```tsx
<div
  className="absolute z-50 mt-1 rounded-xl bg-popover border border-border/20
             shadow-lg p-4 w-[300px]"
  dir="rtl"
>
  {/* Month / Year navigation */}
  <div className="flex items-center justify-between mb-4">
    <button
      onClick={goToNextMonth}
      className="rounded-lg p-2 hover:bg-accent
                 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
    </button>

    <h3 className="text-sm font-bold">
      {hebrewMonthName} {year}
    </h3>

    <button
      onClick={goToPrevMonth}
      className="rounded-lg p-2 hover:bg-accent
                 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
    </button>
  </div>

  {/* Day headers (RTL: Sun on right) */}
  <div className="grid grid-cols-7 mb-2">
    {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((day) => (
      <div
        key={day}
        className="text-center text-xs font-medium text-muted-foreground py-1"
      >
        {day}
      </div>
    ))}
  </div>

  {/* Days grid */}
  <div className="grid grid-cols-7 gap-0.5">
    {days.map((day) => (
      <button
        key={day.date.toISOString()}
        disabled={day.disabled}
        onClick={() => selectDate(day.date)}
        className={cn(
          "h-9 w-9 rounded-lg text-sm flex items-center justify-center",
          "transition-colors duration-150",
          // Today
          day.isToday && "border border-primary text-primary font-bold",
          // Selected
          day.isSelected && "bg-primary text-white font-bold",
          // In range (range mode)
          day.inRange && "bg-primary/10",
          // Range start/end
          day.isRangeStart && "rounded-r-lg rounded-l-none bg-primary text-white",
          day.isRangeEnd && "rounded-l-lg rounded-r-none bg-primary text-white",
          // Disabled
          day.disabled && "opacity-30 cursor-not-allowed",
          // Other month
          day.isOtherMonth && "text-muted-foreground/40",
          // Hover
          !day.disabled && !day.isSelected && "hover:bg-accent"
        )}
      >
        {day.date.getDate()}
      </button>
    ))}
  </div>

  {/* Quick actions */}
  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
    <button
      onClick={() => selectDate(new Date())}
      className="text-xs text-primary hover:underline"
    >
      היום
    </button>
    <button
      onClick={() => onChange(null)}
      className="text-xs text-muted-foreground hover:underline"
    >
      נקה
    </button>
  </div>
</div>
```

## Range Mode

```tsx
// Range selection state machine:
// 1. No selection → click sets "from"
// 2. "from" set → click sets "to" (if after "from")
// 3. Both set → click resets and sets new "from"

// Visual range highlight on days between from and to:
day.inRange = day.date > rangeValue.from && day.date < rangeValue.to;

// Hover preview: show tentative range while hovering
day.inTentativeRange = hoveredDate
  && rangeValue.from
  && !rangeValue.to
  && day.date > rangeValue.from
  && day.date <= hoveredDate;
```

### Range Trigger Display

```tsx
<span>
  {rangeValue.from && rangeValue.to
    ? `${formatDate(rangeValue.from)} - ${formatDate(rangeValue.to)}`
    : rangeValue.from
      ? `${formatDate(rangeValue.from)} - ...`
      : placeholder}
</span>
```

## Date Format

```ts
// Hebrew locale format: DD/MM/YYYY
function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Display format for headers
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });
}
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open calendar / select focused day |
| `Escape` | Close calendar |
| `ArrowRight` | Previous day (RTL) |
| `ArrowLeft` | Next day (RTL) |
| `ArrowUp` | Same day, previous week |
| `ArrowDown` | Same day, next week |
| `PageUp` | Previous month |
| `PageDown` | Next month |

## Mobile Behavior

```tsx
// On mobile (< md breakpoint):
// Option A: Use native date input
<input
  type="date"
  value={value?.toISOString().split("T")[0]}
  onChange={(e) => onChange(new Date(e.target.value))}
  min={minDate?.toISOString().split("T")[0]}
  max={maxDate?.toISOString().split("T")[0]}
  className="min-h-[48px] rounded-xl bg-accent px-3 py-2 w-full text-right"
/>

// Option B: Bottom sheet calendar (preferred for range mode)
// Full-width calendar in a bottom sheet with drag handle
```

## Do / Don't

| Do | Don't |
|----|-------|
| `DD/MM/YYYY` format for Hebrew | `MM/DD/YYYY` American format |
| Hebrew day abbreviations (א, ב, ג...) | English day names |
| RTL calendar grid (Sunday on right) | LTR calendar grid |
| `rounded-xl` popup | Sharp corners |
| `min-h-[48px]` trigger | Short trigger |
| Highlight today with border | No today indicator |
| Range preview on hover | No visual feedback during range selection |
| Quick "today" action | No quick navigation |
| Native input on mobile (single date) | Custom calendar that's hard to use on mobile |
| Disable dates outside min/max | Allow invalid dates |
| `shadow-lg` on popup | Flat popup without shadow |

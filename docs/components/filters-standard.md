# FilterBar Component Standard

> Sapphire Design System -- Unified filter bar with URL state sync and responsive layout.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filters` | `FilterConfig[]` | required | Filter definitions |
| `values` | `Record<string, FilterValue>` | required | Current filter values |
| `onChange` | `(key: string, value: FilterValue) => void` | required | Value change handler |
| `onReset` | `() => void` | required | Clear all filters |
| `resultCount` | `number` | `undefined` | Total results to display |

### FilterConfig Type

```ts
type FilterType = "select" | "date-range" | "search" | "toggle" | "multi-select";

interface FilterConfig {
  key: string;
  type: FilterType;
  label: string;
  placeholder?: string;
  options?: SelectOption[];    // for select / multi-select
  defaultValue?: FilterValue;
}

type FilterValue = string | string[] | DateRange | boolean | null;
```

## Layout

```tsx
<div className="flex flex-wrap items-center gap-3" dir="rtl">
  {/* Filters */}
  {filters.map((filter) => (
    <FilterItem key={filter.key} config={filter} value={values[filter.key]} />
  ))}

  {/* Result count */}
  {resultCount !== undefined && (
    <span className="text-sm text-muted-foreground mr-auto">
      {resultCount} תוצאות
    </span>
  )}

  {/* Reset button */}
  {hasActiveFilters && (
    <button
      onClick={onReset}
      className="text-sm text-muted-foreground hover:text-foreground
                 flex items-center gap-1 transition-colors"
    >
      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
      נקה הכל
    </button>
  )}
</div>
```

## Filter Types

### 1. Select Filter

```tsx
<div className="relative">
  <button
    onClick={() => setOpen(!open)}
    className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2",
      "min-h-[44px] text-sm border transition-colors",
      hasValue
        ? "bg-primary/10 border-primary/30 text-primary font-medium"
        : "bg-accent border-transparent hover:border-border/40"
    )}
  >
    <span>{hasValue ? selectedLabel : filter.label}</span>
    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
  </button>

  {/* Dropdown - same as select-standard.md */}
</div>
```

### 2. Date Range Filter

```tsx
<button
  onClick={() => setOpen(!open)}
  className={cn(
    "flex items-center gap-2 rounded-xl px-3 py-2",
    "min-h-[44px] text-sm border transition-colors",
    hasValue
      ? "bg-primary/10 border-primary/30 text-primary font-medium"
      : "bg-accent border-transparent hover:border-border/40"
  )}
>
  <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
  <span>
    {hasValue
      ? `${formatDate(value.from)} - ${formatDate(value.to)}`
      : "תאריכים"}
  </span>
</button>

{/* Opens date range picker popup */}
```

### 3. Search Text Filter

```tsx
<div className="relative">
  <Search
    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4
               text-muted-foreground pointer-events-none"
    strokeWidth={1.8}
  />
  <input
    type="text"
    placeholder={filter.placeholder || "חיפוש..."}
    value={searchValue}
    onChange={(e) => setSearchValue(e.target.value)}
    className="rounded-xl bg-accent px-3 py-2 pr-9 text-right text-sm
               min-h-[44px] min-w-[200px] border border-transparent
               hover:border-border/40
               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
               placeholder:text-muted-foreground"
    dir="rtl"
  />
  {/* Clear X when has value */}
  {searchValue && (
    <button
      onClick={() => {
        setSearchValue("");
        onChange(filter.key, "");
      }}
      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-0.5
                 hover:bg-foreground/10 min-h-[28px] min-w-[28px]
                 flex items-center justify-center"
    >
      <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
    </button>
  )}
</div>
```

### 4. Toggle Filter

```tsx
<button
  onClick={() => onChange(filter.key, !value)}
  className={cn(
    "flex items-center gap-2 rounded-xl px-3 py-2",
    "min-h-[44px] text-sm border transition-colors",
    value
      ? "bg-primary/10 border-primary/30 text-primary font-medium"
      : "bg-accent border-transparent hover:border-border/40"
  )}
>
  <span>{filter.label}</span>
</button>
```

### 5. Multi-Select Filter

```tsx
<button
  onClick={() => setOpen(!open)}
  className={cn(
    "flex items-center gap-2 rounded-xl px-3 py-2",
    "min-h-[44px] text-sm border transition-colors",
    hasValue
      ? "bg-primary/10 border-primary/30 text-primary font-medium"
      : "bg-accent border-transparent hover:border-border/40"
  )}
>
  <span>
    {hasValue
      ? `${filter.label} (${selectedValues.length})`
      : filter.label}
  </span>
  <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
</button>

{/* Dropdown with checkboxes - see select-standard.md multi-select */}
```

## Active Filter Styling

All filter types share the same active/inactive visual pattern:

```tsx
// Inactive (no value selected)
"bg-accent border-transparent hover:border-border/40"

// Active (value selected)
"bg-primary/10 border-primary/30 text-primary font-medium"
```

## URL State Sync (nuqs)

```tsx
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";

function useFilterState(filters: FilterConfig[]) {
  // Each filter syncs to a URL param
  const [status, setStatus] = useQueryState("status", parseAsString);
  const [search, setSearch] = useQueryState("search", parseAsString);
  const [sources, setSources] = useQueryState(
    "sources",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const values = { status, search, sources };

  const onChange = (key: string, value: FilterValue) => {
    // Update the corresponding URL param
    switch (key) {
      case "status": setStatus(value as string); break;
      case "search": setSearch(value as string); break;
      case "sources": setSources(value as string[]); break;
    }
  };

  const onReset = () => {
    setStatus(null);
    setSearch(null);
    setSources([]);
  };

  const hasActiveFilters = Object.values(values).some(
    (v) => v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)
  );

  return { values, onChange, onReset, hasActiveFilters };
}
```

## Search Debounce

```tsx
import { useDebouncedCallback } from "use-debounce";

// Debounce search input to avoid excessive filtering
const debouncedSearch = useDebouncedCallback((value: string) => {
  onChange("search", value);
}, 300);

// In search input onChange:
onChange={(e) => {
  setSearchValue(e.target.value);  // Update UI immediately
  debouncedSearch(e.target.value); // Debounce actual filter
}}
```

## Mobile Layout

```tsx
{/* Mobile: collapsible filter section */}
<div className="md:hidden">
  <button
    onClick={() => setFiltersOpen(!filtersOpen)}
    className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2
               min-h-[44px] text-sm w-full justify-between"
  >
    <div className="flex items-center gap-2">
      <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
      <span>סינון</span>
    </div>
    {hasActiveFilters && (
      <span className="rounded-full bg-primary text-white text-xs
                       px-2 py-0.5 font-medium">
        {activeFilterCount}
      </span>
    )}
  </button>

  {filtersOpen && (
    <div className="flex flex-col gap-3 mt-3 p-4 rounded-[20px]
                    border border-border/20 bg-card">
      {/* Full-width filter items stacked vertically */}
      {filters.map((filter) => (
        <div key={filter.key} className="w-full">
          <FilterItem config={filter} value={values[filter.key]} fullWidth />
        </div>
      ))}
    </div>
  )}
</div>

{/* Desktop: horizontal flex wrap */}
<div className="hidden md:flex flex-wrap items-center gap-3" dir="rtl">
  {/* ... standard horizontal layout */}
</div>
```

## Filter Configuration Example

```tsx
const filterConfig: FilterConfig[] = [
  {
    key: "search",
    type: "search",
    label: "חיפוש",
    placeholder: "שם אורח, מספר הזמנה...",
  },
  {
    key: "status",
    type: "select",
    label: "סטטוס",
    options: [
      { value: "confirmed", label: "מאושר" },
      { value: "pending", label: "ממתין" },
      { value: "cancelled", label: "מבוטל" },
      { value: "checked_in", label: "צ'ק-אין" },
    ],
  },
  {
    key: "dates",
    type: "date-range",
    label: "תאריכים",
  },
  {
    key: "source",
    type: "multi-select",
    label: "ערוץ",
    options: [
      { value: "direct", label: "ישיר" },
      { value: "booking", label: "Booking.com" },
      { value: "airbnb", label: "Airbnb" },
    ],
  },
  {
    key: "hasBalance",
    type: "toggle",
    label: "יתרה פתוחה",
  },
];
```

## Do / Don't

| Do | Don't |
|----|-------|
| `flex flex-wrap gap-3` layout | Fixed grid for filters |
| `rounded-xl` on all filter triggers | Square or rounded-md |
| `min-h-[44px]` touch targets | Small filter buttons |
| Active state: `bg-primary/10` | No visual distinction for active filters |
| URL sync with nuqs | Local state only |
| 300ms debounce on search | No debounce (fires on every keystroke) |
| "Clear all" reset button | No way to reset filters |
| Result count display | No feedback on filter effect |
| Collapsible on mobile | Horizontal scroll on mobile |
| Filters below page header | Filters inside the table or in a sidebar |

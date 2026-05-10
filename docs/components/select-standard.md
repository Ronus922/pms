# Select / Combobox Component Standard

> Sapphire Design System -- Unified select component with search, multi-select, and RTL support.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `SelectOption[]` | required | List of options |
| `value` | `string \| string[]` | `undefined` | Selected value(s) |
| `onChange` | `(value: string \| string[]) => void` | required | Change handler |
| `placeholder` | `string` | `"בחר..."` | Placeholder text |
| `searchable` | `boolean \| "auto"` | `"auto"` | Enable search (auto = >10 items) |
| `multiple` | `boolean` | `false` | Allow multiple selection |
| `disabled` | `boolean` | `false` | Disable interaction |
| `error` | `string` | `undefined` | Error message |
| `label` | `string` | `undefined` | Field label |
| `required` | `boolean` | `false` | Show required asterisk |

### SelectOption Type

```ts
interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
  disabled?: boolean;
  group?: string;
}
```

## Trigger Button

```tsx
<button
  type="button"
  role="combobox"
  aria-expanded={open}
  aria-haspopup="listbox"
  disabled={disabled}
  className={cn(
    "flex items-center justify-between w-full",
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
  {/* Value or placeholder */}
  <span className={cn(
    "flex-1 text-right truncate",
    !value && "text-muted-foreground"
  )}>
    {displayValue || placeholder}
  </span>

  {/* Chevron on left side (RTL) */}
  <ChevronsUpDown
    className="h-4 w-4 text-muted-foreground shrink-0 mr-2"
    strokeWidth={1.8}
  />
</button>
```

## Multi-Select Trigger (with chips)

```tsx
<div
  className={cn(
    "flex flex-wrap gap-1.5 items-center w-full",
    "min-h-[48px] rounded-xl bg-accent px-3 py-2",
    "border border-transparent cursor-pointer",
    error && "border-destructive"
  )}
  dir="rtl"
>
  {selectedItems.map((item) => (
    <span
      key={item.value}
      className="inline-flex items-center gap-1 rounded-lg bg-primary/10
                 text-primary px-2 py-0.5 text-xs font-medium"
    >
      {item.label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeItem(item.value);
        }}
        className="rounded-full p-0.5 hover:bg-primary/20
                   min-h-[20px] min-w-[20px] flex items-center justify-center"
      >
        <X className="h-3 w-3" strokeWidth={1.8} />
      </button>
    </span>
  ))}
  {selectedItems.length === 0 && (
    <span className="text-muted-foreground text-sm">{placeholder}</span>
  )}
</div>
```

## Dropdown

```tsx
<div
  role="listbox"
  className={cn(
    "absolute z-50 mt-1 w-full",
    "rounded-xl bg-popover border border-border/20 shadow-lg",
    "max-h-[280px] overflow-hidden",
    "animate-in fade-in-0 zoom-in-95 duration-150"
  )}
  dir="rtl"
>
  {/* Search input (when searchable) */}
  {searchable && (
    <div className="p-2 border-b border-border/20">
      <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        <input
          type="text"
          placeholder="חיפוש..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-right
                     outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
    </div>
  )}

  {/* Options list */}
  <div className="overflow-y-auto max-h-[240px] p-1">
    {filteredOptions.map((option) => (
      <button
        key={option.value}
        role="option"
        aria-selected={isSelected(option.value)}
        disabled={option.disabled}
        onClick={() => selectOption(option.value)}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg",
          "py-2.5 px-3 text-right text-sm",
          "min-h-[44px] transition-colors",
          "hover:bg-accent focus:bg-accent",
          isSelected(option.value) && "bg-primary/5 text-primary font-medium",
          option.disabled && "opacity-30 cursor-not-allowed"
        )}
      >
        {/* Check mark for selected */}
        {multiple && (
          <div className={cn(
            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
            isSelected(option.value)
              ? "bg-primary border-primary text-white"
              : "border-border"
          )}>
            {isSelected(option.value) && <Check className="h-3 w-3" />}
          </div>
        )}

        {/* Option content */}
        {option.icon && <option.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />}
        <div className="flex-1 text-right">
          <span>{option.label}</span>
          {option.description && (
            <p className="text-xs text-muted-foreground">{option.description}</p>
          )}
        </div>

        {/* Single select check */}
        {!multiple && isSelected(option.value) && (
          <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={1.8} />
        )}
      </button>
    ))}
  </div>

  {/* Empty search result */}
  {filteredOptions.length === 0 && (
    <div className="py-6 text-center text-sm text-muted-foreground">
      לא נמצאו תוצאות
    </div>
  )}
</div>
```

## Auto-Search Threshold

```tsx
// Auto-enable search when options exceed threshold
const isSearchable = searchable === "auto"
  ? options.length > 10
  : searchable;
```

## Grouped Options

```tsx
{/* Group options by category */}
{Object.entries(groupedOptions).map(([group, items]) => (
  <div key={group}>
    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground
                    uppercase tracking-wider">
      {group}
    </div>
    {items.map((option) => (
      <OptionItem key={option.value} option={option} />
    ))}
  </div>
))}
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open dropdown / select focused option |
| `Escape` | Close dropdown |
| `ArrowDown` | Focus next option |
| `ArrowUp` | Focus previous option |
| `Home` | Focus first option |
| `End` | Focus last option |
| Type characters | Jump to matching option (non-searchable mode) |

## Error State

```tsx
{/* Error message below field */}
{error && (
  <p className="text-[11px] text-destructive mt-1 text-right">
    {error}
  </p>
)}
```

## Do / Don't

| Do | Don't |
|----|-------|
| `min-h-[48px]` on trigger | Short trigger button |
| `rounded-xl` on trigger and dropdown | Square or rounded-md |
| `bg-accent` trigger background | White/transparent background |
| Search auto-enabled for >10 items | No search on long lists |
| Chips for multi-select values | Comma-separated text |
| `min-h-[44px]` per option row | Small cramped options |
| `text-right` and chevron on left | Left-aligned text |
| `shadow-lg` on dropdown | No shadow (flat dropdown) |
| Smooth enter animation | No animation on open |
| Grouped options when logical | Flat list when groups exist |

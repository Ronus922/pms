# Sapphire Design System -- Tables

## Container

Tables are wrapped in a card container with rounded corners and shadow.

```tsx
<div className="bg-card rounded-[20px] border border-border shadow-sm overflow-hidden">
  <table className="w-full">
    ...
  </table>
</div>
```

---

## Table Header

```tsx
<thead>
  <tr className="bg-accent/50 border-b border-border">
    <th className="text-sm font-bold text-muted-foreground px-4 py-3 text-right">
      Column Name
    </th>
  </tr>
</thead>
```

| Property | Value |
|----------|-------|
| Background | `bg-accent/50` |
| Text | `text-sm font-bold text-muted-foreground` |
| Padding | `px-4 py-3` |
| Position | `sticky top-0 z-10` (when table scrolls) |
| Border | `border-b border-border` |
| Alignment | `text-right` (RTL default) |

### Sortable Header

```tsx
<th
  onClick={() => toggleSort('column')}
  className="text-sm font-bold text-muted-foreground px-4 py-3 text-right
             cursor-pointer hover:text-foreground transition-colors select-none"
>
  <span className="flex items-center gap-1.5">
    Column Name
    {sortColumn === 'column' && (
      sortDirection === 'asc'
        ? <ChevronUp className="w-3.5 h-3.5" />
        : <ChevronDown className="w-3.5 h-3.5" />
    )}
  </span>
</th>
```

---

## Table Rows

```tsx
<tbody>
  <tr className="border-b border-border/10 hover:bg-accent/30 transition-colors
                 cursor-pointer"
      onClick={() => openSidePanel(row)}>
    <td className="px-4 py-3 text-base text-foreground">
      Cell content
    </td>
  </tr>
</tbody>
```

| Property | Value |
|----------|-------|
| Border | `border-b border-border/10` |
| Hover | `hover:bg-accent/30` |
| Transition | `transition-colors` |
| Cell Padding | `px-4 py-3` |
| Cell Text | `text-base text-foreground` |
| Click | Opens SidePanel with full details |

### Row with Status Border

```tsx
<tr className="border-b border-border/10 hover:bg-accent/30 cursor-pointer">
  {/* Status indicator -- first cell has colored left border */}
  <td className="px-4 py-3 border-r-4 border-emerald-500">
    <span className="font-bold">Guest Name</span>
  </td>
  <td className="px-4 py-3">Room 201</td>
  <td className="px-4 py-3">15 Apr - 18 Apr</td>
  <td className="px-4 py-3">
    <span className="bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5
                     text-xs font-bold">
      Confirmed
    </span>
  </td>
</tr>
```

---

## Selection

### Checkbox Column

```tsx
// Header checkbox (select all)
<th className="w-12 px-4 py-3">
  <input
    type="checkbox"
    checked={allSelected}
    onChange={toggleSelectAll}
    className="w-5 h-5 rounded border-border text-primary
               focus:ring-2 focus:ring-primary/20"
  />
</th>

// Row checkbox
<td className="w-12 px-4 py-3">
  <input
    type="checkbox"
    checked={isSelected}
    onChange={() => toggleSelect(row.id)}
    className="w-5 h-5 rounded border-border text-primary
               focus:ring-2 focus:ring-primary/20"
  />
</td>
```

### Bulk Actions Bar

Appears above the table when rows are selected.

```tsx
{selectedCount > 0 && (
  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3
                  flex items-center justify-between mb-3">
    <span className="text-sm font-bold text-primary">
      {selectedCount} selected
    </span>
    <div className="flex gap-2">
      <button className="text-sm font-bold text-foreground hover:text-primary
                         px-3 py-1.5 rounded-lg hover:bg-accent">
        Export
      </button>
      <button className="text-sm font-bold text-red-600 hover:text-red-700
                         px-3 py-1.5 rounded-lg hover:bg-red-50">
        Delete
      </button>
    </div>
  </div>
)}
```

---

## Filter Chips

Displayed above the table, below the page header.

```tsx
<div className="flex flex-wrap gap-2 mb-4">
  {/* Active filter */}
  <button className="bg-primary/10 text-primary border border-primary/20
                     rounded-full px-3 py-1.5 text-sm font-bold
                     flex items-center gap-1.5">
    Status: Confirmed
    <X className="w-3.5 h-3.5" />
  </button>

  {/* Inactive filter */}
  <button className="bg-accent text-muted-foreground border border-border
                     rounded-full px-3 py-1.5 text-sm font-bold
                     hover:bg-accent/80">
    + Add Filter
  </button>

  {/* Clear all */}
  {hasFilters && (
    <button className="text-sm text-muted-foreground hover:text-foreground
                       underline px-2">
      Clear All
    </button>
  )}
</div>
```

---

## Empty State

```tsx
<div className="bg-card rounded-[20px] border border-border shadow-sm p-12">
  <div className="flex flex-col items-center justify-center text-center">
    <Inbox className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
    <h3 className="text-lg font-bold text-foreground mb-1">
      No reservations found
    </h3>
    <p className="text-muted-foreground text-sm mb-6 max-w-sm">
      There are no reservations matching your filters. Try adjusting your search criteria.
    </p>
    <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                       rounded-xl px-6 py-2.5 font-bold min-h-[44px]">
      Create Reservation
    </button>
  </div>
</div>
```

---

## Loading Skeleton

```tsx
<div className="bg-card rounded-[20px] border border-border shadow-sm overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="bg-accent/50 border-b border-border">
        {columns.map((_, i) => (
          <th key={i} className="px-4 py-3">
            <div className="h-4 w-20 bg-accent rounded animate-pulse" />
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-border/10">
          {columns.map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <div className="h-4 w-full bg-accent rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Pagination

```tsx
<div className="flex items-center justify-between px-4 py-3 border-t border-border">
  {/* Page info */}
  <span className="text-sm text-muted-foreground">
    Showing {from}-{to} of {total}
  </span>

  {/* Page controls */}
  <div className="flex items-center gap-1">
    <button
      disabled={page === 1}
      onClick={() => setPage(page - 1)}
      className="w-9 h-9 flex items-center justify-center rounded-lg
                 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ChevronRight className="w-4 h-4" /> {/* RTL: right = previous */}
    </button>

    {pageNumbers.map(num => (
      <button
        key={num}
        onClick={() => setPage(num)}
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold",
          num === page
            ? "bg-primary text-white"
            : "hover:bg-accent text-muted-foreground"
        )}
      >
        {num}
      </button>
    ))}

    <button
      disabled={page === totalPages}
      onClick={() => setPage(page + 1)}
      className="w-9 h-9 flex items-center justify-center rounded-lg
                 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ChevronLeft className="w-4 h-4" /> {/* RTL: left = next */}
    </button>
  </div>

  {/* Per page */}
  <select className="bg-accent border border-border/40 rounded-lg px-3 py-1.5
                     text-sm min-h-[36px]">
    <option value={10}>10 per page</option>
    <option value={25}>25 per page</option>
    <option value={50}>50 per page</option>
  </select>
</div>
```

---

## Mobile: Card View

On mobile, tables collapse into card layouts.

```tsx
{/* Desktop: table */}
<div className="hidden lg:block">
  <table>...</table>
</div>

{/* Mobile: cards */}
<div className="lg:hidden space-y-3">
  {rows.map(row => (
    <div
      key={row.id}
      onClick={() => openSidePanel(row)}
      className="bg-card rounded-[20px] border border-border p-4 shadow-sm
                 border-r-4 border-r-emerald-500 cursor-pointer
                 active:bg-accent/30"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-foreground">{row.guestName}</span>
        <span className="bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5
                         text-xs font-bold">
          {row.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>Room {row.room}</span>
        <span>{row.dates}</span>
        <span className="font-mono" dir="ltr">{row.total} NIS</span>
      </div>
    </div>
  ))}
</div>
```

---

## Mobile: Horizontal Scroll with Frozen Column

Alternative mobile pattern when full table data is needed.

```tsx
<div className="relative overflow-x-auto rounded-[20px] border border-border">
  <table className="w-full min-w-[800px]">
    <thead>
      <tr className="bg-accent/50">
        {/* Frozen first column */}
        <th className="sticky right-0 z-20 bg-accent px-4 py-3 text-sm font-bold
                       text-muted-foreground shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
          Guest
        </th>
        <th className="px-4 py-3 text-sm font-bold text-muted-foreground">Room</th>
        <th className="px-4 py-3 text-sm font-bold text-muted-foreground">Dates</th>
        <th className="px-4 py-3 text-sm font-bold text-muted-foreground">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border/10">
        <td className="sticky right-0 z-10 bg-card px-4 py-3 font-bold
                       shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
          Guest Name
        </td>
        <td className="px-4 py-3">201</td>
        <td className="px-4 py-3">15-18 Apr</td>
        <td className="px-4 py-3">Confirmed</td>
      </tr>
    </tbody>
  </table>
</div>
```

Note: Frozen column uses `sticky right-0` because of RTL layout (first column is on the right).

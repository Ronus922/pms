# DataTable Component Standard

> Sapphire Design System -- Headless table built on @tanstack/react-table with RTL-first layout.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef<T>[]` | required | TanStack column definitions |
| `data` | `T[]` | required | Row data array |
| `loading` | `boolean` | `false` | Show skeleton loading state |
| `emptyState` | `ReactNode` | default | Custom empty state component |
| `onRowClick` | `(row: T) => void` | `undefined` | Row click handler (opens SidePanel) |
| `selectable` | `boolean` | `false` | Enable row checkboxes |
| `pagination` | `PaginationConfig` | `undefined` | Pagination settings |
| `filters` | `FilterConfig[]` | `undefined` | External filter configuration |
| `sorting` | `"client" \| "server"` | `"client"` | Sorting strategy |
| `pageSize` | `number` | `25` | Rows per page |

## Container Structure

```tsx
<div className="rounded-[20px] border border-border/20 bg-card shadow-sm overflow-hidden">
  {/* Table */}
  <div className="overflow-x-auto">
    <table className="w-full text-right" dir="rtl">
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </div>
  {/* Pagination footer */}
  <div className="border-t border-border/20 px-4 py-3">...</div>
</div>
```

## Header Row

```tsx
<thead>
  <tr className="border-b border-border/20">
    {columns.map((col) => (
      <th
        key={col.id}
        className="sticky top-0 bg-accent/50 px-4 py-3
                   text-right text-xs font-semibold text-muted-foreground
                   select-none"
        onClick={() => col.sortable && toggleSort(col.id)}
      >
        <div className="flex items-center gap-1.5">
          <span>{col.header}</span>
          {col.sortable && (
            <SortIndicator direction={getSortDirection(col.id)} />
          )}
        </div>
      </th>
    ))}
  </tr>
</thead>
```

### Sort Indicator

```tsx
function SortIndicator({ direction }: { direction: "asc" | "desc" | false }) {
  return (
    <span className="text-muted-foreground/50">
      {direction === "asc" && <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} />}
      {direction === "desc" && <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />}
      {!direction && <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />}
    </span>
  );
}
```

## Data Rows

```tsx
<tbody>
  {rows.map((row) => (
    <tr
      key={row.id}
      className={cn(
        "border-b border-border/10 transition-colors",
        "hover:bg-accent/30",
        onRowClick && "cursor-pointer",
        row.getIsSelected() && "bg-primary/5"
      )}
      onClick={() => onRowClick?.(row.original)}
    >
      {/* Optional checkbox */}
      {selectable && (
        <td className="px-4 py-3 w-12">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={row.toggleSelected}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          />
        </td>
      )}
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-3 text-sm">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  ))}
</tbody>
```

## Cell Minimum Padding

All cells must have at minimum `px-4 py-3`. Never reduce below this.

## Empty State

```tsx
{data.length === 0 && !loading && (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <SearchX className="h-12 w-12 text-muted-foreground/30 mb-4" strokeWidth={1.8} />
    <p className="text-lg font-medium text-foreground">
      לא נמצאו תוצאות
    </p>
    <p className="text-sm text-muted-foreground mt-1">
      נסה לשנות את הסינון או לחפש מחדש
    </p>
  </div>
)}
```

## Loading Skeleton

```tsx
{loading && (
  <tbody>
    {Array.from({ length: pageSize }, (_, i) => (
      <tr key={i} className="border-b border-border/10">
        {columns.map((col, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-accent" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)}
```

## Pagination Footer

```tsx
<div className="flex items-center justify-between border-t border-border/20
                bg-accent/20 px-4 py-3 text-sm text-muted-foreground"
     dir="rtl">
  {/* Info */}
  <span>
    מציג {startRow}-{endRow} מתוך {totalRows}
  </span>

  {/* Navigation */}
  <div className="flex items-center gap-2">
    <button
      onClick={() => table.previousPage()}
      disabled={!table.getCanPreviousPage()}
      className="rounded-lg p-2 hover:bg-accent disabled:opacity-30
                 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
    </button>
    <span className="px-2">
      עמוד {currentPage} מתוך {totalPages}
    </span>
    <button
      onClick={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
      className="rounded-lg p-2 hover:bg-accent disabled:opacity-30
                 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
    </button>
  </div>
</div>
```

## Bulk Actions Bar

```tsx
{selectedCount > 0 && (
  <div className="sticky top-0 z-10 flex items-center gap-3 bg-primary/10
                  border-b border-primary/20 px-4 py-3 text-sm"
       dir="rtl">
    <span className="font-medium">
      {selectedCount} שורות נבחרו
    </span>
    <div className="flex items-center gap-2 mr-auto">
      <Button variant="outline" size="sm">ייצוא</Button>
      <Button variant="destructive" size="sm">מחיקה</Button>
    </div>
  </div>
)}
```

## Mobile: Card View Alternative

```tsx
{/* Detect screen size */}
{isMobile ? (
  <div className="grid grid-cols-1 gap-3 p-4">
    {rows.map((row) => (
      <div
        key={row.id}
        className="rounded-[20px] border border-border/20 bg-card p-4
                   shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onRowClick?.(row.original)}
      >
        {/* Card content with key fields */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold">{row.original.name}</span>
          <StatusBadge status={row.original.status} />
        </div>
        <div className="text-sm text-muted-foreground">
          {/* Additional fields */}
        </div>
      </div>
    ))}
  </div>
) : (
  <table>...</table>
)}
```

## Sorting Strategy

| Data Size | Strategy | Implementation |
|-----------|----------|----------------|
| < 500 rows | Client-side | TanStack built-in sorting |
| > 500 rows | Server-side | Pass sort params to server action |
| Mixed | Client + server | Client for loaded data, server for full dataset |

## Do / Don't

| Do | Don't |
|----|-------|
| `rounded-[20px]` container | Sharp corners on table card |
| `px-4 py-3` minimum cell padding | Cramped cells with small padding |
| Sticky header row | Header scrolls away |
| Skeleton matching column layout | Generic spinner for loading |
| Empty state centered in container | Empty state outside table |
| Card view on mobile | Horizontal scroll on mobile |
| External filter bar above table | Inline filter inputs in header |
| Row click opens SidePanel | Row click opens new page |
| `text-right` and `dir="rtl"` | Left-aligned text |
| Chevron icons for RTL pagination | Arrow icons pointing wrong way |

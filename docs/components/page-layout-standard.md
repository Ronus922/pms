# Page Layout Standard

> Sapphire Design System -- Consistent page structure for all dashboard pages.

## Page Structure

```
AppShell (sidebar + main)
  Main content area
    Page wrapper (px-8 py-6)
      Page header (title + actions)
      KPI row (optional)
      Filter bar (optional)
      Content area (table or cards)
    SidePanel (overlays on top when open)
```

## Page Wrapper

```tsx
<div className="flex-1 px-8 py-6 max-md:px-4 max-md:py-4" dir="rtl">
  <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
    {/* Page Header */}
    {/* KPI Row */}
    {/* Filter Bar */}
    {/* Content */}
  </div>
</div>
```

## Page Header

```tsx
<div className="flex items-center justify-between">
  {/* Title area (right side in RTL) */}
  <div>
    <h1 className="text-2xl font-bold text-foreground">
      הזמנות
    </h1>
    <p className="text-sm text-muted-foreground mt-0.5">
      ניהול הזמנות ואורחים
    </p>
  </div>

  {/* Actions (left side in RTL) */}
  <div className="flex items-center gap-3">
    <button
      className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5]
                 text-white rounded-xl px-4 py-2.5 min-h-[44px]
                 font-medium text-sm flex items-center gap-2
                 hover:opacity-90 transition-opacity"
    >
      <Plus className="h-4 w-4" strokeWidth={1.8} />
      הזמנה חדשה
    </button>
  </div>
</div>
```

## KPI Row

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <KpiCard
    label="הזמנות היום"
    value={12}
    icon={CalendarCheck}
    trend={{ value: 8, direction: "up" }}
  />
  <KpiCard
    label="תפוסה"
    value="87%"
    icon={BedDouble}
  />
  <KpiCard
    label="צ'ק-אין היום"
    value={5}
    icon={LogIn}
  />
  <KpiCard
    label="צ'ק-אאוט היום"
    value={3}
    icon={LogOut}
  />
</div>
```

### KPI Card Component

```tsx
function KpiCard({ label, value, icon: Icon, trend }: KpiCardProps) {
  return (
    <div className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            trend.direction === "up" ? "text-emerald-600" : "text-red-500"
          )}>
            {trend.direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
```

## Filter Bar Placement

```tsx
{/* Between header and content */}
<div className="flex flex-wrap items-center gap-3">
  {/* See filters-standard.md for FilterBar details */}
  <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
</div>
```

## Content Area

```tsx
{/* DataTable (most common) */}
<DataTable
  columns={columns}
  data={filteredData}
  loading={isLoading}
  onRowClick={(row) => openPanel(row.id)}
/>

{/* OR Card grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <ItemCard key={item.id} item={item} onClick={() => openPanel(item.id)} />
  ))}
</div>
```

## SidePanel Integration

```tsx
function ReservationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex-1 px-8 py-6 max-md:px-4 max-md:py-4" dir="rtl">
      {/* Page content */}
      <div className="flex flex-col gap-6">
        <PageHeader />
        <KpiRow />
        <FilterBar />
        <DataTable onRowClick={(row) => setSelectedId(row.id)} />
      </div>

      {/* SidePanel overlays on top */}
      <ReservationPanel
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        reservationId={selectedId}
      />
    </div>
  );
}
```

## Loading State (Full Page Skeleton)

```tsx
function PageSkeleton() {
  return (
    <div className="flex-1 px-8 py-6 max-md:px-4 max-md:py-4">
      <div className="flex flex-col gap-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-accent" />
            <div className="h-4 w-60 animate-pulse rounded-lg bg-accent" />
          </div>
          <div className="h-11 w-32 animate-pulse rounded-xl bg-accent" />
        </div>

        {/* KPI skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-[20px] border border-border/20 p-5">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-accent mb-3" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-accent mb-1" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-accent" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="rounded-[20px] border border-border/20 overflow-hidden">
          <div className="h-12 bg-accent/50" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/10">
              <div className="h-4 w-24 animate-pulse rounded bg-accent" />
              <div className="h-4 w-32 animate-pulse rounded bg-accent" />
              <div className="h-4 w-20 animate-pulse rounded bg-accent" />
              <div className="h-4 w-16 animate-pulse rounded bg-accent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 640px` (mobile) | `px-4 py-4`, KPI 2-col, stacked filters |
| `640-1024px` (tablet) | `px-6 py-5`, KPI 2-col, wrapped filters |
| `> 1024px` (desktop) | `px-8 py-6`, KPI 4-col, inline filters |

## Do / Don't

| Do | Don't |
|----|-------|
| `px-8 py-6` desktop page padding | Content touching browser edge |
| `gap-6` between page sections | Margin on individual sections |
| H1 for page title (`text-2xl font-bold`) | Small or inconsistent titles |
| Gradient primary button for main action | Multiple primary buttons in header |
| KPI row with 4 cards in grid | More than 4 KPIs visible |
| Filter bar between header and content | Filters inside the table |
| SidePanel overlays content | Navigate to separate page for details |
| Full page skeleton on initial load | Blank page while loading |
| `max-w-[1600px] mx-auto` for wide screens | Content stretching infinitely |
| Consistent gap system throughout | Mixed margin/padding approaches |

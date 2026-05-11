# Card Component Standards

> Sapphire Design System -- Card types, visual rules, and usage patterns.

## Base Card

Every card in the system inherits these base styles:

```tsx
<div className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm">
  {children}
</div>
```

| Property | Value | Notes |
|----------|-------|-------|
| Border radius | `rounded-[20px]` | Never sharp corners |
| Background | `bg-card` | Adapts to light/dark theme |
| Border | `border border-border/20` | Subtle, not harsh |
| Padding | `p-5` | Minimum `p-4`, prefer `p-5` |
| Shadow | `shadow-sm` | Light shadow for elevation |

## Card Variants

### 1. Standard Card

Basic container for content grouping.

```tsx
<div className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm">
  <p className="text-sm">Card content here</p>
</div>
```

### 2. Section Card (with title)

Used inside forms and detail panels to group related fields.

```tsx
<div className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm">
  <h3 className="text-sm font-bold text-foreground mb-4">
    כותרת סקשן
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Fields or content */}
  </div>
</div>
```

### 3. KPI Card

Dashboard metric display.

```tsx
<div className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm">
  <div className="flex items-center justify-between">
    {/* Icon badge */}
    <div className="rounded-xl bg-primary/10 p-2.5">
      <Users className="h-5 w-5 text-primary" strokeWidth={1.8} />
    </div>
    {/* Trend (optional) */}
    <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
      <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.8} />
      12%
    </span>
  </div>
  <div className="mt-3">
    <p className="text-2xl font-bold text-foreground">248</p>
    <p className="text-sm text-muted-foreground">סה"כ אורחים</p>
  </div>
</div>
```

#### KPI Card Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Metric label |
| `value` | `string \| number` | Metric value |
| `icon` | `LucideIcon` | Metric icon |
| `trend` | `{ value: number, direction: "up" \| "down" }` | Optional trend indicator |

### 4. Status Card

Entity card with colored border indicating status.

```tsx
<div className={cn(
  "rounded-[20px] border border-border/20 bg-card p-5 shadow-sm",
  "border-r-4",
  statusColorMap[status] // e.g., "border-r-emerald-500"
)}>
  <div className="flex items-center justify-between mb-3">
    <span className="font-bold text-foreground">חדר 101</span>
    <span className="text-xs text-muted-foreground">סטנדרט</span>
  </div>
  <p className="text-sm text-muted-foreground">
    {statusLabel}
  </p>
</div>
```

#### Status Color Map

```ts
const statusColorMap: Record<string, string> = {
  confirmed: "border-r-emerald-500",
  pending: "border-r-amber-500",
  cancelled: "border-r-red-500",
  checked_in: "border-r-blue-500",
  checked_out: "border-r-gray-400",
  blocked: "border-r-purple-500",
  dirty: "border-r-orange-500",
  clean: "border-r-emerald-500",
  inspected: "border-r-teal-500",
};
```

### 5. Clickable Card

Interactive card that opens a SidePanel or triggers an action.

```tsx
<button
  onClick={() => openPanel(item.id)}
  className="rounded-[20px] border border-border/20 bg-card p-5 shadow-sm
             text-right w-full
             hover:shadow-md cursor-pointer
             transition-shadow duration-200
             focus:outline-none focus:ring-2 focus:ring-primary/20"
>
  {/* Card content */}
</button>
```

### 6. Compact Card (list item alternative)

Smaller card for dense lists.

```tsx
<div className="rounded-xl border border-border/20 bg-card p-3 shadow-sm">
  <div className="flex items-center gap-3">
    <div className="rounded-lg bg-accent p-2">
      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
</div>
```

## Card Grid Layouts

```tsx
{/* 2 columns on tablet, 3 on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id} item={item} />
  ))}
</div>

{/* KPI row: 2 mobile, 4 desktop */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {kpis.map((kpi) => (
    <KpiCard key={kpi.id} {...kpi} />
  ))}
</div>

{/* Wide cards: single column */}
<div className="flex flex-col gap-4">
  {items.map((item) => (
    <WideCard key={item.id} item={item} />
  ))}
</div>
```

## Card Header Pattern

When a card needs a header with title and actions:

```tsx
<div className="rounded-[20px] border border-border/20 bg-card shadow-sm overflow-hidden">
  {/* Card header */}
  <div className="flex items-center justify-between px-5 pt-5 pb-3">
    <h3 className="text-sm font-bold text-foreground">כותרת</h3>
    <button className="text-sm text-primary hover:underline">
      הצג הכל
    </button>
  </div>
  {/* Card body */}
  <div className="px-5 pb-5">
    {/* Content */}
  </div>
</div>
```

## Do / Don't

| Do | Don't |
|----|-------|
| `rounded-[20px]` always | Sharp corners or `rounded-md` |
| `p-5` standard padding | No padding or `p-2` |
| `border-border/20` subtle border | Heavy `border-2` borders |
| `shadow-sm` for depth | `shadow-lg` on static cards |
| `shadow-md` on hover (clickable) | `shadow-lg` or scale on hover |
| `border-r-4` for status | Colored dots or badge chips for status |
| `bg-card` background | Hardcoded white/gray |
| `gap-4` between cards | Margin on individual cards |
| Lucide icons, `strokeWidth={1.8}` | Other icon libraries |
| `text-right` for RTL content | Left-aligned card content |
| Section title as `h3 text-sm font-bold` | Large or inconsistent headings |
| `transition-shadow duration-200` | Instant hover effects |

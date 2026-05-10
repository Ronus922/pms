# Sapphire Design System -- Page Layouts

## Overall Structure

```
+--------------------------------------------------+
| TopBar (sticky, glass effect)                     |
+----------+---------------------------------------+
|          |                                       |
| Sidebar  |  Main Content                         |
| (right)  |  (flex-1)                             |
|          |                                       |
|  w-72    |  px-8 py-6 desktop                    |
|  or      |  px-4 py-4 mobile                     |
|  w-20    |                                       |
|          |                                       |
+----------+---------------------------------------+
                      |
              +-------+--------+
              | SidePanel      |
              | (fixed left-0) |
              | z-50           |
              +----------------+
```

---

## Sidebar

Fixed on the right side (RTL). Two modes: expanded and collapsed.

```tsx
<aside
  className={cn(
    "fixed right-0 top-0 bottom-0 z-30 bg-card border-l border-border",
    "flex flex-col transition-all duration-300",
    isExpanded ? "w-72" : "w-20"
  )}
>
  {/* Logo / Brand */}
  <div className="h-16 flex items-center justify-center border-b border-border px-4">
    {isExpanded ? (
      <span className="text-lg font-bold text-foreground">GuestHub</span>
    ) : (
      <span className="text-lg font-bold text-primary">G</span>
    )}
  </div>

  {/* Navigation */}
  <nav className="flex-1 overflow-y-auto py-4 px-3">
    <ul className="space-y-1">
      {navItems.map(item => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 min-h-[44px] transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {isExpanded && (
              <span className="text-sm font-bold">{item.label}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  </nav>

  {/* Collapse toggle */}
  <button
    onClick={toggleSidebar}
    className="h-12 flex items-center justify-center border-t border-border
               hover:bg-accent transition-colors"
  >
    {isExpanded
      ? <ChevronsRight className="w-5 h-5 text-muted-foreground" />
      : <ChevronsLeft className="w-5 h-5 text-muted-foreground" />
    }
  </button>
</aside>

{/* Main content offset */}
<main className={cn(
  "transition-all duration-300",
  isExpanded ? "mr-72" : "mr-20"
)}>
  ...
</main>
```

### Mobile Sidebar

On mobile, the sidebar becomes a slide-out overlay.

```tsx
{/* Mobile: overlay sidebar */}
<div className="lg:hidden">
  {isOpen && (
    <>
      <div className="fixed inset-0 bg-black/65 z-40" onClick={closeSidebar} />
      <aside className="fixed right-0 top-0 bottom-0 w-72 bg-card shadow-2xl z-50
                        animate-slide-in-right">
        {/* Same navigation content */}
      </aside>
    </>
  )}
</div>

{/* Desktop: fixed sidebar */}
<aside className="hidden lg:flex fixed right-0 top-0 bottom-0 w-72 bg-card
                  border-l border-border z-30">
  {/* Navigation content */}
</aside>
```

---

## TopBar

Sticky top bar with glass effect.

```tsx
<header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md
                   border-b border-border">
  <div className="flex items-center justify-between h-16 px-8 max-lg:px-4">
    {/* Right side: mobile menu + breadcrumb */}
    <div className="flex items-center gap-3">
      <button className="lg:hidden w-10 h-10 flex items-center justify-center
                         rounded-xl hover:bg-accent"
              onClick={toggleMobileSidebar}>
        <Menu className="w-5 h-5" />
      </button>
      <nav className="text-sm text-muted-foreground hidden sm:block">
        <span>Dashboard</span>
        <span className="mx-2">/</span>
        <span className="text-foreground font-bold">Reservations</span>
      </nav>
    </div>

    {/* Left side: actions */}
    <div className="flex items-center gap-2">
      {/* Search */}
      <button className="w-10 h-10 flex items-center justify-center rounded-xl
                         hover:bg-accent">
        <Search className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Notifications */}
      <button className="relative w-10 h-10 flex items-center justify-center
                         rounded-xl hover:bg-accent">
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full
                         bg-red-500" />
      </button>

      {/* User avatar */}
      <button className="w-10 h-10 rounded-full bg-primary/10 flex items-center
                         justify-center text-primary font-bold text-sm">
        IM
      </button>
    </div>
  </div>
</header>
```

---

## Main Content Area

```tsx
<main className={cn(
  "flex-1 min-h-screen",
  "px-8 py-6",        // Desktop padding
  "max-lg:px-4 max-lg:py-4",  // Mobile padding
  isExpanded ? "mr-72" : "mr-20",  // Sidebar offset
  "max-lg:mr-0"       // No offset on mobile
)}>
  {children}
</main>
```

---

## Page Header

Standard header for every page: title, subtitle, and action buttons.

```tsx
<div className="flex items-center justify-between mb-6">
  {/* Title area */}
  <div>
    <h1 className="text-[28px] font-extrabold leading-tight tracking-tight
                   text-foreground max-sm:text-lg">
      Reservations
    </h1>
    <p className="text-muted-foreground text-base mt-1 hidden sm:block">
      Manage and track all guest reservations
    </p>
  </div>

  {/* Actions */}
  <div className="flex items-center gap-3">
    {/* Secondary action */}
    <button className="border border-border bg-card rounded-xl px-4 py-2
                       min-h-[44px] text-sm font-bold hover:bg-accent
                       hidden sm:flex items-center gap-2">
      <Download className="w-4 h-4" />
      Export
    </button>

    {/* Primary action */}
    <button className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white
                       rounded-xl px-4 py-2 min-h-[44px] font-bold
                       flex items-center gap-2">
      <Plus className="w-4 h-4" />
      <span className="hidden sm:inline">New Reservation</span>
    </button>
  </div>
</div>
```

---

## KPI Row

Grid of KPI cards at the top of a page.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <div className="bg-card rounded-[20px] border border-border p-4 shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-bold text-muted-foreground">
        Total Reservations
      </span>
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
        <Calendar className="w-4 h-4 text-primary" />
      </div>
    </div>
    <div className="text-[28px] font-extrabold text-foreground leading-none">
      142
    </div>
    <div className="flex items-center gap-1.5 mt-2">
      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
      <span className="text-xs font-bold text-emerald-600">+12%</span>
      <span className="text-xs text-muted-foreground">vs last month</span>
    </div>
  </div>

  {/* Repeat for other KPIs */}
</div>
```

---

## Filter Bar

Below page header, above content.

```tsx
<div className="flex flex-wrap items-center gap-3 mb-4">
  {/* Search input */}
  <div className="relative flex-1 min-w-[200px] max-w-md">
    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4
                       text-muted-foreground" />
    <input
      type="text"
      placeholder="Search..."
      className="w-full min-h-[44px] bg-accent border border-border/40 rounded-xl
                 pr-10 pl-4 py-2 text-base
                 focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  </div>

  {/* Filter selects */}
  <select className="min-h-[44px] bg-accent border border-border/40 rounded-xl
                     px-4 py-2 text-sm appearance-none">
    <option value="">All Statuses</option>
    <option value="confirmed">Confirmed</option>
    <option value="pending">Pending</option>
  </select>

  {/* Date range */}
  <button className="min-h-[44px] bg-accent border border-border/40 rounded-xl
                     px-4 py-2 text-sm flex items-center gap-2">
    <Calendar className="w-4 h-4" />
    Date Range
  </button>

  {/* Reset filters */}
  {hasFilters && (
    <button className="text-sm text-muted-foreground hover:text-foreground
                       underline">
      Reset
    </button>
  )}
</div>
```

---

## Content Area Patterns

### Data Table Page

```tsx
<main>
  <PageHeader title="Reservations" />
  <KPIRow kpis={kpis} />
  <FilterBar />
  <DataTable data={data} />
</main>
```

### Card Grid Page

```tsx
<main>
  <PageHeader title="Rooms" />
  <FilterBar />
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {rooms.map(room => (
      <RoomCard key={room.id} room={room} onClick={openPanel} />
    ))}
  </div>
</main>
```

---

## Dashboard Layout

```tsx
<main>
  <PageHeader title="Dashboard" />

  {/* KPI row */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <KPICard />
    <KPICard />
    <KPICard />
    <KPICard />
  </div>

  {/* Charts grid */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div className="bg-card rounded-[20px] border border-border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4">Revenue</h3>
      <RevenueChart />
    </div>
    <div className="bg-card rounded-[20px] border border-border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4">Occupancy</h3>
      <OccupancyChart />
    </div>
  </div>

  {/* Recent activity */}
  <div className="bg-card rounded-[20px] border border-border p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
    <ActivityList />
  </div>
</main>
```

---

## Settings Layout

Two-column layout: sidebar navigation + content area.

```tsx
<main className="flex gap-6 max-lg:flex-col">
  {/* Settings nav (sidebar) */}
  <nav className="w-64 shrink-0 max-lg:w-full">
    <div className="bg-card rounded-[20px] border border-border p-3 shadow-sm
                    sticky top-20">
      <ul className="space-y-1">
        {settingSections.map(section => (
          <li key={section.id}>
            <button
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5",
                "text-sm font-bold transition-colors min-h-[44px]",
                activeSection === section.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <section.icon className="w-4 h-4 shrink-0" />
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </nav>

  {/* Settings content */}
  <div className="flex-1 space-y-6">
    <div className="bg-card rounded-[20px] border border-border p-6 shadow-sm">
      <h2 className="text-[22px] font-bold text-foreground mb-4">
        {currentSection.title}
      </h2>
      <p className="text-muted-foreground mb-6">
        {currentSection.description}
      </p>
      {currentSection.content}
    </div>
  </div>
</main>
```

---

## SidePanel Overlay

The SidePanel sits on top of everything. See DIALOGS.md for full specification.

```
z-index layers:
  z-10  - Sticky table headers
  z-20  - Frozen columns
  z-30  - Sidebar navigation
  z-40  - TopBar, offline banner
  z-50  - SidePanel, dialogs, bottom sheets
```

---

## Full Page Layout Template

```tsx
export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="mr-72 max-lg:mr-0 flex flex-col min-h-screen">
        {/* TopBar */}
        <TopBar />

        {/* Page content */}
        <main className="flex-1 px-8 py-6 max-lg:px-4 max-lg:py-4">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      {/* Toast container */}
      <Toaster position="bottom-left" />
    </div>
  )
}
```

---

## Spacing Consistency

| Area | Desktop | Mobile |
|------|---------|--------|
| Page padding | `px-8 py-6` | `px-4 py-4` |
| Section gap | `space-y-6` or `gap-6` | `space-y-4` or `gap-4` |
| Card padding | `p-6` | `p-4` |
| Card gap (grid) | `gap-4` or `gap-6` | `gap-3` |
| Header margin bottom | `mb-6` | `mb-4` |
| KPI to content gap | `mb-6` | `mb-4` |
| Filter to table gap | `mb-4` | `mb-3` |

# DataTable: [ENTITY_NAME]

## Table Info

| Property | Value |
|----------|-------|
| Entity | [ENTITY_NAME] |
| Component | `[Entity]Table.tsx` |
| Filter Component | `[Entity]FilterBar.tsx` |
| Data Source | Server Action: `get[Entity]s` |
| Default Page Size | 20 |
| Pagination | Server-side |

## Columns

| # | Field | Label (Hebrew) | Type | Sortable | Default Width | Visible by Default | Format |
|---|-------|---------------|------|----------|---------------|-------------------|--------|
| 1 | [FIELD_1] | [HEBREW] | text | Yes | 200px | Yes | - |
| 2 | [FIELD_2] | [HEBREW] | badge | No | 120px | Yes | Status badge with color |
| 3 | [FIELD_3] | [HEBREW] | date | Yes | 150px | Yes | dd/MM/yyyy |
| 4 | [FIELD_4] | [HEBREW] | currency | Yes | 120px | Yes | ILS with comma separator |
| 5 | [FIELD_5] | [HEBREW] | text | Yes | 180px | Yes | - |
| 6 | [FIELD_6] | [HEBREW] | avatar | No | 60px | Yes | Initials or image |
| 7 | [FIELD_7] | [HEBREW] | actions | No | 80px | Yes | Dropdown menu |

### Column Type Definitions

| Type | Render | Alignment |
|------|--------|-----------|
| text | Plain text, truncate with tooltip | Right (RTL) |
| badge | Colored badge (from status map) | Center |
| date | Formatted date string | Right |
| currency | Number with ILS symbol | Left (numbers) |
| avatar | Circle with initials or image | Center |
| boolean | Check/X icon | Center |
| link | Clickable text | Right |
| actions | Dropdown menu with row actions | Center |

## Default Sort

| Column | Direction |
|--------|-----------|
| [FIELD_NAME] | desc |

## Filters

### Filter Bar

| Filter | Label (Hebrew) | Type | Options Source | Default |
|--------|---------------|------|---------------|---------|
| search | חיפוש | text input | - | "" |
| [FILTER_1] | [HEBREW] | select | lookup_items: [CATEGORY] | "all" |
| [FILTER_2] | [HEBREW] | date-range | calendar picker | Last 30 days |
| [FILTER_3] | [HEBREW] | multi-select | lookup_items: [CATEGORY] | [] |
| [FILTER_4] | [HEBREW] | toggle | - | false |

### Search Fields

Search input queries across these fields:
- [FIELD_1] (e.g., name)
- [FIELD_2] (e.g., email)
- [FIELD_3] (e.g., phone)

### URL State (nuqs)

All filters are synced to URL query params for shareability and back-button support.

| Param | Key | Type | Default |
|-------|-----|------|---------|
| Search | `q` | string | "" |
| [FILTER_1] | `[key]` | string | "all" |
| [FILTER_2] | `from` / `to` | string (ISO date) | - |
| Page | `page` | number | 1 |
| Sort | `sort` | string | "[field]_desc" |

## Row Behavior

### Row Click

| Action | Behavior |
|--------|----------|
| Click row | Open SidePanel in view/edit mode |
| Click action menu | Show dropdown with actions |

### Row Actions (Dropdown)

| Action | Label (Hebrew) | Icon | Permission Required | Condition |
|--------|---------------|------|--------------------|-----------| 
| View | צפייה | Eye | `[module]:view` | Always |
| Edit | עריכה | Pencil | `[module]:edit` | Status !== completed |
| Delete | מחיקה | Trash | `[module]:delete` | Status !== completed |
| [CUSTOM] | [HEBREW] | [ICON] | `[module]:[custom]` | [CONDITION] |

### Row Styling

| Condition | Style |
|-----------|-------|
| Status border | `border-r-4 border-[STATUS_COLOR]` |
| Deleted (soft) | Row not shown (filtered server-side) |
| [CONDITION] | [STYLE] |

## Bulk Actions

| Action | Label (Hebrew) | Permission | Confirmation |
|--------|---------------|------------|--------------|
| [BULK_ACTION_1] | [HEBREW] | [PERMISSION] | [Yes / No] |
| [BULK_ACTION_2] | [HEBREW] | [PERMISSION] | [Yes / No] |

_If no bulk actions needed, remove this section._

## Empty State

| Property | Value |
|----------|-------|
| Icon | [ICON_NAME] |
| Title (Hebrew) | [EMPTY_TITLE] |
| Description (Hebrew) | [EMPTY_DESCRIPTION] |
| Action button | [BUTTON_LABEL] -- opens create panel |
| Action permission | `[module]:create` |

## Loading State

| State | Display |
|-------|---------|
| Initial load | Skeleton rows (5 rows, matching column widths) |
| Filter change | Skeleton rows with active filter chips visible |
| Page change | Skeleton rows |
| No delay | Show skeleton immediately, no spinner |

## Mobile Card Layout (< 768px)

On mobile, table rows convert to stacked cards.

| Position | Field | Style |
|----------|-------|-------|
| Card title | [FIELD_1] | Font bold, text-base |
| Card subtitle | [FIELD_2] | Text-sm, text-muted-foreground |
| Right badge | [STATUS_FIELD] | Status badge |
| Detail row 1 | [FIELD_3]: [FIELD_4] | Label: value pairs |
| Detail row 2 | [FIELD_5]: [FIELD_6] | Label: value pairs |
| Card border | - | `border-r-4 border-[STATUS_COLOR]` |

## Server Query

```typescript
// In lib/actions/[module].ts
interface Get[Entity]sParams {
  search?: string
  [filter_1]?: string
  [filter_2_from]?: string
  [filter_2_to]?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

// Returns
interface Get[Entity]sResult {
  data: [Entity][]
  count: number
  page: number
  pageSize: number
}
```

## Performance Notes

- Server-side pagination (never fetch all records)
- Debounce search input (300ms)
- Filters trigger immediate server fetch (no local filtering)
- Column widths fixed to prevent layout shift
- Virtualization if > 100 visible rows (unlikely with pagination)

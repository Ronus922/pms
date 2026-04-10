// ─────────────────────────────────────────────────────────────────────────────
// Reports Engine — Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_12_months"
  | "custom";

export type CompareMode = "none" | "previous_period" | "same_period_last_year";

export type ChartType =
  | "bar"
  | "line"
  | "stacked_bar"
  | "area"
  | "pie"
  | "heatmap"
  | "calendar"
  | "funnel"
  | "leaderboard"
  | "table";

export type MetricAggregation =
  | "count"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "percentage"
  | "ratio"
  | "growth";

export type GroupByField =
  | "day"
  | "week"
  | "month"
  | "year"
  | "room"
  | "room_type"
  | "building"
  | "floor"
  | "country"
  | "city"
  | "guest"
  | "employee"
  | "channel"
  | "source"
  | "payment_status"
  | "reservation_status";

export type SortDirection = "highest" | "lowest" | "newest" | "oldest";

export type ExportFormat = "excel" | "csv" | "pdf";

export type ReportCategoryId =
  | "revenue"
  | "occupancy"
  | "reservations"
  | "guests"
  | "rooms"
  | "channels"
  | "marketing"
  | "payments"
  | "cancellations"
  | "housekeeping"
  | "maintenance"
  | "staff"
  | "whatsapp"
  | "documents"
  | "system";

export type ReportEntity =
  | "reservations"
  | "guests"
  | "rooms"
  | "payments"
  | "invoices"
  | "tasks"
  | "issues"
  | "whatsapp"
  | "suppliers"
  | "employees";

// ─── Filter State ────────────────────────────────────────────────────────────

export interface ReportDateRange {
  preset: DateRangePreset;
  from: string; // ISO date
  to: string;   // ISO date
}

export interface ReportFilters {
  dateRange: ReportDateRange;
  compare: CompareMode;
  building: string[];
  room: string[];
  floor: string[];
  roomType: string[];
  reservationSource: string[];
  bookingChannel: string[];
  reservationStatus: string[];
  paymentStatus: string[];
  country: string[];
  city: string[];
  guestType: string[];
  employee: string[];
  supplier: string[];
  vipOnly: boolean;
  repeatGuestsOnly: boolean;
  groupBookingsOnly: boolean;
  includeCancelled: boolean;
  includeNoShows: boolean;
}

// ─── KPI Definition ──────────────────────────────────────────────────────────

export interface KpiDefinition {
  id: string;
  label: string;
  format: "currency" | "number" | "percent";
  tone: string;
  icon?: string;
}

export interface KpiValue {
  id: string;
  value: number;
  previousValue?: number;
  change?: string;
}

// ─── Column Definition ───────────────────────────────────────────────────────

export interface ReportColumnDef {
  key: string;
  header: string;
  format?: "currency" | "number" | "percent" | "date" | "text" | "status";
  sortable?: boolean;
  width?: number;
}

// ─── Report Definition (Config) ──────────────────────────────────────────────

export interface ReportDefinition {
  id: string;
  label: string;
  description?: string;
  category: ReportCategoryId;
  entity: ReportEntity;
  defaultChart: ChartType;
  supportedCharts: ChartType[];
  defaultGroupBy: GroupByField;
  supportedGroupBy: GroupByField[];
  kpis: KpiDefinition[];
  columns: ReportColumnDef[];
  defaultSort: SortDirection;
}

// ─── Report Category ─────────────────────────────────────────────────────────

export interface ReportCategory {
  id: ReportCategoryId;
  label: string;
  description: string;
  icon: string;
  tone: string;
  reports: ReportDefinition[];
}

// ─── Saved Report ────────────────────────────────────────────────────────────

export interface SavedReport {
  id: string;
  name: string;
  reportId: string;
  categoryId: ReportCategoryId;
  filters: ReportFilters;
  groupBy: GroupByField;
  chartType: ChartType;
  columns: string[];
  sort: SortDirection;
  exportFormat: ExportFormat;
  createdAt: string;
  updatedAt: string;
}

// ─── Chart Data ──────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  previousValue?: number;
  [key: string]: string | number | undefined;
}

// ─── Report Data Bundle ──────────────────────────────────────────────────────

export interface ReportData {
  kpis: KpiValue[];
  chartData: ChartDataPoint[];
  tableData: Record<string, unknown>[];
  totalRows: number;
  loading: boolean;
  error: string | null;
}

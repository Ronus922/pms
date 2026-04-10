// ─────────────────────────────────────────────────────────────────────────────
// Reports Engine — Demo Data Generator
// Generates realistic mock data for all report types
// ─────────────────────────────────────────────────────────────────────────────

import type { ChartDataPoint, KpiValue, ReportDefinition } from "./types";

const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const CHANNELS = ["Booking.com", "Airbnb", "ישיר", "אתר", "WhatsApp", "טלפון", "Walk-in", "סוכן נסיעות", "חברות"];
const COUNTRIES = ["ישראל", "ארה\"ב", "צרפת", "גרמניה", "בריטניה", "רוסיה", "איטליה", "ספרד", "קנדה", "אוסטרליה"];
const ROOM_TYPES = ["סטנדרט", "דלוקס", "סוויטה", "משפחתי", "פנטהאוז"];
const ROOMS = ["101", "102", "103", "201", "202", "203", "301", "302", "303", "401"];
const EMPLOYEES = ["דנה כהן", "יוסי לוי", "מיכל אברהם", "אורי ישראלי", "נועה פרידמן"];
const PAYMENT_METHODS = ["מזומן", "אשראי", "העברה בנקאית", "PayPal", "ביט"];
const SOURCES = ["Google Ads", "Facebook", "Instagram", "אורגני", "הפניה", "WhatsApp"];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function pickRandom<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

// ─── Generate chart data based on groupBy ────────────────────────────────────

function generateLabels(groupBy: string, count?: number): string[] {
  switch (groupBy) {
    case "day":
      return Array.from({ length: count ?? 30 }, (_, i) => `${i + 1}`);
    case "week":
      return Array.from({ length: count ?? 12 }, (_, i) => `שבוע ${i + 1}`);
    case "month":
      return MONTHS_HE.slice(0, count ?? 12);
    case "year":
      return ["2023", "2024", "2025", "2026"];
    case "room":
      return ROOMS.slice(0, count ?? 10);
    case "room_type":
      return ROOM_TYPES;
    case "building":
      return ["בניין A", "בניין B", "בניין C"];
    case "floor":
      return ["קומה 1", "קומה 2", "קומה 3", "קומה 4"];
    case "channel":
      return CHANNELS;
    case "source":
      return SOURCES;
    case "country":
      return COUNTRIES.slice(0, count ?? 8);
    case "city":
      return ["תל אביב", "ירושלים", "חיפה", "אילת", "הרצליה"];
    case "guest":
      return ["אורח א׳", "אורח ב׳", "אורח ג׳", "אורח ד׳", "אורח ה׳"];
    case "employee":
      return EMPLOYEES;
    case "payment_status":
      return PAYMENT_METHODS;
    case "reservation_status":
      return ["מאושר", "ממתין", "מבוטל", "צ׳ק-אין", "צ׳ק-אאוט", "לא הגיע"];
    default:
      return MONTHS_HE;
  }
}

// ─── Generate KPI values from definition ─────────────────────────────────────

export function generateKpiValues(report: ReportDefinition): KpiValue[] {
  return report.kpis.map((kpi) => {
    let value: number;
    let previousValue: number;

    switch (kpi.format) {
      case "currency":
        value = rand(5000, 500000);
        previousValue = rand(4000, 450000);
        break;
      case "percent":
        value = randFloat(15, 95);
        previousValue = randFloat(10, 90);
        break;
      default:
        value = rand(10, 5000);
        previousValue = rand(8, 4500);
    }

    const changeNum = value - previousValue;
    const changePct = previousValue > 0 ? ((changeNum / previousValue) * 100).toFixed(1) : "0";
    const arrow = changeNum >= 0 ? "+" : "";

    return {
      id: kpi.id,
      value,
      previousValue,
      change: `${arrow}${changePct}% מהתקופה הקודמת`,
    };
  });
}

// ─── Generate chart data ─────────────────────────────────────────────────────

export function generateChartData(report: ReportDefinition, groupBy: string): ChartDataPoint[] {
  const labels = generateLabels(groupBy);

  return labels.map((label) => {
    const point: ChartDataPoint = { label, value: 0 };

    // Generate value based on first column format
    const mainCol = report.columns.find((c) => c.sortable);
    if (mainCol?.format === "currency") {
      point.value = rand(5000, 150000);
      point.previousValue = rand(4000, 130000);
    } else if (mainCol?.format === "percent") {
      point.value = randFloat(20, 98);
      point.previousValue = randFloat(15, 95);
    } else {
      point.value = rand(5, 500);
      point.previousValue = rand(3, 450);
    }

    // Add extra series for stacked charts
    if (report.supportedCharts.includes("stacked_bar")) {
      point.series1 = rand(1000, 50000);
      point.series2 = rand(1000, 40000);
      point.series3 = rand(500, 30000);
    }

    return point;
  });
}

// ─── Generate table data ─────────────────────────────────────────────────────

export function generateTableData(report: ReportDefinition, groupBy: string): Record<string, unknown>[] {
  const labels = generateLabels(groupBy);

  return labels.map((label, index) => {
    const row: Record<string, unknown> = {};

    for (const col of report.columns) {
      switch (col.format) {
        case "currency":
          row[col.key] = rand(1000, 200000);
          break;
        case "percent":
          row[col.key] = randFloat(5, 98);
          break;
        case "number":
          row[col.key] = rand(1, 5000);
          break;
        case "date":
          row[col.key] = `2026-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`;
          break;
        case "status": {
          const statuses = ["פעיל", "ממתין", "מושהה", "מבוטל"];
          row[col.key] = pickRandom(statuses);
          break;
        }
        default:
          // Text — use label for the first column, generate for others
          if (index === 0 || col === report.columns[0]) {
            row[col.key] = label;
          } else {
            row[col.key] = label;
          }
      }
    }

    // Override first column with the label
    if (report.columns[0]) {
      row[report.columns[0].key] = label;
    }

    return row;
  });
}

// ─── Generate complete report data bundle ────────────────────────────────────

export function generateReportData(report: ReportDefinition, groupBy?: string) {
  const effectiveGroupBy = groupBy ?? report.defaultGroupBy;

  return {
    kpis: generateKpiValues(report),
    chartData: generateChartData(report, effectiveGroupBy),
    tableData: generateTableData(report, effectiveGroupBy),
    totalRows: generateLabels(effectiveGroupBy).length,
    loading: false,
    error: null,
  };
}

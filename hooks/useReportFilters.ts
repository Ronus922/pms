"use client";

import { useCallback, useState } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  format,
} from "date-fns";

import type {
  CompareMode,
  DateRangePreset,
  ReportDateRange,
  ReportFilters,
} from "@/lib/reports/types";

// ─── Default Filter State ────────────────────────────────────────────────────

function getDateRangeFromPreset(preset: DateRangePreset): ReportDateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return { preset, from: format(startOfDay(now), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
    case "yesterday": {
      const y = subDays(now, 1);
      return { preset, from: format(startOfDay(y), "yyyy-MM-dd"), to: format(endOfDay(y), "yyyy-MM-dd") };
    }
    case "this_week":
      return { preset, from: format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
    case "this_month":
      return { preset, from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { preset, from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "last_3_months":
      return { preset, from: format(subMonths(now, 3), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
    case "last_12_months":
      return { preset, from: format(subMonths(now, 12), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
    case "custom":
    default:
      return { preset: "this_month", from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfDay(now), "yyyy-MM-dd") };
  }
}

function createDefaultFilters(): ReportFilters {
  return {
    dateRange: getDateRangeFromPreset("this_month"),
    compare: "none",
    building: [],
    room: [],
    floor: [],
    roomType: [],
    reservationSource: [],
    bookingChannel: [],
    reservationStatus: [],
    paymentStatus: [],
    country: [],
    city: [],
    guestType: [],
    employee: [],
    supplier: [],
    vipOnly: false,
    repeatGuestsOnly: false,
    groupBookingsOnly: false,
    includeCancelled: false,
    includeNoShows: false,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useReportFilters() {
  const [filters, setFilters] = useState<ReportFilters>(createDefaultFilters);

  const setDatePreset = useCallback((preset: DateRangePreset) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: getDateRangeFromPreset(preset),
    }));
  }, []);

  const setCustomDateRange = useCallback((from: string, to: string) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { preset: "custom", from, to },
    }));
  }, []);

  const setCompare = useCallback((mode: CompareMode) => {
    setFilters((prev) => ({ ...prev, compare: mode }));
  }, []);

  const setFilter = useCallback(<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayFilter = useCallback((key: keyof ReportFilters, value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      if (!Array.isArray(current)) return prev;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(createDefaultFilters());
  }, []);

  const activeFilterCount = Object.entries(filters).reduce((count, [key, val]) => {
    if (key === "dateRange" || key === "compare") return count;
    if (Array.isArray(val) && val.length > 0) return count + 1;
    if (typeof val === "boolean" && val) return count + 1;
    return count;
  }, 0);

  return {
    filters,
    setFilters,
    setDatePreset,
    setCustomDateRange,
    setCompare,
    setFilter,
    toggleArrayFilter,
    resetFilters,
    activeFilterCount,
  };
}

// ─── Date preset labels ──────────────────────────────────────────────────────

export const DATE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "היום",
  yesterday: "אתמול",
  this_week: "השבוע",
  this_month: "החודש",
  last_month: "חודש שעבר",
  last_3_months: "3 חודשים",
  last_12_months: "12 חודשים",
  custom: "מותאם אישית",
};

export const COMPARE_LABELS: Record<CompareMode, string> = {
  none: "ללא השוואה",
  previous_period: "תקופה קודמת",
  same_period_last_year: "תקופה מקבילה שנה שעברה",
};

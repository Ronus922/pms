"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedReport, ReportFilters, GroupByField, ChartType, SortDirection, ExportFormat, ReportCategoryId } from "@/lib/reports/types";

const STORAGE_KEY = "almog_saved_reports";

// ─── Default saved reports (Hebrew presets) ──────────────────────────────────

const DEFAULT_SAVED: SavedReport[] = [
  {
    id: "preset_revenue_month",
    name: "הכנסות החודש",
    reportId: "revenue_total",
    categoryId: "revenue",
    filters: {} as ReportFilters,
    groupBy: "month",
    chartType: "bar",
    columns: ["period", "revenue", "transactions", "avg_value", "growth"],
    sort: "newest",
    exportFormat: "excel",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "preset_occupancy_rooms",
    name: "תפוסה לפי חדרים",
    reportId: "occupancy_by_room_type",
    categoryId: "occupancy",
    filters: {} as ReportFilters,
    groupBy: "room_type",
    chartType: "stacked_bar",
    columns: ["room_type", "occupancy", "nights", "revenue"],
    sort: "highest",
    exportFormat: "excel",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "preset_cancel_channel",
    name: "ביטולים לפי ערוץ",
    reportId: "cancellation_overview",
    categoryId: "cancellations",
    filters: {} as ReportFilters,
    groupBy: "channel",
    chartType: "bar",
    columns: ["period", "cancellations", "rate", "lost_revenue", "avg_lead"],
    sort: "highest",
    exportFormat: "excel",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "preset_repeat_guests",
    name: "אורחים חוזרים",
    reportId: "guest_overview",
    categoryId: "guests",
    filters: {} as ReportFilters,
    groupBy: "guest",
    chartType: "leaderboard",
    columns: ["name", "country", "visits", "total_spend", "last_visit"],
    sort: "highest",
    exportFormat: "excel",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "preset_outstanding",
    name: "חובות פתוחים",
    reportId: "outstanding_balance",
    categoryId: "revenue",
    filters: {} as ReportFilters,
    groupBy: "guest",
    chartType: "table",
    columns: ["name", "unit", "amount", "due_date", "status"],
    sort: "highest",
    exportFormat: "pdf",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSavedReports() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>(DEFAULT_SAVED);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedReport[];
        setSavedReports([...DEFAULT_SAVED, ...parsed]);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const saveReport = useCallback((report: Omit<SavedReport, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newReport: SavedReport = {
      ...report,
      id: `saved_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    setSavedReports((prev) => {
      const next = [...prev, newReport];
      // Persist only user-created reports
      const userReports = next.filter((r) => !r.id.startsWith("preset_"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userReports));
      return next;
    });

    return newReport;
  }, []);

  const deleteReport = useCallback((id: string) => {
    // Don't allow deleting presets
    if (id.startsWith("preset_")) return;

    setSavedReports((prev) => {
      const next = prev.filter((r) => r.id !== id);
      const userReports = next.filter((r) => !r.id.startsWith("preset_"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userReports));
      return next;
    });
  }, []);

  const updateReport = useCallback((id: string, updates: Partial<SavedReport>) => {
    if (id.startsWith("preset_")) return;

    setSavedReports((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r,
      );
      const userReports = next.filter((r) => !r.id.startsWith("preset_"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userReports));
      return next;
    });
  }, []);

  return {
    savedReports,
    saveReport,
    deleteReport,
    updateReport,
  };
}

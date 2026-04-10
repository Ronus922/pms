"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupByField, ReportData, ReportDefinition, ReportFilters } from "@/lib/reports/types";
import { generateReportData } from "@/lib/reports/demo-data";

interface UseReportDataOptions {
  report: ReportDefinition | undefined;
  filters: ReportFilters;
  groupBy?: GroupByField;
  enabled?: boolean;
}

/**
 * Hook that fetches/generates report data.
 * Currently uses demo data — swap generateReportData with Supabase queries
 * when real tables are available.
 */
export function useReportData({ report, filters, groupBy, enabled = true }: UseReportDataOptions): ReportData {
  const [data, setData] = useState<ReportData>({
    kpis: [],
    chartData: [],
    tableData: [],
    totalRows: 0,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(() => {
    if (!report || !enabled) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    // Simulate async fetch with demo data
    const timer = setTimeout(() => {
      try {
        const result = generateReportData(report, groupBy ?? report.defaultGroupBy);
        setData(result);
      } catch {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: "שגיאה בטעינת הנתונים",
        }));
      }
    }, 300 + Math.random() * 400);

    return () => clearTimeout(timer);
  }, [report, groupBy, enabled]);

  // Re-fetch when dependencies change
  useEffect(() => {
    const cleanup = fetchData();
    return () => cleanup?.();
  }, [fetchData]);

  return data;
}

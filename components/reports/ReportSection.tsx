"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { useReportData } from "@/hooks/useReportData"
import { ReportsKpiRow } from "./ReportsKpiRow"
import { ReportsChartCard } from "./ReportsChartCard"
import { ReportsTableCard } from "./ReportsTableCard"
import { ReportExportMenu } from "./ReportExportMenu"
import type { ChartType, GroupByField, ReportDefinition, ReportFilters } from "@/lib/reports/types"

interface ReportSectionProps {
  report: ReportDefinition
  filters: ReportFilters
  showComparison: boolean
}

const GROUP_BY_LABELS: Record<GroupByField, string> = {
  day: "יום", week: "שבוע", month: "חודש", year: "שנה",
  room: "חדר", room_type: "סוג חדר", building: "בניין", floor: "קומה",
  country: "מדינה", city: "עיר", guest: "אורח", employee: "עובד",
  channel: "ערוץ", source: "מקור", payment_status: "סטטוס תשלום", reservation_status: "סטטוס הזמנה",
}

export function ReportSection({ report, filters, showComparison }: ReportSectionProps) {
  const [chartType, setChartType] = useState<ChartType>(report.defaultChart)
  const [groupBy, setGroupBy] = useState<GroupByField>(report.defaultGroupBy)
  const [showTable, setShowTable] = useState(true)
  const data = useReportData({ report, filters, groupBy })
  const primaryFormat = report.kpis[0]?.format ?? "number"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold font-headline">{report.label}</h3>
          {report.description && <p className="text-sm text-muted-foreground">{report.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {report.supportedGroupBy.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">קיבוץ:</span>
              {report.supportedGroupBy.slice(0, 6).map((gb) => (
                <button key={gb} type="button" onClick={() => setGroupBy(gb)} className={cn("report-groupby-btn", groupBy === gb && "active")}>
                  {GROUP_BY_LABELS[gb]}
                </button>
              ))}
            </div>
          )}
          <ReportExportMenu title={report.label} columns={report.columns} data={data.tableData} />
        </div>
      </div>

      <ReportsKpiRow definitions={report.kpis} values={data.kpis} loading={data.loading} />

      {chartType !== "table" && (
        <ReportsChartCard data={data.chartData} chartType={chartType} supportedCharts={report.supportedCharts} onChartTypeChange={setChartType} valueFormat={primaryFormat} loading={data.loading} showComparison={showComparison} />
      )}

      <div>
        <button type="button" onClick={() => setShowTable((p) => !p)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground min-h-[36px]">
          <Icon name={showTable ? "expand_more" : "chevron_left"} size="sm" />
          טבלת נתונים
        </button>
        {showTable && <div className="mt-3"><ReportsTableCard columns={report.columns} data={data.tableData} loading={data.loading} defaultSort={report.defaultSort} /></div>}
      </div>

      {data.error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{data.error}</div>
      )}
    </div>
  )
}

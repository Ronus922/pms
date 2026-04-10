"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/formatters"
import type { ChartDataPoint, ChartType } from "@/lib/reports/types"

interface ReportsChartCardProps {
  data: ChartDataPoint[]
  chartType: ChartType
  supportedCharts: ChartType[]
  onChartTypeChange: (type: ChartType) => void
  title?: string
  valueFormat?: "currency" | "number" | "percent"
  loading?: boolean
  showComparison?: boolean
}

const CHART_LABELS: Record<string, string> = {
  bar: "עמודות", line: "קו", stacked_bar: "מוערמות", area: "שטח", pie: "עוגה", leaderboard: "דירוג", table: "טבלה",
}

const COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-tertiary)", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"]

const TOOLTIP_STYLE = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }

export function ReportsChartCard({ data, chartType, supportedCharts, onChartTypeChange, title, valueFormat = "number", loading, showComparison }: ReportsChartCardProps) {
  const renderableCharts = supportedCharts.filter((t) => !["table", "heatmap", "calendar", "funnel"].includes(t))

  if (loading) {
    return (
      <div className="report-chart-card animate-pulse">
        <div className="h-6 w-32 rounded-lg bg-muted" />
        <div className="mt-4 h-[320px] rounded-xl bg-muted/50" />
      </div>
    )
  }

  if (["table", "heatmap", "calendar", "funnel"].includes(chartType)) return null

  return (
    <div className="report-chart-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title && <h3 className="text-lg font-semibold font-headline">{title}</h3>}
        <div className="flex flex-wrap gap-1">
          {renderableCharts.map((type) => (
            <button key={type} type="button" onClick={() => onChartTypeChange(type)} className={cn("chart-type-btn", chartType === type && "active")}>
              {CHART_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {chartType === "leaderboard" ? (
            <LeaderboardChart data={data} valueFormat={valueFormat} />
          ) : (
            <MeasuredChart heightClassName="h-[320px]">
              {({ width, height }) => renderChart({ type: chartType, data, width, height, valueFormat, showComparison })}
            </MeasuredChart>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── MeasuredChart (inline, no dependency on almog) ──────────────────── */
function MeasuredChart({ heightClassName, children }: { heightClassName: string; children: (size: { width: number; height: number }) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 }
      if (width > 0 && height > 0) setSize({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return <div ref={ref} className={`${heightClassName} w-full`}>{size ? children(size) : null}</div>
}

/* ── Chart Renderers ─────────────────────────────────────────────────── */
function renderChart({ type, data, width, height, valueFormat, showComparison }: { type: ChartType; data: ChartDataPoint[]; width: number; height: number; valueFormat: string; showComparison?: boolean }) {
  const fmt = (v: number) => {
    if (valueFormat === "currency") return formatCurrency(v)
    if (valueFormat === "percent") return `${v}%`
    return new Intl.NumberFormat("he-IL").format(v)
  }
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.55} vertical={false} />
  const xAxis = <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
  const yAxis = <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
  const tooltip = <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--color-foreground)" }} formatter={(value) => fmt(Number(value ?? 0))} />

  switch (type) {
    case "bar":
      return (<BarChart width={width} height={height} data={data}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey="value" fill={COLORS[0]} radius={[10, 10, 0, 0]} name="ערך" />{showComparison && <Bar dataKey="previousValue" fill={COLORS[2]} radius={[10, 10, 0, 0]} opacity={0.5} name="קודם" />}</BarChart>)
    case "stacked_bar":
      return (<BarChart width={width} height={height} data={data}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey="value" stackId="a" fill={COLORS[0]} name="ערך" /><Bar dataKey="series1" stackId="a" fill={COLORS[1]} name="סדרה 1" /><Bar dataKey="series2" stackId="a" fill={COLORS[3]} radius={[10, 10, 0, 0]} name="סדרה 2" /></BarChart>)
    case "line":
      return (<LineChart width={width} height={height} data={data}>{grid}{xAxis}{yAxis}{tooltip}<Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={3} dot={false} name="ערך" />{showComparison && <Line type="monotone" dataKey="previousValue" stroke={COLORS[2]} strokeWidth={2} strokeDasharray="5 5" dot={false} name="קודם" />}</LineChart>)
    case "area":
      return (<AreaChart width={width} height={height} data={data}>{grid}{xAxis}{yAxis}{tooltip}<defs><linearGradient id="rptAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke={COLORS[0]} fill="url(#rptAreaGrad)" strokeWidth={3} name="ערך" /></AreaChart>)
    case "pie":
      return (<PieChart width={width} height={height}><Pie data={data} dataKey="value" nameKey="label" innerRadius={65} outerRadius={Math.min(width, height) / 2 - 40} paddingAngle={3} label={({ name }) => name}>{data.map((entry, i) => (<Cell key={entry.label} fill={COLORS[i % COLORS.length]} />))}</Pie>{tooltip}</PieChart>)
    default:
      return (<BarChart width={width} height={height} data={data}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey="value" fill={COLORS[0]} radius={[10, 10, 0, 0]} /></BarChart>)
  }
}

/* ── Leaderboard ─────────────────────────────────────────────────────── */
function LeaderboardChart({ data, valueFormat }: { data: ChartDataPoint[]; valueFormat: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const maxVal = sorted[0]?.value ?? 1
  const fmt = (v: number) => {
    if (valueFormat === "currency") return formatCurrency(v)
    if (valueFormat === "percent") return `${v}%`
    return new Intl.NumberFormat("he-IL").format(v)
  }
  return (
    <div className="space-y-2">
      {sorted.slice(0, 10).map((item, idx) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-6 text-center text-sm font-bold text-muted-foreground">{idx + 1}</span>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums">{fmt(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-accent">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(item.value / maxVal) * 100}%`, background: COLORS[idx % COLORS.length] }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

"use client"

import { Icon } from "@/components/shared/Icon"
import { formatCurrency } from "@/lib/formatters"
import type { KpiDefinition, KpiValue } from "@/lib/reports/types"

interface ReportsKpiRowProps {
  definitions: KpiDefinition[]
  values: KpiValue[]
  loading?: boolean
}

export function ReportsKpiRow({ definitions, values, loading }: ReportsKpiRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {definitions.map((def) => (
          <div key={def.id} className="report-kpi-card animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-lg bg-muted" />
              <div className="h-8 w-32 rounded-lg bg-muted" />
              <div className="h-3 w-40 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {definitions.map((def) => {
        const val = values.find((v) => v.id === def.id)
        if (!val) return null

        const formatted = formatValue(val.value, def.format)
        const isPositive = val.previousValue !== undefined && val.value >= val.previousValue

        return (
          <div key={def.id} className="report-kpi-card">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="kpi-label">{def.label}</p>
                <p className="kpi-value">{formatted}</p>
              </div>
              {val.previousValue !== undefined && (
                <span className={isPositive ? "kpi-trend-up" : "kpi-trend-down"}>
                  <Icon name={isPositive ? "expand_less" : "expand_more"} size="md" />
                </span>
              )}
            </div>
            {val.change && <p className="kpi-change">{val.change}</p>}
          </div>
        )
      })}
    </div>
  )
}

function formatValue(value: number, format: "currency" | "number" | "percent"): string {
  switch (format) {
    case "currency": return formatCurrency(value)
    case "percent": return `${value}%`
    default: return new Intl.NumberFormat("he-IL").format(value)
  }
}

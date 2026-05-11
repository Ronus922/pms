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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {definitions.map((def) => (
          <div key={def.id} className="bg-white border border-[#dad9e3] rounded-xl p-6 min-h-[140px] animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-lg bg-[#f4f2fc]" />
              <div className="h-9 w-32 rounded-lg bg-[#f4f2fc]" />
              <div className="h-3 w-40 rounded-lg bg-[#f4f2fc]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {definitions.map((def) => {
        const val = values.find((v) => v.id === def.id)
        if (!val) return null

        const formatted = formatValue(val.value, def.format)
        const isPositive = val.previousValue !== undefined && val.value >= val.previousValue

        return (
          <div
            key={def.id}
            className="bg-white border border-[#dad9e3] rounded-xl p-6 min-h-[140px] flex items-start justify-between gap-4"
          >
            <div className="flex flex-col gap-1 min-w-0 text-right">
              <p className="text-sm font-medium text-[#474747]">{def.label}</p>
              <p className="text-[2.25rem] font-bold tabular-nums text-[#1c1b1f] leading-tight">{formatted}</p>
              {val.change && (
                <p className={`text-xs font-semibold ${isPositive ? "text-[#15803d]" : "text-[#b91c1c]"}`}>
                  {val.change}
                </p>
              )}
            </div>
            {val.previousValue !== undefined && (
              <span
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isPositive ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fee2e2] text-[#b91c1c]"
                }`}
              >
                <Icon name={isPositive ? "trending_up" : "trending_down"} />
              </span>
            )}
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

"use client"

import { useState, useMemo } from "react"
import { Icon } from "@/components/shared/Icon"
import { formatCurrency, formatDate } from "@/lib/formatters"
import type { ReportColumnDef, SortDirection } from "@/lib/reports/types"

interface ReportsTableCardProps {
  columns: ReportColumnDef[]
  data: Record<string, unknown>[]
  loading?: boolean
  title?: string
  defaultSort?: SortDirection
}

export function ReportsTableCard({ columns, data, loading, title, defaultSort = "highest" }: ReportsTableCardProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(defaultSort === "lowest" || defaultSort === "oldest")

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va
      return sortAsc ? String(va ?? "").localeCompare(String(vb ?? ""), "he") : String(vb ?? "").localeCompare(String(va ?? ""), "he")
    })
  }, [data, sortKey, sortAsc])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  if (loading) {
    return (
      <div className="report-table animate-pulse">
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="report-empty-state">
        <Icon name="bar_chart" size="xl" className="empty-icon" />
        <p className="text-lg font-medium text-muted-foreground">אין נתונים להצגה</p>
        <p className="mt-1 text-sm text-muted-foreground">נסה לשנות את הפילטרים או טווח התאריכים</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="text-lg font-semibold font-headline">{title}</h3>}
      <div className="report-table">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>
                    {col.sortable ? (
                      <button type="button" onClick={() => handleSort(col.key)} className="sort-btn">
                        {col.header}
                        <Icon name={sortKey === col.key ? (sortAsc ? "expand_less" : "expand_more") : "expand_more"} size="sm" className={sortKey === col.key ? "" : "opacity-30"} />
                      </button>
                    ) : col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key}>{formatCell(row[col.key], col.format)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">מציג {sortedData.length} שורות</p>
    </div>
  )
}

function formatCell(value: unknown, format?: string): React.ReactNode {
  if (value === null || value === undefined) return "—"
  switch (format) {
    case "currency": return formatCurrency(Number(value))
    case "percent": return `${Number(value)}%`
    case "number": return new Intl.NumberFormat("he-IL").format(Number(value))
    case "date": return formatDate(String(value))
    case "status": return <span className="report-status-pill">{String(value)}</span>
    default: return String(value)
  }
}

"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { SidePanel } from "@/components/shared/SidePanel"
import { cn } from "@/lib/utils"
import type { ChartType, ExportFormat, GroupByField, MetricAggregation, ReportEntity, SortDirection } from "@/lib/reports/types"

interface CreateCustomReportDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: CustomReportConfig) => void
}

export interface CustomReportConfig {
  name: string
  entity: ReportEntity
  metrics: MetricAggregation[]
  groupBy: GroupByField[]
  chartType: ChartType
  sort: SortDirection
  exportFormat: ExportFormat
}

const ENTITIES: { id: ReportEntity; label: string }[] = [
  { id: "reservations", label: "הזמנות" }, { id: "guests", label: "אורחים" }, { id: "rooms", label: "חדרים" },
  { id: "payments", label: "תשלומים" }, { id: "invoices", label: "חשבוניות" }, { id: "tasks", label: "משימות" },
  { id: "issues", label: "תקלות" }, { id: "whatsapp", label: "WhatsApp" }, { id: "suppliers", label: "ספקים" },
  { id: "employees", label: "עובדים" },
]
const METRICS: { id: MetricAggregation; label: string }[] = [
  { id: "count", label: "ספירה" }, { id: "sum", label: "סכום" }, { id: "average", label: "ממוצע" },
  { id: "min", label: "מינימום" }, { id: "max", label: "מקסימום" }, { id: "percentage", label: "אחוז" },
  { id: "ratio", label: "יחס" }, { id: "growth", label: "צמיחה" },
]
const GROUP_BY_OPTIONS: { id: GroupByField; label: string }[] = [
  { id: "day", label: "יום" }, { id: "week", label: "שבוע" }, { id: "month", label: "חודש" }, { id: "year", label: "שנה" },
  { id: "room", label: "חדר" }, { id: "room_type", label: "סוג חדר" }, { id: "building", label: "בניין" },
  { id: "floor", label: "קומה" }, { id: "country", label: "מדינה" }, { id: "city", label: "עיר" },
  { id: "guest", label: "אורח" }, { id: "employee", label: "עובד" }, { id: "channel", label: "ערוץ" },
  { id: "source", label: "מקור" }, { id: "payment_status", label: "סטטוס תשלום" }, { id: "reservation_status", label: "סטטוס הזמנה" },
]
const CHART_OPTIONS: { id: ChartType; label: string }[] = [
  { id: "table", label: "טבלה" }, { id: "bar", label: "עמודות" }, { id: "line", label: "קו" },
  { id: "stacked_bar", label: "מוערמות" }, { id: "area", label: "שטח" }, { id: "pie", label: "עוגה" }, { id: "leaderboard", label: "דירוג" },
]
const SORT_OPTIONS: { id: SortDirection; label: string }[] = [
  { id: "highest", label: "הגבוה ביותר" }, { id: "lowest", label: "הנמוך ביותר" },
  { id: "newest", label: "החדש ביותר" }, { id: "oldest", label: "הישן ביותר" },
]
const EXPORT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: "excel", label: "Excel" }, { id: "csv", label: "CSV" }, { id: "pdf", label: "PDF" },
]

export function CreateCustomReportDialog({ open, onClose, onSave }: CreateCustomReportDialogProps) {
  const [name, setName] = useState("")
  const [entity, setEntity] = useState<ReportEntity>("reservations")
  const [metrics, setMetrics] = useState<MetricAggregation[]>(["count"])
  const [groupBy, setGroupBy] = useState<GroupByField[]>(["month"])
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [sort, setSort] = useState<SortDirection>("highest")
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel")

  const toggle = <T extends string>(arr: T[], val: T, set: (v: T[]) => void) =>
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name, entity, metrics, groupBy, chartType, sort, exportFormat })
    onClose()
    setName(""); setEntity("reservations"); setMetrics(["count"]); setGroupBy(["month"])
    setChartType("bar"); setSort("highest"); setExportFormat("excel")
  }

  return (
    <SidePanel isOpen={open} onClose={onClose} title="יצירת דוח מותאם אישית" subtitle="הגדר את הפרמטרים לדוח שלך">
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="rpt-name" className="text-sm font-medium">שם הדוח</label>
          <input id="rpt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: הכנסות חודשיות לפי ערוץ" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[44px]" dir="rtl" />
        </div>

        <StepSection num={1} title="ישות ראשית">
          <ChipGrid items={ENTITIES} selected={[entity]} onToggle={(id) => setEntity(id as ReportEntity)} />
        </StepSection>
        <StepSection num={2} title="מדדים">
          <ChipGrid items={METRICS} selected={metrics} onToggle={(id) => toggle(metrics, id as MetricAggregation, setMetrics)} />
        </StepSection>
        <StepSection num={3} title="קיבוץ לפי">
          <ChipGrid items={GROUP_BY_OPTIONS} selected={groupBy} onToggle={(id) => toggle(groupBy, id as GroupByField, setGroupBy)} />
        </StepSection>
        <StepSection num={4} title="סוג תצוגה">
          <ChipGrid items={CHART_OPTIONS} selected={[chartType]} onToggle={(id) => setChartType(id as ChartType)} />
        </StepSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StepSection num={5} title="מיון">
            <ChipGrid items={SORT_OPTIONS} selected={[sort]} onToggle={(id) => setSort(id as SortDirection)} />
          </StepSection>
          <StepSection num={6} title="פורמט ייצוא">
            <ChipGrid items={EXPORT_OPTIONS} selected={[exportFormat]} onToggle={(id) => setExportFormat(id as ExportFormat)} />
          </StepSection>
        </div>

        <div className="flex flex-row-reverse items-center gap-3 border-t border-border pt-4">
          <button type="button" disabled={!name.trim() || metrics.length === 0 || groupBy.length === 0} onClick={handleSave} className="btn btn-primary">
            <Icon name="add" size="sm" />
            צור דוח
          </button>
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-accent min-h-[44px]">ביטול</button>
        </div>
      </div>
    </SidePanel>
  )
}

function StepSection({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{num}. {title}</p>
      {children}
    </div>
  )
}

function ChipGrid({ items, selected, onToggle }: { items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={cn(
          "rounded-xl border px-3 py-2 text-sm font-medium transition-colors min-h-[36px]",
          selected.includes(item.id) ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
        )}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

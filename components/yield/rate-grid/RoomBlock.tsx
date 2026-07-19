"use client"

import { Icon } from "@/components/shared/Icon"
import { RateCell } from "./RateCell"
import type {
  RateGridCell,
  RateGridField,
  RateGridRoom,
} from "@/lib/actions/rate-grid"

interface Props {
  room: RateGridRoom
  cells: RateGridCell[]
  dates: string[]
  dateColWidth: number
  labelColWidth: number
  savingCells: Set<string> // `${date}::${field}`
  onCellCommit: (
    date: string,
    field: RateGridField,
    value: number | boolean | null,
  ) => Promise<void>
  onOpenBulkForRoom: (roomId: string) => void
}

interface MetricRow {
  label: string
  field: RateGridField
  kind: "number" | "boolean"
  placeholder?: string
}

const METRIC_ROWS: MetricRow[] = [
  { label: "מחיר", field: "price", kind: "number", placeholder: "—" },
  { label: "מינימום", field: "min_nights", kind: "number", placeholder: "—" },
  { label: "מקסימום", field: "max_nights", kind: "number", placeholder: "—" },
  {
    label: "מין׳ בהגעה",
    field: "min_nights_on_arrival",
    kind: "number",
    placeholder: "—",
  },
  { label: "CTA", field: "closed_on_arrival", kind: "boolean" },
  { label: "CTD", field: "closed_on_departure", kind: "boolean" },
  { label: "סגור", field: "is_closed", kind: "boolean" },
]

export function RoomBlock({
  room,
  cells,
  dates,
  dateColWidth,
  labelColWidth,
  savingCells,
  onCellCommit,
  onOpenBulkForRoom,
}: Props) {
  const cellByDate = new Map(cells.map((c) => [c.date, c]))

  const totalWidth = labelColWidth + dates.length * dateColWidth

  return (
    <div
      className="bg-card rounded-2xl shadow-sm border border-border/20 overflow-hidden"
      style={{ width: totalWidth }}
    >
      {/* Header bar */}
      <div className="bg-primary text-primary-foreground flex items-center justify-between gap-3 px-4 py-2.5 sticky right-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="bed" size="sm" />
          <span className="text-sm font-bold truncate">
            {room.room_number}
            {room.room_name ? ` — ${room.room_name}` : ""}
          </span>
          {room.room_type_name && (
            <span className="text-[10px] font-bold opacity-80 truncate">
              · {room.room_type_name}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenBulkForRoom(room.id)}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0"
          title="עדכון קבוצתי לחדר זה"
        >
          <Icon name="edit_calendar" size="sm" />
          עדכון קבוצתי
        </button>
      </div>

      {/* Metric rows */}
      <div className="divide-y divide-border/10">
        {METRIC_ROWS.map((row) => (
          <div
            key={row.field}
            className="flex items-stretch"
            style={{ minHeight: 36 }}
          >
            {/* Metric label (sticky right column) */}
            <div
              className="sticky right-0 z-[5] bg-accent/60 border-l border-border/20 flex items-center justify-end px-3 shrink-0"
              style={{ width: labelColWidth }}
            >
              <span className="text-[11px] font-bold text-muted-foreground">
                {row.label}
              </span>
            </div>
            {/* Date cells */}
            <div className="flex">
              {dates.map((d) => {
                const cell = cellByDate.get(d)
                if (!cell) return null
                const rawValue: number | boolean | null =
                  row.kind === "number"
                    ? (cell[row.field as keyof RateGridCell] as
                        | number
                        | null)
                    : (cell[row.field as keyof RateGridCell] as boolean)
                const savingKey = `${d}::${row.field}`
                return (
                  <div
                    key={d}
                    className="border-r border-border/10 shrink-0"
                    style={{ width: dateColWidth }}
                  >
                    <RateCell
                      kind={row.kind}
                      field={row.field}
                      value={rawValue}
                      isOverride={cell.is_override}
                      saving={savingCells.has(savingKey)}
                      onCommit={(v) => onCellCommit(d, row.field, v)}
                      placeholder={row.placeholder}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

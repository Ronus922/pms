"use client"

import { Icon } from "@/components/shared/Icon"
import type {
  BulkUpdatePreview,
  BulkUpdateWarning,
} from "@/lib/types/bulk-room-update"
import { WEEKDAY_LABELS_HE } from "@/lib/types/bulk-room-update"

interface Props {
  preview: BulkUpdatePreview | null
  previewLoading: boolean
  onRunPreview: () => void
}

const FIELD_LABELS: Record<string, string> = {
  price: "מחיר",
  currency: "מטבע",
  is_closed: "זמינות",
  min_nights: "מינ' לילות",
  max_nights: "מקס' לילות",
  min_nights_on_arrival: "מינ' לילות בהגעה",
  closed_on_arrival: "סגור בהגעה",
  closed_on_departure: "סגור בעזיבה",
}

function WarningRow({ w }: { w: BulkUpdateWarning }) {
  const color =
    w.level === "error"
      ? "bg-destructive/10 text-destructive"
      : w.level === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        : "bg-accent text-muted-foreground"
  const icon =
    w.level === "error"
      ? "error"
      : w.level === "warning"
        ? "priority_high"
        : "info"
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${color}`}>
      <Icon name={icon} size="sm" />
      <span className="font-bold">{w.message}</span>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: string
}) {
  return (
    <div className="bg-card rounded-2xl p-4 flex items-center gap-3 border border-border/10">
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon name={icon} size="md" />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] text-muted-foreground font-bold">
          {label}
        </span>
        <span className="text-lg font-extrabold">{value}</span>
      </div>
    </div>
  )
}

function formatSample(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "סגור" : "פתוח"
  if (typeof value === "number") return String(value)
  return String(value)
}

export function PreviewSection({ preview, previewLoading, onRunPreview }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-white rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold">
            3
          </span>
          <h3 className="text-base font-bold font-headline">תצוגה מקדימה לפני עדכון</h3>
        </div>
        <button
          type="button"
          onClick={onRunPreview}
          disabled={previewLoading}
          className="btn btn-outline"
        >
          <Icon
            name={previewLoading ? "hourglass_empty" : "visibility"}
            size="sm"
          />
          {previewLoading ? "מחשב..." : "חשב תצוגה מקדימה"}
        </button>
      </div>

      {!preview ? (
        <div className="bg-accent/50 rounded-[20px] p-8 text-center text-xs text-muted-foreground">
          לחץ על <b>חשב תצוגה מקדימה</b> כדי לראות סיכום של השינויים לפני
          העדכון
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="חדרים נבחרים"
              value={preview.roomsCount}
              icon="bed"
            />
            <StatTile
              label="תאריכים"
              value={preview.datesCount}
              icon="calendar_month"
            />
            <StatTile
              label="רשומות שייווצרו/יעודכנו"
              value={preview.affectedRecords}
              icon="edit"
            />
            <StatTile
              label="דילוגים צפויים"
              value={preview.skippedRecords}
              icon="block"
            />
          </div>

          {/* Field summary */}
          <div className="bg-accent/50 rounded-[20px] p-5 flex flex-col gap-3">
            <div className="text-xs font-bold text-muted-foreground">
              שדות שיעודכנו
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.fieldsToUpdate.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                preview.fieldsToUpdate.map((f) => (
                  <span
                    key={f}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-bold"
                  >
                    {FIELD_LABELS[f] ?? f}
                  </span>
                ))
              )}
            </div>
            <div className="text-xs font-bold text-muted-foreground mt-2">
              ימי שבוע
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.weekdays.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                preview.weekdays.map((d) => (
                  <span
                    key={d}
                    className="bg-card px-3 py-1 rounded-full text-[11px] font-bold text-muted-foreground border border-border/20"
                  >
                    {WEEKDAY_LABELS_HE[d]}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
              {preview.warnings.slice(0, 40).map((w, idx) => (
                <WarningRow key={idx} w={w} />
              ))}
              {preview.warnings.length > 40 && (
                <div className="text-[11px] text-muted-foreground text-center">
                  ועוד {preview.warnings.length - 40} התראות
                </div>
              )}
            </div>
          )}

          {/* Preview table — desktop / stacked cards on mobile */}
          {preview.rows.length > 0 && (
            <div className="bg-accent/50 rounded-[20px] p-5">
              <div className="text-xs font-bold text-muted-foreground mb-3">
                דוגמאות ({preview.rows.length} חדרים)
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-right text-muted-foreground font-bold">
                      <th className="px-3 py-2">חדר</th>
                      <th className="px-3 py-2">מתאריך</th>
                      <th className="px-3 py-2">עד תאריך</th>
                      <th className="px-3 py-2">שדות</th>
                      <th className="px-3 py-2">ערך לדוגמה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.roomId} className="border-t border-border/10">
                        <td className="px-3 py-3 font-bold">
                          {r.roomNumber}
                          {r.roomName ? ` · ${r.roomName}` : ""}
                        </td>
                        <td className="px-3 py-3">{r.dateFrom}</td>
                        <td className="px-3 py-3">{r.dateTo}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.changedFields.map((f) => (
                              <span
                                key={f}
                                className="bg-card px-2 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground"
                              >
                                {FIELD_LABELS[f] ?? f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {Object.entries(r.sampleFinal)
                            .map(
                              ([k, v]) =>
                                `${FIELD_LABELS[k] ?? k}: ${formatSample(v)}`,
                            )
                            .join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden flex flex-col gap-3">
                {preview.rows.map((r) => (
                  <div
                    key={r.roomId}
                    className="bg-card rounded-xl p-3 border border-border/10 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {r.roomNumber}
                        {r.roomName ? ` · ${r.roomName}` : ""}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {r.dateFrom} – {r.dateTo}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.changedFields.map((f) => (
                        <span
                          key={f}
                          className="bg-accent px-2 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground"
                        >
                          {FIELD_LABELS[f] ?? f}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {Object.entries(r.sampleFinal)
                        .map(
                          ([k, v]) =>
                            `${FIELD_LABELS[k] ?? k}: ${formatSample(v)}`,
                        )
                        .join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

"use client"

/**
 * AttendanceAreasList — list mode of AttendanceAreasSidePanel.
 * ─────────────────────────────────────────────────────────────
 * Rows: name + shape summary + edit/delete buttons.
 * Row click also triggers edit (mobile-friendly per Part D decision §6).
 * Empty state with CTA to create the first area.
 *
 * For iteration 1a, the action handlers are placeholders (toast). The real
 * create/edit form arrives in iteration 1b; cascade-aware delete in iter 3.
 */

import { Icon } from "@/components/shared/Icon"
import { SHAPE_LABELS } from "@/lib/constants/attendance"
import type { AttendanceArea } from "@/lib/types/attendance"

interface AttendanceAreasListProps {
  areas: AttendanceArea[]
  loading: boolean
  onCreate: () => void
  onEdit: (area: AttendanceArea) => void
  onDelete: (area: AttendanceArea) => void
}

function formatShapeSummary(area: AttendanceArea): string {
  const label = SHAPE_LABELS[area.shape_type]
  const g = area.geometry
  if (g.type === "circle" || g.type === "point") {
    return `${label} · ${g.radius_m}m`
  }
  if (g.type === "polygon") {
    if (area.shape_type === "rectangle") return label
    return `${label} · ${g.coords.length} קודקודים`
  }
  return label
}

export function AttendanceAreasList({
  areas,
  loading,
  onCreate,
  onEdit,
  onDelete,
}: AttendanceAreasListProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header with "+ create" button */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">
          רשימת אזורים
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="btn btn-primary"
        >
          <Icon name="add" size="sm" className="text-primary-foreground" />
          אזור חדש
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Icon
            name="hourglass_empty"
            size="md"
            className="opacity-30 animate-spin"
          />
          <p className="text-sm">טוען אזורים...</p>
        </div>
      ) : areas.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-accent/40 p-8 flex flex-col items-center gap-3 text-center">
          <Icon name="map" size="xl" className="text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            אין אזורים מוגדרים
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            אזורי דיווח מאפשרים להגביל החתמת נוכחות למיקום פיזי. לחץ על
            &quot;אזור חדש&quot; כדי ליצור את הראשון.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {areas.map((area) => (
            <li key={area.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onEdit(area)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onEdit(area)
                  }
                }}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 transition-colors hover:bg-accent hover:border-primary/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                style={{ borderRightWidth: 4, borderRightColor: area.color }}
              >
                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {area.name}
                  </p>
                  {area.address && (
                    <p className="text-xs text-foreground mt-0.5 truncate">
                      {area.address}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatShapeSummary(area)}
                  </p>
                  {area.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {area.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(area)
                    }}
                    aria-label={`ערוך ${area.name}`}
                    title="ערוך אזור"
                    className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-card transition-colors"
                  >
                    <Icon name="edit" size="sm" />
                  </button>
                  {(() => {
                    const linked = area.linked_users_count ?? 0
                    const blocked = linked > 0
                    const deleteTitle = blocked
                      ? `לא ניתן למחוק — ${linked} ${linked === 1 ? "עובד משויך" : "עובדים משויכים"}`
                      : "מחק אזור"
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(area)
                        }}
                        aria-label={
                          blocked
                            ? `לא ניתן למחוק ${area.name} — משויכים עובדים`
                            : `מחק ${area.name}`
                        }
                        title={deleteTitle}
                        className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-destructive hover:bg-red-50 transition-colors"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    )
                  })()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

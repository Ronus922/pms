"use client"

/**
 * AreaSelector — dropdown of attendance areas.
 * ─────────────────────────────────────────────
 * Read-only picker: select one of the existing areas. Area creation lives
 * in the standalone `AttendanceAreasSidePanel` (opened from the /staff page),
 * not inline — so this component intentionally has no "create new" button.
 * The empty-state hint in `AttendanceTab` directs the user there.
 */

import { selectClass } from "@/components/shared/FormField"
import { SHAPE_LABELS } from "@/lib/constants/attendance"
import type { AttendanceAreaPickerItem } from "@/lib/types/attendance"

interface AreaSelectorProps {
  value: string | null
  onChange: (id: string | null) => void
  areas: AttendanceAreaPickerItem[]
  disabled?: boolean
}

export function AreaSelector({
  value,
  onChange,
  areas,
  disabled = false,
}: AreaSelectorProps) {
  const noAreas = areas.length === 0
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || noAreas}
      className={selectClass}
    >
      <option value="">
        {noAreas ? "— אין אזורים זמינים —" : "בחר אזור..."}
      </option>
      {areas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.name} ({SHAPE_LABELS[area.shape_type]})
        </option>
      ))}
    </select>
  )
}

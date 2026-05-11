"use client"

/**
 * AreaDrawingControls — shape picker (UI only, no map interaction)
 * ─────────────────────────────────────────────────────────────────
 * Renders four pill buttons (Variation 3 Subtle Card style) for selecting
 * the active drawing mode. The actual integration with
 * `google.maps.drawing.DrawingManager` lives in Part D.
 *
 * For Part B this is a controlled state component — the parent owns the
 * `activeShape` value and reacts to `onShapeSelected`.
 */

import { SHAPE_TYPES, SHAPE_LABELS, type ShapeType } from "@/lib/constants/attendance"

interface AreaDrawingControlsProps {
  activeShape: ShapeType | null
  onShapeSelected: (shape: ShapeType) => void
  /** When true, all buttons disabled (e.g. while map is loading). */
  disabled?: boolean
}

const SHAPE_ICONS: Record<ShapeType, string> = {
  rectangle: "▭",
  circle: "◯",
  polygon: "✦",
  address: "📍",
}

export function AreaDrawingControls({
  activeShape,
  onShapeSelected,
  disabled = false,
}: AreaDrawingControlsProps) {
  return (
    <div
      role="group"
      aria-label="בחירת צורת אזור"
      className="inline-flex items-center gap-1 rounded-xl bg-[#f4f2fc] p-1"
    >
      {SHAPE_TYPES.map((shape) => {
        const isActive = activeShape === shape
        return (
          <button
            key={shape}
            type="button"
            disabled={disabled}
            onClick={() => onShapeSelected(shape)}
            aria-pressed={isActive}
            className={[
              "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "bg-white text-[#1e40af] font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
                : "text-[#474747] font-medium hover:text-[#1e40af]",
            ].join(" ")}
          >
            <span aria-hidden="true">{SHAPE_ICONS[shape]}</span>
            <span>{SHAPE_LABELS[shape]}</span>
          </button>
        )
      })}
    </div>
  )
}

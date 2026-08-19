"use client"

import { BAR_HEIGHT, BAR_V_PADDING } from "./board-constants"
import type { DragState } from "./board-types"

interface PreviewLayerProps {
  drag: DragState
  totalDays: number
  /** The room row this track belongs to — preview renders only if the drag targets it. */
  roomId: string
}

/**
 * Drag preview — rendered INSIDE the target room's track (`.tl-track`), so its
 * horizontal % maps to the same column geometry as the committed bars and it
 * naturally clips to the row. Mirrors the real pill's height/geometry.
 */
export function PreviewLayer({ drag, totalDays, roomId }: PreviewLayerProps) {
  if (drag.type === "idle") return null
  const pct = (col: number) => `${(col / totalDays) * 100}%`

  const common: React.CSSProperties = {
    top: BAR_V_PADDING,
    height: BAR_HEIGHT,
  }

  if (drag.type === "create") {
    if (drag.roomId !== roomId) return null
    const lo = Math.min(drag.anchorCol, drag.currentCol)
    const hi = Math.max(drag.anchorCol, drag.currentCol) + 1
    const nights = hi - lo
    const palette = drag.invalid
      ? { bg: "rgba(244,63,94,0.14)", border: "#f43f5e", text: "#9f1239" }
      : { bg: "rgba(16,185,129,0.14)", border: "#10b981", text: "#065f46" }
    return (
      <div
        className="tl-preview"
        style={{
          ...common,
          insetInlineStart: pct(lo),
          width: pct(nights),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        {drag.invalid ? drag.reason : `${nights} לילות`}
      </div>
    )
  }

  if (drag.type === "move") {
    if (drag.targetRoomId !== roomId) return null
    const palette = drag.invalid
      ? { bg: "rgba(244,63,94,0.18)", border: "#f43f5e", text: "#9f1239" }
      : { bg: "rgba(59,130,246,0.18)", border: "#3b82f6", text: "#1e3a8a" }
    return (
      <div
        className="tl-preview"
        style={{
          ...common,
          insetInlineStart: pct(drag.targetStartCol + drag.srcStartFraction),
          width: pct(drag.srcWidthCols),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        {drag.invalid && drag.reason}
      </div>
    )
  }

  if (drag.type === "resize") {
    if (drag.roomId !== roomId) return null
    const originalEnd = drag.originalStartCol + drag.originalNights
    const newEnd = drag.newStartCol + drag.newNights
    const extending = newEnd > originalEnd
    const deltaFromCol = Math.min(originalEnd, newEnd)
    const deltaWidthCols = Math.abs(newEnd - originalEnd)
    if (deltaWidthCols === 0) return null

    const palette = drag.invalid
      ? { bg: "rgba(244,63,94,0.22)", border: "#f43f5e", text: "#9f1239" }
      : extending
        ? { bg: "rgba(34,197,94,0.20)", border: "#22c55e", text: "#15803d" }
        : { bg: "rgba(239,68,68,0.18)", border: "#ef4444", text: "#991b1b" }
    const label = drag.invalid
      ? drag.reason
      : `${extending ? "+" : "-"}${deltaWidthCols} · ${drag.newNights} לילות`
    return (
      <div
        className="tl-preview"
        style={{
          ...common,
          insetInlineStart: pct(deltaFromCol),
          width: pct(deltaWidthCols),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        {label}
      </div>
    )
  }

  return null
}

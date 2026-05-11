"use client"

import { BAR_HEIGHT, BAR_V_PADDING, ROW_HEIGHT } from "./board-constants"
import type { DragState } from "./board-types"

interface PreviewLayerProps {
  drag: DragState
  totalDays: number
  roomIdxByRoomId: Record<string, number>
}

/**
 * Preview overlay — MUST mirror the real pill's geometry so the dragged bar
 * doesn't appear to grow into adjacent cells. Same rounded-full, same 1px
 * border (via inline style for precision), box-sizing border-box so width
 * is computed from the edges.
 */
export function PreviewLayer({ drag, totalDays, roomIdxByRoomId }: PreviewLayerProps) {
  if (drag.type === "idle") return null

  const pct = (col: number) => `${(col / totalDays) * 100}%`

  const common: React.CSSProperties = {
    height: BAR_HEIGHT,
    borderWidth: 1,
    borderStyle: "solid",
    boxSizing: "border-box",
  }

  if (drag.type === "create") {
    const roomIdx = roomIdxByRoomId[drag.roomId]
    if (roomIdx == null) return null
    const lo = Math.min(drag.anchorCol, drag.currentCol)
    const hi = Math.max(drag.anchorCol, drag.currentCol) + 1
    const nights = hi - lo
    const top = roomIdx * ROW_HEIGHT + BAR_V_PADDING
    const palette = drag.invalid
      ? { bg: "rgba(244,63,94,0.14)", border: "#f43f5e", text: "#9f1239" }
      : { bg: "rgba(16,185,129,0.14)", border: "#10b981", text: "#065f46" }

    return (
      <div
        className="absolute rounded-full pointer-events-none flex items-center justify-center"
        style={{
          ...common,
          insetInlineStart: pct(lo),
          top,
          width: pct(nights),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        <span className="text-xs font-bold whitespace-nowrap">
          {drag.invalid ? drag.reason : `${nights} לילות`}
        </span>
      </div>
    )
  }

  if (drag.type === "move") {
    const roomIdx = roomIdxByRoomId[drag.targetRoomId]
    if (roomIdx == null) return null
    const top = roomIdx * ROW_HEIGHT + BAR_V_PADDING
    const palette = drag.invalid
      ? { bg: "rgba(244,63,94,0.18)", border: "#f43f5e", text: "#9f1239" }
      : { bg: "rgba(59,130,246,0.18)", border: "#3b82f6", text: "#1e3a8a" }

    // Use the source bar's captured fractional geometry so the overlay
    // is the same visible size as the bar being moved. Previously this
    // used whole `srcNights`, which made the overlay appear wider than
    // the real reservation span (visual stretch).
    return (
      <div
        className="absolute rounded-full pointer-events-none flex items-center justify-center"
        style={{
          ...common,
          insetInlineStart: pct(drag.targetStartCol + drag.srcStartFraction),
          top,
          width: pct(drag.srcWidthCols),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        {drag.invalid && (
          <span className="text-xs font-bold whitespace-nowrap">{drag.reason}</span>
        )}
      </div>
    )
  }

  if (drag.type === "resize") {
    const roomIdx = roomIdxByRoomId[drag.roomId]
    if (roomIdx == null) return null
    const top = roomIdx * ROW_HEIGHT + BAR_V_PADDING

    // Only the DELTA (the area being added or removed) is rendered as
    // preview. The committed reservation bar stays fixed and full opacity
    // in its original span — never stretches. The end edge is the only
    // resizable edge in this app (start is locked), so the original start
    // is always `originalStartCol` and the delta sits between the original
    // end and the new end.
    const originalEnd = drag.originalStartCol + drag.originalNights
    const newEnd = drag.newStartCol + drag.newNights
    const extending = newEnd > originalEnd
    const deltaFromCol = Math.min(originalEnd, newEnd)
    const deltaWidthCols = Math.abs(newEnd - originalEnd)

    // No visible drag delta yet (cursor hasn't crossed a cell boundary).
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
        className="absolute rounded-full pointer-events-none flex items-center justify-center"
        style={{
          ...common,
          insetInlineStart: pct(deltaFromCol),
          top,
          width: pct(deltaWidthCols),
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        <span className="text-[11px] font-bold whitespace-nowrap px-1">
          {label}
        </span>
      </div>
    )
  }

  return null
}

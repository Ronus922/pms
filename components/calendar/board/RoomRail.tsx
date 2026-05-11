"use client"

import { ROOM_STATUS_COLORS, ROW_HEIGHT, RAIL_WIDTH } from "./board-constants"
import type { BoardRoom, DerivedRoomStatus } from "./board-types"

interface RoomRailProps {
  rooms: BoardRoom[]
  statusByRoomId: Record<string, DerivedRoomStatus>
}

export function RoomRail({ rooms, statusByRoomId }: RoomRailProps) {
  return (
    <div
      className="sticky right-0 z-20 shrink-0 bg-card"
      style={{ width: RAIL_WIDTH, borderInlineStart: "1px solid hsl(var(--border) / 0.25)" }}
    >
      {/* Header spacer (matches day header height) */}
      <div className="h-16 border-b border-border/25 flex items-center justify-end ps-4 pe-5 bg-card/95 backdrop-blur-sm">
        <span className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wide">
          חדרים
        </span>
      </div>

      {rooms.map((room) => {
        const status = statusByRoomId[room.id] ?? "vacant_clean"
        const meta = ROOM_STATUS_COLORS[status]
        return (
          <div
            key={room.id}
            className="flex items-center gap-3 px-3 border-b border-border/15 bg-card hover:bg-accent/30 transition-colors"
            style={{ height: ROW_HEIGHT }}
          >
            {/* Inline-start (visual right in RTL): room number badge. */}
            <span className="shrink-0 tabular-nums text-[13px] font-bold text-foreground min-w-[2.25rem] text-center px-2 py-1 rounded-lg bg-accent/60">
              {room.room_number}
            </span>

            {/* Inline-end (visual left in RTL): type + status (dot + label) + floor. */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1 text-end">
              <span className="text-[12.5px] font-bold text-foreground leading-tight truncate">
                {room.room_type_name}
              </span>
              <div className="flex items-center justify-end gap-1.5 text-[10.5px] leading-none">
                {room.floor_name && (
                  <span className="text-muted-foreground/80 truncate">{room.floor_name}</span>
                )}
                {room.floor_name && (
                  <span className="text-muted-foreground/30" aria-hidden>
                    ·
                  </span>
                )}
                <span className="text-muted-foreground truncate">{meta.label}</span>
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

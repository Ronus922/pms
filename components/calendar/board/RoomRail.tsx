"use client"

import { memo } from "react"
import { RAIL_WIDTH, ROOM_STATUS_META, ROW_HEIGHT } from "./board-constants"
import type { BoardRoom, DerivedRoomStatus } from "./board-types"

/** Sticky top-right corner of the board header — matches `.tl-corner`. */
export function RailCorner({ unitsCount, floorCount }: { unitsCount: number; floorCount: number }) {
  return (
    <div className="tl-corner" style={{ width: RAIL_WIDTH }}>
      <div className="cor-title">חדרים</div>
      <div className="cor-sub">
        {unitsCount} יחידות{floorCount > 0 ? ` · ${floorCount} קומות` : ""}
      </div>
    </div>
  )
}

interface RoomCellProps {
  room: BoardRoom
  status: DerivedRoomStatus
}

/** Sticky per-row room cell — matches `.tl-roomcell` (number + type + status). */
function RoomCellInner({ room, status }: RoomCellProps) {
  const meta = ROOM_STATUS_META[status] ?? ROOM_STATUS_META.vacant_clean
  return (
    <div className="tl-roomcell" style={{ width: RAIL_WIDTH, height: ROW_HEIGHT }}>
      <span className="rc-num">{room.room_number}</span>
      <div className="min-w-0 flex-1">
        <div className="rc-type truncate">{room.room_type_name}</div>
        <div className="rc-meta">
          {room.floor_name && <span className="rc-floor truncate">{room.floor_name}</span>}
          {room.floor_name && (
            <span className="text-[var(--cb-faint)]" aria-hidden>
              ·
            </span>
          )}
          <span className={`rc-status ${meta.cls}`}>
            <span className="rc-sdot" aria-hidden />
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export const RoomCell = memo(RoomCellInner)

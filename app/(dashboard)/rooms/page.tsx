"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { RoomFormDialog } from "@/components/rooms/RoomFormDialog"
import { useRoomFormStore } from "@/lib/stores/room-form-store"
import { useRoomTypesStore } from "@/lib/stores/room-types-store"
import { RoomTypesDialog } from "@/components/rooms/RoomTypesDialog"
import { getRoomsWithDerivedStatus, type RoomWithDerivedStatus } from "@/lib/actions/rooms-status"
import { useTenant } from "@/lib/hooks/use-tenant"
import { ROOM_STATE_DISPLAY, type RoomDisplayState } from "@/lib/constants/room-display"

export default function RoomsPage() {
  const { tenantId } = useTenant()
  const roomTypesStore = useRoomTypesStore()
  const [rooms, setRooms] = useState<RoomWithDerivedStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | RoomDisplayState>("all")
  const roomFormStore = useRoomFormStore()

  const loadRooms = useCallback(async () => {
    const data = await getRoomsWithDerivedStatus(tenantId)
    setRooms(data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const filtered = statusFilter === "all" ? rooms : rooms.filter((r) => r.display_state === statusFilter)

  // Group by floor
  const grouped = new Map<string, RoomWithDerivedStatus[]>()
  for (const r of filtered) {
    const key = r.floor_name || "ללא קומה"
    const list = grouped.get(key) || []
    list.push(r)
    grouped.set(key, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold font-headline">חדרים</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full">{filtered.length} חדרים</span>
          <button
            onClick={() => roomTypesStore.open()}
            className="border border-border/40 text-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-accent transition-all flex items-center gap-2 min-h-[44px]"
          >
            <Icon name="layers" size="sm" />
            סוגי חדרים
          </button>
          <button
            onClick={() => roomFormStore.open()}
            className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-md transition-all active:scale-95 flex items-center gap-2 min-h-[44px]"
          >
            <Icon name="add" size="sm" />
            חדר חדש
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${statusFilter === "all" ? "bg-primary text-white" : "bg-card border border-border/20 text-muted-foreground hover:bg-accent"}`}>
          הכל
        </button>
        {(Object.entries(ROOM_STATE_DISPLAY) as [RoomDisplayState, typeof ROOM_STATE_DISPLAY[RoomDisplayState]][]).map(([key, { label, color }]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 ${
              statusFilter === key ? "bg-primary text-white" : "bg-card border border-border/20 text-muted-foreground hover:bg-accent"
            }`}>
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="hourglass_empty" size="xl" className="mx-auto mb-2 opacity-30" />
          <p>טוען...</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([floor, floorRooms]) => (
          <div key={floor}>
            <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <Icon name="layers" size="sm" />
              {floor}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {floorRooms.map((room) => {
                const st = ROOM_STATE_DISPLAY[room.display_state] || ROOM_STATE_DISPLAY.available
                return (
                  <div key={room.id}
                    onClick={() => roomFormStore.open(room.id)}
                    className={`bg-card rounded-[20px] p-5 shadow-sm border-r-4 hover:shadow-md transition-all cursor-pointer group ${st.border}`}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl font-extrabold">{room.room_number}</span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground mb-1">{room.room_type_name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Icon name={st.icon} size="sm" /> {st.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Icon name="group" size="sm" /> {room.max_occupancy ?? 0}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <RoomFormDialog onSaved={loadRooms} />
      <RoomTypesDialog onSaved={loadRooms} />
    </div>
  )
}

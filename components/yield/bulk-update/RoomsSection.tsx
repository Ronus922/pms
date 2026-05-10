"use client"

import { Icon } from "@/components/shared/Icon"
import type {
  BulkUpdateFormData,
  BulkUpdateRoomOption,
  BulkUpdateScope,
} from "@/lib/types/bulk-room-update"

interface RoomFilters {
  search: string
  roomTypeId: string | "all"
  buildingId: string | "all"
  floorId: string | "all"
}

interface Props {
  formData: BulkUpdateFormData | null
  filteredRooms: BulkUpdateRoomOption[]
  scope: BulkUpdateScope
  filters: RoomFilters
  setFilters: (next: RoomFilters) => void
  toggleRoom: (roomId: string) => void
  selectAllFilteredRooms: () => void
  clearRoomSelection: () => void
}

const controlClass =
  "w-full bg-accent border-0 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"

export function RoomsSection({
  formData,
  filteredRooms,
  scope,
  filters,
  setFilters,
  toggleRoom,
  selectAllFilteredRooms,
  clearRoomSelection,
}: Props) {
  const selectedSet = new Set(scope.roomIds)

  return (
    <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">חדרים</h3>
        </div>
        <span className="text-[11px] font-bold bg-accent px-3 py-1 rounded-full text-muted-foreground">
          נבחרו {scope.roomIds.length} מתוך {filteredRooms.length}
        </span>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש חדר..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className={`${controlClass} pe-10`}
          />
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
        <select
          value={filters.roomTypeId}
          onChange={(e) =>
            setFilters({ ...filters, roomTypeId: e.target.value })
          }
          className={`${controlClass} appearance-none pe-10 select-arrow cursor-pointer`}
        >
          <option value="all">כל סוגי החדרים</option>
          {formData?.roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>
        <select
          value={filters.buildingId}
          onChange={(e) =>
            setFilters({
              ...filters,
              buildingId: e.target.value,
              floorId: "all",
            })
          }
          className={`${controlClass} appearance-none pe-10 select-arrow cursor-pointer`}
        >
          <option value="all">כל הבניינים</option>
          {formData?.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={filters.floorId}
          onChange={(e) => setFilters({ ...filters, floorId: e.target.value })}
          className={`${controlClass} appearance-none pe-10 select-arrow cursor-pointer`}
        >
          <option value="all">כל הקומות</option>
          {formData?.floors
            .filter((f) =>
              filters.buildingId === "all"
                ? true
                : f.building_id === filters.buildingId,
            )
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={selectAllFilteredRooms}
          className="text-[11px] font-bold text-primary hover:underline px-2 py-1"
        >
          בחר הכל
        </button>
        <button
          type="button"
          onClick={clearRoomSelection}
          className="text-[11px] font-bold text-muted-foreground hover:underline px-2 py-1"
        >
          נקה בחירה
        </button>
      </div>

      {/* Room list */}
      <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1 pr-1">
        {filteredRooms.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            אין חדרים להצגה
          </div>
        ) : (
          filteredRooms.map((r) => {
            const selected = selectedSet.has(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRoom(r.id)}
                className={`flex items-center gap-3 p-3 rounded-xl text-right transition-colors min-h-[44px] ${
                  selected
                    ? "bg-primary/10 border border-primary/40"
                    : "bg-accent/40 border border-transparent hover:bg-accent"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-md flex items-center justify-center border-2 shrink-0 ${
                    selected
                      ? "bg-primary border-primary text-white"
                      : "border-border/40"
                  }`}
                >
                  {selected && <Icon name="done_all" size="sm" />}
                </span>
                <div className="flex-1 flex flex-col text-right">
                  <span className="text-sm font-bold">
                    {r.room_number}
                    {r.room_name ? ` · ${r.room_name}` : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {r.room_type_name ?? "—"}
                    {r.building_name ? ` · ${r.building_name}` : ""}
                    {r.floor_name ? ` · ${r.floor_name}` : ""}
                  </span>
                </div>
                {r.base_price !== null && (
                  <span className="text-[11px] font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full shrink-0">
                    ₪{r.base_price}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

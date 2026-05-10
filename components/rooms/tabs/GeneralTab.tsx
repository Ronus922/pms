"use client"

import type { RoomFormStore } from "@/lib/stores/room-form-store"

interface GeneralTabProps {
  store: RoomFormStore
  roomTypes: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string }>
  floors: Array<{ id: string; name: string; building_id: string }>
}

export function GeneralTab({ store, roomTypes, buildings, floors }: GeneralTabProps) {
  const filteredFloors = store.building_id
    ? floors.filter((f) => f.building_id === store.building_id)
    : floors

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* room_number */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">
            מספר חדר <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={store.room_number}
            onChange={(e) => store.setField("room_number", e.target.value)}
            placeholder="לדוגמה: 101"
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {store.errors.room_number && (
            <p className="text-xs text-destructive">{store.errors.room_number}</p>
          )}
        </div>

        {/* wing */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">אגף</label>
          <input
            type="text"
            value={store.wing}
            onChange={(e) => store.setField("wing", e.target.value)}
            placeholder="לדוגמה: מערבי"
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* room_type_id */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">סוג חדר</label>
          <select
            value={store.room_type_id}
            onChange={(e) => store.setField("room_type_id", e.target.value)}
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer select-arrow"
          >
            <option value="">בחר סוג חדר</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>

        {/* building_id */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">בניין</label>
          <select
            value={store.building_id}
            onChange={(e) => {
              store.setField("building_id", e.target.value)
              store.setField("floor_id", "")
            }}
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer select-arrow"
          >
            <option value="">בחר בניין</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* floor_id */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">קומה</label>
          <select
            value={store.floor_id}
            onChange={(e) => store.setField("floor_id", e.target.value)}
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer select-arrow"
          >
            <option value="">בחר קומה</option>
            {filteredFloors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* sort_order */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">סדר מיון</label>
          <input
            type="number"
            value={store.sort_order}
            onChange={(e) => store.setField("sort_order", Number(e.target.value))}
            min={0}
            className="w-full rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">חדר פעיל</p>
            <p className="text-xs text-muted-foreground">חדר פעיל יופיע במערכת ויהיה זמין לשיבוץ</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={store.is_active}
            onClick={() => store.setField("is_active", !store.is_active)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors min-w-[44px] min-h-[44px] items-center ${
              store.is_active ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                store.is_active ? "translate-x-1" : "translate-x-6"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-border/20" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">מוצג באתר</p>
            <p className="text-xs text-muted-foreground">החדר יופיע בתוצאות חיפוש ובעמוד ההזמנות</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={store.is_listed}
            onClick={() => store.setField("is_listed", !store.is_listed)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors min-w-[44px] min-h-[44px] items-center ${
              store.is_listed ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                store.is_listed ? "translate-x-1" : "translate-x-6"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

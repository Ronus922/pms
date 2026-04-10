"use client"

import { useEffect, useState } from "react"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { FormField, selectClass, textareaClass } from "@/components/shared/FormField"
import { Icon } from "@/components/shared/Icon"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { BOARD_TYPES } from "@/lib/constants/reservation"

interface RoomOption { id: string; room_number: string; status: string; room_type_id: string; room_type_name: string; max_occupancy: number; base_price: number }
interface RoomTypeOption { id: string; name: string; max_occupancy: number; base_price: number }

export function StayTab() {
  const { tenantId } = useTenant()
  const store = useReservationFormStore()
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])

  useEffect(() => {
    async function load() {
      const opts = await getFormOptions(tenantId)
      setRooms(opts.rooms as unknown as RoomOption[])
      setRoomTypes(opts.roomTypes as unknown as RoomTypeOption[])
    }
    load()
  }, [])

  const filteredRooms = store.roomTypeId
    ? rooms.filter((r) => r.room_type_id === store.roomTypeId)
    : rooms
  const availableRooms = filteredRooms.filter((r) => !["blocked", "maintenance", "unavailable"].includes(r.status))

  function handleRoomSelect(roomId: string) {
    store.setField("roomId", roomId)
    const room = rooms.find((r) => r.id === roomId)
    if (room) {
      store.setField("roomTypeId", room.room_type_id)
      if (store.pricePerNight === 0 && room.base_price > 0) store.setField("pricePerNight", Number(room.base_price))
    }
  }

  function handleRoomTypeSelect(typeId: string) {
    store.setField("roomTypeId", typeId)
    store.setField("roomId", "")
    const rt = roomTypes.find((t) => t.id === typeId)
    if (rt && store.pricePerNight === 0 && rt.base_price > 0) store.setField("pricePerNight", Number(rt.base_price))
  }

  return (
    <div className="space-y-8">
      {/* Room & Board */}
      <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
            <Icon name="bed" />
          </div>
          <h2 className="text-xl font-bold font-headline">חדר ואירוח</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <FormField label="סוג חדר" error={store.errors.roomTypeId}>
            <select className={selectClass} value={store.roomTypeId}
              onChange={(e) => handleRoomTypeSelect(e.target.value)}>
              <option value="">בחר סוג חדר...</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name} (עד {rt.max_occupancy} אורחים)</option>
              ))}
            </select>
          </FormField>

          <FormField label="חדר" error={store.errors.roomId}>
            <select className={selectClass} value={store.roomId}
              onChange={(e) => handleRoomSelect(e.target.value)}>
              <option value="">הקצאה אוטומטית</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>{r.room_number} — {r.room_type_name}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <FormField label="בסיס אירוח">
            <select className={selectClass} value={store.boardType}
              onChange={(e) => store.setField("boardType", e.target.value)}>
              {BOARD_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </FormField>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={store.accessible}
                onChange={(e) => store.setField("accessible", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
              <Icon name="accessible" size="sm" className="text-muted-foreground" />
              <span className="text-sm font-medium">חדר נגיש</span>
            </label>
          </div>
        </div>

        <FormField label="בקשות מיוחדות">
          <textarea className={textareaClass} rows={3} value={store.specialRequests}
            onChange={(e) => store.setField("specialRequests", e.target.value)}
            placeholder="לדוגמה: יום הולדת ה-10, נא לסדר בלונים בחדר..." />
        </FormField>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { useReservationFormStore, type ReservationRoom } from "@/lib/stores/reservation-form-store"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { BOARD_TYPES, BOARD_TYPE_LABELS } from "@/lib/constants/reservation"

/* ── Types ──────────────────────────────────────────────────── */

interface RoomOption {
  id: string
  room_number: string
  status: string
  room_type_id: string
  room_type_name: string
  max_occupancy: number
  base_price: number
}

interface RoomTypeOption {
  id: string
  name: string
  max_occupancy: number
  base_price: number
}

/* ── Helpers ────────────────────────────────────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon name={icon} size="md" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ── Room Card ──────────────────────────────────────────────── */

function RoomCard({
  room,
  roomData,
  roomTypeName,
  onUpdate,
  onRemove,
}: {
  room: ReservationRoom
  roomData: RoomOption | undefined
  roomTypeName: string
  onUpdate: (updates: Partial<ReservationRoom>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="bg-card rounded-xl border border-border/20 p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        {/* Room visual placeholder */}
        <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
          <Icon name="bed" size="lg" className="text-muted-foreground/50" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Room number badge */}
            {roomData && (
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-xs font-bold tabular-nums">
                {roomData.room_number}
              </span>
            )}
            {/* Room type */}
            <span className="text-sm font-bold text-foreground truncate">
              {roomTypeName || "סוג חדר לא ידוע"}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Board type pill */}
            <span className="bg-accent text-muted-foreground px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              {BOARD_TYPE_LABELS[room.boardType] || room.boardType}
            </span>
            {/* Rate */}
            <span className="text-sm font-bold text-foreground tabular-nums">
              {formatCurrency(room.ratePerNight)}
              <span className="text-xs text-muted-foreground font-normal mr-0.5"> / לילה</span>
            </span>
          </div>

          {/* Guest info */}
          {(room.guestFirstName || room.guestLastName) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="person" size="sm" className="text-muted-foreground/60" />
              {room.guestFirstName} {room.guestLastName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors min-w-[44px] min-h-[44px]"
            title="עריכה"
          >
            <Icon name="edit" size="sm" className="text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors min-w-[44px] min-h-[44px]"
            title="הסרה"
          >
            <Icon name="trash" size="sm" className="text-destructive" />
          </button>
        </div>
      </div>

      {/* Inline Edit Form */}
      {editing && (
        <div className="mt-4 pt-4 border-t border-border/10 space-y-4">
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="בסיס אירוח">
              <select
                className={selectClass}
                value={room.boardType}
                onChange={(e) => onUpdate({ boardType: e.target.value })}
              >
                {BOARD_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="מחיר ללילה">
              <input
                type="number"
                className={inputClass}
                value={room.ratePerNight || ""}
                onChange={(e) => onUpdate({ ratePerNight: Number(e.target.value) || 0 })}
                dir="ltr"
                min={0}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="שם פרטי אורח">
              <input
                type="text"
                className={inputClass}
                value={room.guestFirstName}
                onChange={(e) => onUpdate({ guestFirstName: e.target.value })}
                placeholder="שם פרטי"
              />
            </FormField>
            <FormField label="שם משפחה אורח">
              <input
                type="text"
                className={inputClass}
                value={room.guestLastName}
                onChange={(e) => onUpdate({ guestLastName: e.target.value })}
                placeholder="שם משפחה"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="טלפון אורח">
              <input
                type="tel"
                className={inputClass}
                value={room.guestPhone}
                onChange={(e) => onUpdate({ guestPhone: e.target.value })}
                dir="ltr"
                placeholder="050-000-0000"
              />
            </FormField>
            <FormField label="אימייל אורח">
              <input
                type="email"
                className={inputClass}
                value={room.guestEmail}
                onChange={(e) => onUpdate({ guestEmail: e.target.value })}
                dir="ltr"
                placeholder="guest@email.com"
              />
            </FormField>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold min-h-[44px] hover:bg-primary/90 transition-colors"
            >
              סגור עריכה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Available Room Picker Card ─────────────────────────────── */

function AvailableRoomCard({
  room,
  onSelect,
}: {
  room: RoomOption
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-card rounded-xl border border-border/20 p-4 text-right hover:border-primary/40 hover:shadow-sm transition-all group min-h-[44px]"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <span className="text-primary text-sm font-bold tabular-nums">{room.room_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{room.room_type_name}</p>
          <p className="text-xs text-muted-foreground">
            עד {room.max_occupancy} אורחים
          </p>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="text-sm font-bold text-foreground tabular-nums">
            {formatCurrency(room.base_price)}
          </p>
          <p className="text-[11px] text-muted-foreground">ללילה</p>
        </div>
      </div>
    </button>
  )
}

/* ── Main Component ─────────────────────────────────────────── */

export function Step2Stay() {
  const { tenantId } = useTenant()
  const store = useReservationFormStore()

  const [allRooms, setAllRooms] = useState<RoomOption[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])
  const [loading, setLoading] = useState(true)

  // Add Room panel state
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [roomSearch, setRoomSearch] = useState("")
  const [roomTypeFilter, setRoomTypeFilter] = useState("")

  /* ── Load room options ─────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const opts = await getFormOptions(tenantId)
      if (cancelled) return
      setAllRooms(opts.rooms as unknown as RoomOption[])
      setRoomTypes(opts.roomTypes as unknown as RoomTypeOption[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  /* ── Derived: available rooms for picker ───────────────────── */

  const availableRooms = useMemo(() => {
    const hiddenStatuses = ["blocked", "maintenance", "unavailable"]
    const alreadySelectedIds = new Set(store.rooms.map((r) => r.roomId))

    return allRooms
      .filter((r) => !hiddenStatuses.includes(r.status))
      .filter((r) => !alreadySelectedIds.has(r.id))
      .filter((r) => {
        if (roomTypeFilter && r.room_type_id !== roomTypeFilter) return false
        if (roomSearch && !r.room_number.includes(roomSearch)) return false
        return true
      })
  }, [allRooms, store.rooms, roomTypeFilter, roomSearch])

  /* ── Room type name lookup ─────────────────────────────────── */

  function getRoomTypeName(typeId: string): string {
    const rt = roomTypes.find((t) => t.id === typeId)
    return rt?.name || ""
  }

  function getRoomData(roomId: string): RoomOption | undefined {
    return allRooms.find((r) => r.id === roomId)
  }

  /* ── Add room handler ──────────────────────────────────────── */

  function handleAddRoom(room: RoomOption) {
    const newRoom: ReservationRoom = {
      id: Date.now().toString(),
      roomId: room.id,
      roomTypeId: room.room_type_id,
      boardType: "room_only",
      ratePerNight: Number(room.base_price) || 0,
      guestFirstName: store.firstName,
      guestLastName: store.lastName,
      guestPhone: store.phone,
      guestEmail: store.email,
      guestIdNumber: store.idNumber,
    }
    store.addRoom(newRoom)
    setShowRoomPicker(false)
    setRoomSearch("")
    setRoomTypeFilter("")
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Section 1: Stay Dates */}
      <SectionCard title="פרטי שהות" icon="calendar_today">
        <div className="grid grid-cols-3 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="תאריך כניסה" required error={store.errors.checkIn}>
            <div className="relative">
              <input
                type="date"
                className={inputClass}
                value={store.checkIn}
                onChange={(e) => store.setField("checkIn", e.target.value)}
              />
              <Icon
                name="calendar_month"
                size="sm"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </FormField>

          <FormField label="תאריך יציאה" required error={store.errors.checkOut}>
            <div className="relative">
              <input
                type="date"
                className={inputClass}
                value={store.checkOut}
                onChange={(e) => store.setField("checkOut", e.target.value)}
              />
              <Icon
                name="calendar_month"
                size="sm"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </FormField>

          <FormField label="לילות">
            <div className="w-full bg-accent rounded-xl px-5 py-3.5 min-h-[48px] flex items-center justify-center gap-2">
              <Icon name="dark_mode" size="sm" className="text-primary/60" />
              <span className="text-sm font-bold tabular-nums">
                {store.nights > 0 ? store.nights : "—"}
              </span>
              {store.nights > 0 && (
                <span className="text-xs text-muted-foreground">לילות</span>
              )}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="שעת כניסה">
            <input
              type="time"
              className={inputClass}
              value={store.checkInTime}
              onChange={(e) => store.setField("checkInTime", e.target.value)}
            />
          </FormField>
          <FormField label="שעת יציאה">
            <input
              type="time"
              className={inputClass}
              value={store.checkOutTime}
              onChange={(e) => store.setField("checkOutTime", e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={store.earlyCheckIn}
              onChange={(e) => store.setField("earlyCheckIn", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <Icon name="login" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">כניסה מוקדמת</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={store.lateCheckOut}
              onChange={(e) => store.setField("lateCheckOut", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <Icon name="logout" size="sm" className="text-muted-foreground" />
            <span className="text-sm font-medium">יציאה מאוחרת</span>
          </label>
        </div>
      </SectionCard>

      {/* Section 2: Guest Composition */}
      <SectionCard title="הרכב אורחים" icon="group">
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <NumberStepper
            label="מבוגרים"
            value={store.adults}
            min={1}
            max={10}
            onChange={(v) => store.setField("adults", v)}
          />
          <NumberStepper
            label="ילדים"
            value={store.children}
            min={0}
            max={10}
            onChange={(v) => store.setField("children", v)}
          />
          <NumberStepper
            label="תינוקות"
            value={store.infants}
            min={0}
            max={5}
            onChange={(v) => store.setField("infants", v)}
          />
        </div>
      </SectionCard>

      {/* Section 3: Reservation Details */}
      <SectionCard title="פרטי הזמנה" icon="book_online">
        <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
          <FormField label="מספר הזמנה חיצוני">
            <input
              type="text"
              className={inputClass}
              value={store.externalId}
              onChange={(e) => store.setField("externalId", e.target.value)}
              dir="ltr"
              placeholder="מספר מ-Booking/Expedia..."
            />
          </FormField>

          <FormField label="מקור הזמנה">
            {store.source ? (
              <div className="w-full bg-accent rounded-xl px-5 py-3.5 min-h-[48px] flex items-center">
                <SourceBadge value={store.source} size="md" />
                <span className="text-xs text-muted-foreground mr-auto">נבחר בשלב הקודם</span>
              </div>
            ) : (
              <div className="w-full bg-accent rounded-xl px-5 py-3.5 min-h-[48px] flex items-center text-sm text-muted-foreground">
                לא נבחר מקור
              </div>
            )}
          </FormField>
        </div>

        <div className="mb-4">
          <FormField label="בקשות מיוחדות">
            <textarea
              className={textareaClass}
              rows={3}
              value={store.specialRequests}
              onChange={(e) => store.setField("specialRequests", e.target.value)}
              placeholder="אלרגיות, אירועים, העדפות..."
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={store.accessible}
            onChange={(e) => store.setField("accessible", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
          />
          <Icon name="accessible" size="sm" className="text-muted-foreground" />
          <span className="text-sm font-medium">חדר נגיש</span>
        </label>
      </SectionCard>

      {/* Section 4: Rooms */}
      <SectionCard title="חדרים" icon="bed">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Icon name="hourglass_empty" size="sm" className="animate-spin" />
            <span className="text-sm">טוען חדרים...</span>
          </div>
        ) : store.rooms.length === 0 && !showRoomPicker ? (
          /* ── Empty State ──────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
              <Icon name="bed" size="xl" className="text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-foreground">לא נבחרו חדרים</p>
              <p className="text-xs text-muted-foreground">הוסיפו חדר אחד או יותר להזמנה</p>
            </div>
            <button
              type="button"
              onClick={() => setShowRoomPicker(true)}
              className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold min-h-[44px] hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Icon name="add" size="sm" />
              הוסף חדר
            </button>
          </div>
        ) : (
          /* ── Room List ────────────────────────────────────────── */
          <div className="space-y-3">
            {store.rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                roomData={getRoomData(room.roomId)}
                roomTypeName={getRoomTypeName(room.roomTypeId)}
                onUpdate={(updates) => store.updateRoom(room.id, updates)}
                onRemove={() => store.removeRoom(room.id)}
              />
            ))}

            {/* Add room button (when rooms exist) */}
            {!showRoomPicker && (
              <button
                type="button"
                onClick={() => setShowRoomPicker(true)}
                className="w-full border-2 border-dashed border-border/30 rounded-xl py-3 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                <Icon name="add" size="sm" />
                הוסף חדר נוסף
              </button>
            )}
          </div>
        )}

        {/* ── Room Picker Panel ─────────────────────────────────── */}
        {showRoomPicker && (
          <div className="mt-4 bg-accent/50 rounded-xl border border-border/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">בחירת חדר</h4>
              <button
                type="button"
                onClick={() => {
                  setShowRoomPicker(false)
                  setRoomSearch("")
                  setRoomTypeFilter("")
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card transition-colors min-w-[44px] min-h-[44px]"
              >
                <Icon name="close" size="sm" className="text-muted-foreground" />
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div className="relative">
                <input
                  type="text"
                  className={inputClass}
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="חפש לפי מספר חדר..."
                />
                <Icon
                  name="search"
                  size="sm"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
              <select
                className={selectClass}
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
              >
                <option value="">כל סוגי החדרים</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>

            {/* Available rooms grid */}
            {availableRooms.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  {allRooms.length === 0
                    ? "אין חדרים מוגדרים במערכת"
                    : "אין חדרים זמינים בסינון הנוכחי"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto max-sm:grid-cols-1">
                {availableRooms.map((room) => (
                  <AvailableRoomCard
                    key={room.id}
                    room={room}
                    onSelect={() => handleAddRoom(room)}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              {availableRooms.length} חדרים זמינים
            </p>
          </div>
        )}

        {/* Error messages */}
        {store.errors.roomId && (
          <p className="text-[11px] text-destructive mt-2 flex items-center gap-1">
            <Icon name="error" size="sm" />
            {store.errors.roomId}
          </p>
        )}
      </SectionCard>
    </div>
  )
}

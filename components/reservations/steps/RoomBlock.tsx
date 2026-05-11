"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { DateInput } from "@/components/shared/DateInput"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { type ReservationRoom } from "@/lib/stores/reservation-form-store"
import { getAvailableRooms } from "@/lib/actions/create-reservation"
import { BOARD_TYPES, BOARD_TYPE_LABELS } from "@/lib/constants/reservation"
import { seedDefaultAdults } from "@/lib/utils/room-capacity"

/* ── Types ──────────────────────────────────────────────────── */

export interface RoomOption {
  id: string
  room_number: string
  status: string
  room_type_id: string
  room_type_name: string
  max_occupancy: number
  default_occupancy: number
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
  base_price: number
  extra_person_price: number
}

export interface RoomTypeOption {
  id: string
  name: string
  max_occupancy: number
  default_occupancy: number
  base_price: number
  extra_person_price: number
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ── Selected-room summary chip ─────────────────────────────── */

function SelectedRoomSummary({
  room,
  onChange,
}: {
  room: ReservationRoom
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-4 bg-accent/50 rounded-xl border border-border/20 p-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon name="bed" size="md" className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">
          {room.roomTypeName || "חדר"} {room.roomNumber ? `· חדר ${room.roomNumber}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {BOARD_TYPE_LABELS[room.boardType] || room.boardType} · {formatCurrency(room.ratePerNight)} / לילה
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="btn btn-outline"
      >
        החלף חדר
      </button>
    </div>
  )
}

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
          <p className="text-xs text-muted-foreground">עד {room.max_occupancy} אורחים</p>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(room.base_price)}</p>
          <p className="text-[11px] text-muted-foreground">ללילה</p>
        </div>
      </div>
    </button>
  )
}

/* ── RoomBlock — controlled per-room editor ─────────────────── */

export interface RoomBlockProps {
  block: ReservationRoom
  index: number
  canRemove: boolean
  /** All room-ids already selected across sibling blocks — filtered out of
   *  the picker grid so a single room is never reserved twice in one form. */
  selectedRoomIds: Set<string>
  roomTypes: RoomTypeOption[]
  tenantId: string
  /** In edit mode — exclude the reservation being edited from availability
   *  checks (its own rows should not count as overlap). */
  excludeReservationId?: string
  /** Check-in minimum. "today" for new reservations, empty for edit (allow
   *  historical / past dates). */
  minCheckInDate?: string | "today"
  /** Placeholders for per-room guest fields when the user hasn't entered one. */
  mainFirstNamePlaceholder?: string
  mainLastNamePlaceholder?: string
  /** When true, the per-room guest override grid (name/phone/email/id) is
   *  hidden. Used for the PRIMARY block (index 0) because that room inherits
   *  the main guest captured above in the form. Board type stays visible. */
  hideGuestOverride?: boolean
  onChange: (partial: Partial<ReservationRoom>) => void
  onRemove: () => void
}

export function RoomBlock({
  block,
  index,
  canRemove,
  selectedRoomIds,
  roomTypes,
  tenantId,
  excludeReservationId,
  minCheckInDate,
  mainFirstNamePlaceholder,
  mainLastNamePlaceholder,
  hideGuestOverride = false,
  onChange,
  onRemove,
}: RoomBlockProps) {
  const [allRooms, setAllRooms] = useState<RoomOption[]>([])
  const [loading, setLoading] = useState(false)
  const [roomSearch, setRoomSearch] = useState("")
  const [roomTypeFilter, setRoomTypeFilter] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Load available rooms for this block's date range (debounced). */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!block.checkIn || !block.checkOut || block.checkOut <= block.checkIn) {
        setAllRooms([])
        return
      }
      setLoading(true)
      const rooms = await getAvailableRooms(
        tenantId,
        block.checkIn,
        block.checkOut,
        excludeReservationId,
      )
      setAllRooms(rooms as unknown as RoomOption[])
      setLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [tenantId, block.checkIn, block.checkOut, excludeReservationId])

  const totalGuests = (block.adults || 0) + (block.children || 0)
  const totalInfants = block.infants || 0

  const availableRooms = useMemo(() => {
    return allRooms
      .filter((r) => r.id === block.roomId || !selectedRoomIds.has(r.id))
      .filter((r) => {
        if (totalGuests > 0 && (Number(r.max_occupancy) || 0) < totalGuests) return false
        if (totalInfants > 0 && (Number(r.max_infants) || 0) < totalInfants) return false
        if (roomTypeFilter && r.room_type_id !== roomTypeFilter) return false
        if (roomSearch && !r.room_number.includes(roomSearch)) return false
        return true
      })
  }, [allRooms, selectedRoomIds, totalGuests, totalInfants, roomTypeFilter, roomSearch, block.roomId])

  function updateField<K extends keyof ReservationRoom>(field: K, value: ReservationRoom[K]) {
    onChange({ [field]: value } as Partial<ReservationRoom>)
  }

  function clearSelectedRoom() {
    onChange({
      roomId: "",
      roomNumber: "",
      roomTypeId: "",
      roomTypeName: "",
      basePrice: 0,
      defaultOccupancy: 1,
      extraPersonPrice: 0,
      maxOccupancy: 0,
      maxAdults: 0,
      maxChildren: 0,
      maxInfants: 0,
      ratePerNight: 0,
    })
  }

  function pickRoom(r: RoomOption) {
    const defaultOcc = seedDefaultAdults(r)
    const basePrice = Number(r.base_price) || 0
    const extraPrice = Number(r.extra_person_price) || 0
    const adults = block.adults || defaultOcc
    onChange({
      roomId: r.id,
      roomNumber: r.room_number,
      roomTypeId: r.room_type_id,
      roomTypeName: r.room_type_name,
      boardType: block.boardType || "room_only",
      basePrice,
      defaultOccupancy: defaultOcc,
      extraPersonPrice: extraPrice,
      maxOccupancy: Math.max(1, Number(r.max_occupancy) || 1),
      maxAdults: Math.max(0, Number(r.max_adults ?? r.max_occupancy) || 0),
      maxChildren: Math.max(0, Number(r.max_children) || 0),
      maxInfants: Math.max(0, Number(r.max_infants) || 0),
      adults,
    })
  }

  return (
    <div className="bg-accent/40 rounded-[20px] border border-border/20 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
            {index + 1}
          </div>
          <h4 className="text-sm font-bold text-foreground">חדר {index + 1}</h4>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors min-w-[44px] min-h-[44px]"
            title="הסר חדר"
            aria-label="הסר חדר"
          >
            <Icon name="trash" size="sm" className="text-destructive" />
          </button>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <FormField label="תאריך כניסה" required>
          <DateInput
            value={block.checkIn}
            onChange={(v) => updateField("checkIn", v)}
            minDate={minCheckInDate}
          />
        </FormField>
        <FormField label="תאריך יציאה" required>
          <DateInput
            value={block.checkOut}
            onChange={(v) => updateField("checkOut", v)}
            minDate={block.checkIn || minCheckInDate}
          />
        </FormField>
        <FormField label="לילות">
          <div className="w-full bg-card rounded-xl px-5 py-3.5 min-h-[48px] flex items-center justify-center gap-2 border border-border/20">
            <Icon name="dark_mode" size="sm" className="text-primary/60" />
            <span className="text-sm font-bold tabular-nums">
              {block.checkIn && block.checkOut && block.checkOut > block.checkIn
                ? Math.round(
                    (new Date(block.checkOut).getTime() - new Date(block.checkIn).getTime()) /
                      86400000,
                  )
                : "—"}
            </span>
          </div>
        </FormField>
      </div>

      {/* Composition */}
      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <NumberStepper
          label="מבוגרים"
          value={block.adults}
          min={1}
          max={block.maxAdults || 20}
          onChange={(v) => updateField("adults", v)}
        />
        <NumberStepper
          label="ילדים"
          value={block.children}
          min={0}
          max={block.maxChildren || 20}
          onChange={(v) => updateField("children", v)}
        />
        <NumberStepper
          label="תינוקות"
          value={block.infants}
          min={0}
          max={block.maxInfants || 20}
          onChange={(v) => updateField("infants", v)}
        />
      </div>

      {/* Per-room guest overrides — hidden for the PRIMARY block because the
          main guest captured at the top of the form represents room 1. Board
          type stays visible either way. */}
      {!hideGuestOverride && (
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label="שם פרטי אורח (לא חובה)">
            <input
              type="text"
              value={block.guestFirstName}
              onChange={(e) => updateField("guestFirstName", e.target.value)}
              placeholder={mainFirstNamePlaceholder || "שם פרטי"}
              className={inputClass}
            />
          </FormField>
          <FormField label="שם משפחה אורח (לא חובה)">
            <input
              type="text"
              value={block.guestLastName}
              onChange={(e) => updateField("guestLastName", e.target.value)}
              placeholder={mainLastNamePlaceholder || "שם משפחה"}
              className={inputClass}
            />
          </FormField>
          <FormField label="טלפון (לא חובה)">
            <div className="relative">
              <input
                type="tel"
                value={block.guestPhone}
                onChange={(e) => updateField("guestPhone", e.target.value)}
                placeholder="050-0000000"
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none">
                <Icon name="phone" size="sm" />
              </div>
            </div>
          </FormField>
          <FormField label="אימייל (לא חובה)">
            <div className="relative">
              <input
                type="email"
                value={block.guestEmail}
                onChange={(e) => updateField("guestEmail", e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className={`${inputClass} pe-12 text-start`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none">
                <Icon name="email" size="sm" />
              </div>
            </div>
          </FormField>
          <FormField label="ת.ז / דרכון (לא חובה)">
            <div className="relative">
              <input
                type="text"
                value={block.guestIdNumber}
                onChange={(e) => updateField("guestIdNumber", e.target.value)}
                placeholder="מספר מזהה"
                dir="ltr"
                className={`${inputClass} pe-12 text-start tabular-nums`}
              />
              <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none">
                <Icon name="badge" size="sm" />
              </div>
            </div>
          </FormField>
          <FormField label="בסיס אירוח">
            <select
              value={block.boardType}
              onChange={(e) => updateField("boardType", e.target.value)}
              className={selectClass}
            >
              {BOARD_TYPES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      {/* Board type always visible — per-room setting regardless of guest fields. */}
      {hideGuestOverride && (
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label="בסיס אירוח">
            <select
              value={block.boardType}
              onChange={(e) => updateField("boardType", e.target.value)}
              className={selectClass}
            >
              {BOARD_TYPES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      {/* Room selection */}
      <div className="pt-2 border-t border-border/20">
        {block.roomId ? (
          <SelectedRoomSummary room={block} onChange={clearSelectedRoom} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground">
                חדרים זמינים {totalGuests > 0 ? `ל-${totalGuests} אורחים` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {availableRooms.length} חדרים
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div className="relative">
                <input
                  type="text"
                  className={inputClass}
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="חפש לפי מספר חדר..."
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

            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                <span className="text-sm">טוען חדרים...</span>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="text-center py-6 bg-card rounded-xl border border-dashed border-border/30">
                <p className="text-sm text-muted-foreground">
                  {allRooms.length === 0
                    ? "בחר תאריכים כדי לראות חדרים זמינים"
                    : totalGuests > 0
                      ? `אין חדרים זמינים עבור ${totalGuests} אורחים בתאריכים אלה`
                      : "אין חדרים זמינים בסינון הנוכחי"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto max-sm:grid-cols-1">
                {availableRooms.map((r) => (
                  <AvailableRoomCard key={r.id} room={r} onSelect={() => pickRoom(r)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useCalendarStore, type CalendarView } from "@/lib/stores/calendar-store"
import { getCalendarData, moveReservation } from "@/lib/actions/calendar"
import { CalendarNavigation } from "./CalendarNavigation"
import { ReservationPanel } from "./ReservationPanel"
import { ReservationModal } from "@/components/reservations/ReservationModal"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { Icon } from "@/components/shared/Icon"
import { getRoomStateHex } from "@/lib/constants/room-display"

interface Room {
  id: string
  room_number: string
  room_type_id: string
  room_type_name: string
  floor_name: string
  status: string
  base_price: number
  max_occupancy: number
}

interface RateOverride {
  room_type_id: string
  date_from: string | Date
  date_to: string | Date
  price: number
  min_nights: number | null
  stop_sell: boolean
  reason: string | null
}

interface Reservation {
  id: string
  reservation_number: string
  status: string
  check_in: string | Date
  check_out: string | Date
  full_name: string
  source: string
  is_vip: boolean
  guest_vip: boolean
  payment_status: string
  adults: number
  children: number
  room_id: string
}

function getDays(view: CalendarView): number {
  return view === "week" ? 7 : view === "two-weeks" ? 14 : 28
}

const HEB_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
const HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toDate(v: string | Date): Date {
  const d = typeof v === "string" ? new Date(v + "T00:00:00") : new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isWeekend(d: Date) { return d.getDay() === 5 || d.getDay() === 6 }

// Room status color — now uses the single source of truth in lib/constants/room-display.ts
const getRoomStatusColor = getRoomStateHex

function diffDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function ribbonCls(res: Reservation): string {
  if (res.is_vip || res.guest_vip) return "ribbon-vip"
  if (res.status === "checked_in") return "ribbon-confirmed"
  if (res.status === "checked_out") return "ribbon-checked-out"
  if (res.payment_status === "fully_paid") return "ribbon-paid"
  if (res.payment_status === "unpaid") return "ribbon-pending"
  if (res.status === "confirmed") return "ribbon-confirmed"
  return "ribbon-draft"
}

interface CalendarGridProps {
  tenantId: string
}

export function CalendarGrid({ tenantId }: CalendarGridProps) {
  const { startDate, view } = useCalendarStore()
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [rateOverrides, setRateOverrides] = useState<RateOverride[]>([])
  const [currency, setCurrency] = useState("ILS")
  const [loading, setLoading] = useState(true)
  const [selectedResId, setSelectedResId] = useState<string | null>(null)
  const [draggedRes, setDraggedRes] = useState<Reservation | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    res: Reservation
    newRoomId: string
    newCheckIn: string
    newCheckOut: string
    type: string
    targetRoomNumber?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const openNewReservation = useReservationFormStore((s) => s.open)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Force cursor override during drag — inject <style> tag to beat @dnd-kit inline styles
  useEffect(() => {
    if (!draggedRes) return
    const style = document.createElement("style")
    style.textContent = "* { cursor: ew-resize !important; }"
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [draggedRes])

  function handleDragStart(event: DragStartEvent) {
    const res = event.active.data.current?.reservation as Reservation | undefined
    if (res) setDraggedRes(res)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedRes(null)
    const { active, over } = event
    if (!over) return

    const res = active.data.current?.reservation as Reservation | undefined
    const dragType = (active.data.current?.type as string) || "move"
    const dropData = over.data.current as { roomId: string; dateStr: string } | undefined
    if (!res || !dropData) return

    const oldCheckIn = toDate(res.check_in)
    const oldCheckOut = toDate(res.check_out)

    let newCheckIn: string
    let newCheckOut: string
    let newRoomId: string

    if (dragType === "resize") {
      newCheckIn = toStr(oldCheckIn)
      newRoomId = res.room_id
      const dropDate = new Date(dropData.dateStr + "T00:00:00")
      dropDate.setDate(dropDate.getDate() + 1)
      newCheckOut = toStr(dropDate)
      if (newCheckOut <= newCheckIn) return
    } else {
      const nights = diffDays(oldCheckIn, oldCheckOut)
      newCheckIn = dropData.dateStr
      const d = new Date(newCheckIn + "T00:00:00")
      d.setDate(d.getDate() + nights)
      newCheckOut = toStr(d)
      newRoomId = dropData.roomId
    }

    if (newCheckIn === toStr(oldCheckIn) && newCheckOut === toStr(oldCheckOut) && newRoomId === res.room_id) return

    // Client-side overlap check before showing confirmation
    if (wouldOverlap(res.id, newRoomId, newCheckIn, newCheckOut)) {
      setDragError("לא ניתן להאריך את ההזמנה – קיימת הזמנה נוספת בתאריכים המבוקשים")
      setTimeout(() => setDragError(null), 4000)
      return
    }

    // Find target room number for display
    const targetRoom = rooms.find((r) => r.id === newRoomId)

    setConfirmDialog({
      res,
      newRoomId,
      newCheckIn,
      newCheckOut,
      type: dragType,
      targetRoomNumber: targetRoom?.room_number,
    })
  }

  async function confirmMove() {
    if (!confirmDialog) return
    setSaving(true)
    setDragError(null)
    const result = await moveReservation(
      tenantId,
      confirmDialog.res.id,
      confirmDialog.newRoomId,
      confirmDialog.newCheckIn,
      confirmDialog.newCheckOut,
    )
    setSaving(false)
    setConfirmDialog(null)
    if (result.success) {
      loadData()
    } else {
      setDragError(result.error || "שגיאה בהעברה")
      setTimeout(() => setDragError(null), 4000)
    }
  }

  const days = getDays(view)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = useMemo(() => {
    const r: Date[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      r.push(d)
    }
    return r
  }, [startDate, days])

  const loadData = useCallback(async () => {
    setLoading(true)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + days)
    const data = await getCalendarData(tenantId, toStr(startDate), toStr(endDate))
    setRooms(data.rooms as unknown as Room[])
    setReservations(data.reservations as unknown as Reservation[])
    setRateOverrides(data.rateOverrides as unknown as RateOverride[])
    setCurrency(data.currency || "ILS")
    setLoading(false)
  }, [tenantId, startDate, days])

  useEffect(() => { loadData() }, [loadData])

  const reservationsByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const res of reservations) {
      const list = map.get(res.room_id) || []
      list.push(res)
      map.set(res.room_id, list)
    }
    return map
  }, [reservations])

  /** For a given reservation, find the earliest check_in of the NEXT reservation in the same room.
   *  Returns null if there's no following reservation (unlimited extend). */
  function getMaxExtendDate(res: Reservation): string | null {
    const roomRes = reservationsByRoom.get(res.room_id) || []
    const coDate = toDate(res.check_out)
    let earliest: Date | null = null
    for (const other of roomRes) {
      if (other.id === res.id) continue
      const otherCi = toDate(other.check_in)
      if (otherCi >= coDate) {
        if (!earliest || otherCi < earliest) earliest = otherCi
      }
    }
    return earliest ? toStr(earliest) : null
  }

  /** Check if moving/resizing a reservation to new dates would overlap with any other reservation in that room */
  function wouldOverlap(resId: string, roomId: string, newCheckIn: string, newCheckOut: string): boolean {
    const roomRes = reservationsByRoom.get(roomId) || []
    for (const other of roomRes) {
      if (other.id === resId) continue
      const otherCi = toStr(toDate(other.check_in))
      const otherCo = toStr(toDate(other.check_out))
      // Overlap: newCheckIn < otherCheckOut AND newCheckOut > otherCheckIn
      if (newCheckIn < otherCo && newCheckOut > otherCi) return true
    }
    return false
  }

  // Month mode: 1 column per day (cleaner). Week/2-weeks: 2 sub-columns per day (half-day precision)
  const slotsPerDay = view === "month" ? 1 : 2
  const totalSlots = days * slotsPerDay
  const roomColWidth = 160
  const minSlotWidth = view === "month" ? 36 : view === "two-weeks" ? 36 : 50
  const minTableWidth = roomColWidth + totalSlots * minSlotWidth

  return (
    <section className="bg-card rounded-[20px] border border-border/50 overflow-hidden shadow-sm">
      <CalendarNavigation />

      {dragError && (
        <div className="mx-4 mb-2 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
          <Icon name="error" size="sm" />
          {dragError}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table
          className="border-collapse w-full"
          style={{ minWidth: minTableWidth, tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: roomColWidth }} />
            {dates.flatMap((_, i) =>
              slotsPerDay === 1
                ? [<col key={`a${i}`} style={{ width: minSlotWidth }} />]
                : [
                    <col key={`a${i}`} style={{ width: minSlotWidth }} />,
                    <col key={`b${i}`} style={{ width: minSlotWidth }} />,
                  ]
            )}
          </colgroup>

          <thead>
            {/* Month separator row — only in month view */}
            {view === "month" && (() => {
              const monthGroups: { label: string; span: number }[] = []
              let currentMonth = -1
              for (const date of dates) {
                const m = date.getMonth()
                if (m !== currentMonth) {
                  monthGroups.push({ label: `${HEB_MONTHS[m]} ${date.getFullYear()}`, span: 1 })
                  currentMonth = m
                } else {
                  monthGroups[monthGroups.length - 1].span++
                }
              }
              return (
                <tr>
                  <th className="bg-accent/60 sticky right-0 z-30 border-b border-border/50" style={{ boxShadow: "-2px 0 6px rgba(0,0,0,0.06)" }} />
                  {monthGroups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span * slotsPerDay}
                      className="bg-accent/80 text-center py-1.5 text-xs font-extrabold text-foreground border-b border-border/50 border-l border-border/30"
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
              )
            })()}
            <tr>
              <th
                className="bg-accent/60 px-2 py-2 text-xs font-bold text-foreground border-b border-border/50 text-right sticky right-0 z-30"
                style={{ boxShadow: "-2px 0 6px rgba(0,0,0,0.06)" }}
              >
                חדרים
              </th>
              {dates.map((date, i) => {
                const isToday2 = sameDay(date, today)
                const we = isWeekend(date)
                return (
                  <th
                    key={i}
                    colSpan={slotsPerDay}
                    className={`p-1 text-center border-b border-border/50 border-l border-border/30 ${
                      isToday2 ? "bg-primary/10 border-b-2 border-b-primary" : we ? "bg-amber-100/60 dark:bg-amber-950/20 border-b-2 border-b-amber-400" : "bg-accent/50"
                    }`}
                  >
                    <p className={`text-[12px] font-bold ${isToday2 ? "text-primary" : we ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {HEB_DAYS[date.getDay()]} {date.getDate()}
                    </p>
                    {isToday2 && <p className="text-[8px] text-primary font-bold">היום</p>}
                    {view !== "month" && we && date.getDay() === 6 && !isToday2 && <p className="text-[8px] text-amber-600 font-semibold">שבת</p>}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={1 + totalSlots} className="p-12 text-center text-muted-foreground">
                  <Icon name="hourglass_empty" size="xl" className="mx-auto mb-4 opacity-30" />
                  <p>טוען יומן...</p>
                </td>
              </tr>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={1 + totalSlots} className="p-12 text-center text-muted-foreground">
                  <Icon name="bed" size="xl" className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">אין חדרים</p>
                </td>
              </tr>
            ) : (
              rooms.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  reservations={reservationsByRoom.get(room.id) || []}
                  days={days}
                  today={today}
                  startDate={startDate}
                  dates={dates}
                  rateOverrides={rateOverrides}
                  currency={currency}
                  slotsPerDay={slotsPerDay}
                  view={view}
                  getMaxExtendDate={getMaxExtendDate}
                  onReservationClick={(id) => setSelectedResId(id)}
                  onEmptyCellDoubleClick={(roomData, dateStr) => {
                    const nextDay = new Date(dateStr + "T00:00:00")
                    nextDay.setDate(nextDay.getDate() + 1)
                    openNewReservation({
                      checkIn: dateStr,
                      checkOut: toStr(nextDay),
                      roomId: roomData.id,
                      roomTypeId: roomData.room_type_id,
                    })
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedRes && (
          <div
            className={`${ribbonCls(draggedRes)} h-11 rounded-xl flex items-center gap-1 px-4 shadow-md whitespace-nowrap pointer-events-none border-2 border-white/40`}
            style={{ minWidth: 120, opacity: 0.85 }}
          >
            <Icon name="drag_indicator" size="sm" className="text-white/70 flex-shrink-0 mr-1" />
            <span className="text-[11px] font-bold">{draggedRes.full_name}</span>
          </div>
        )}
      </DragOverlay>
      </DndContext>

      <ReservationPanel
        reservationId={selectedResId}
        tenantId={tenantId}
        onClose={() => setSelectedResId(null)}
        onUpdate={loadData}
      />

      <ReservationModal onCreated={loadData} />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setConfirmDialog(null)} />
          <div className="relative bg-card rounded-[20px] shadow-2xl w-full max-w-[420px] overflow-hidden">
            <div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4">
              <h3 className="text-white font-bold text-lg">
                {confirmDialog.type === "resize" ? "שינוי משך שהייה" : "העברת הזמנה"}
              </h3>
              <p className="text-blue-100 text-sm mt-0.5">
                {confirmDialog.res.full_name} — {confirmDialog.res.reservation_number}
              </p>
            </div>
            <div className="px-6 py-5 space-y-3">
              {confirmDialog.type === "resize" ? (
                <p className="text-sm text-foreground leading-relaxed">
                  האם לשנות את תאריך היציאה ל-<span className="font-bold text-primary">{confirmDialog.newCheckOut}</span>?
                </p>
              ) : (
                <div className="space-y-2">
                  {confirmDialog.newRoomId !== confirmDialog.res.room_id && (
                    <p className="text-sm text-foreground">
                      העברה לחדר <span className="font-bold text-primary">{confirmDialog.targetRoomNumber}</span>
                    </p>
                  )}
                  <p className="text-sm text-foreground">
                    תאריכים: <span className="font-bold">{confirmDialog.newCheckIn}</span> → <span className="font-bold">{confirmDialog.newCheckOut}</span>
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">פעולה זו תעדכן את ההזמנה במערכת.</p>
            </div>
            <div className="px-6 py-4 border-t border-border/20 flex items-center gap-3">
              <button
                onClick={confirmMove}
                disabled={saving}
                className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all min-h-[44px] disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    שומר...
                  </>
                ) : "אישור"}
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={saving}
                className="border border-border/30 text-muted-foreground px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-accent transition-colors min-h-[44px]"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ─────────────── Room Row ─────────────── */

function RoomRow({
  room,
  reservations: roomRes,
  days,
  startDate,
  rateOverrides,
  currency,
  slotsPerDay,
  view,
  getMaxExtendDate,
  onReservationClick,
  onEmptyCellDoubleClick,
}: {
  room: Room
  reservations: Reservation[]
  days: number
  today: Date
  startDate: Date
  dates: Date[]
  rateOverrides: RateOverride[]
  currency: string
  slotsPerDay: number
  view: CalendarView
  getMaxExtendDate: (res: Reservation) => string | null
  onReservationClick: (id: string) => void
  onEmptyCellDoubleClick: (room: Room, dateStr: string) => void
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const currSym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₪"
  const isMonthView = view === "month"

  function getPriceForDate(slotIndex: number): { price: number; minNights: number | null; isOverride: boolean } | null {
    const dayIndex = Math.floor(slotIndex / slotsPerDay)
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayIndex)
    const dateStr = toStr(date)

    for (const ov of rateOverrides) {
      if (ov.room_type_id !== room.room_type_id) continue
      const from = toStr(typeof ov.date_from === "string" ? new Date(ov.date_from) : ov.date_from)
      const to = toStr(typeof ov.date_to === "string" ? new Date(ov.date_to) : ov.date_to)
      if (dateStr >= from && dateStr <= to) {
        return { price: Number(ov.price), minNights: ov.min_nights ? Number(ov.min_nights) : null, isOverride: true }
      }
    }

    if (room.base_price && Number(room.base_price) > 0) {
      return { price: Number(room.base_price), minNights: null, isOverride: false }
    }

    return null
  }
  const isBlocked = room.status === "blocked" || room.status === "maintenance"
  const totalSlots = days * slotsPerDay

  const sorted = useMemo(() =>
    [...roomRes].sort((a, b) => toDate(a.check_in).getTime() - toDate(b.check_in).getTime()),
    [roomRes]
  )

  const cells = useMemo(() => {
    const occupied = new Array(totalSlots).fill(false)

    interface ResSlot { res: Reservation; start: number; end: number }
    const resSlots: ResSlot[] = []

    for (const res of sorted) {
      const ci = toDate(res.check_in)
      const co = toDate(res.check_out)
      const startDay = diffDays(startDate, ci)
      const endDay = diffDays(startDate, co)

      let start: number, end: number
      if (isMonthView) {
        // Month: 1 slot per day, bar spans check_in day → check_out day (exclusive)
        start = startDay
        end = endDay
      } else {
        // Week/2-weeks: 2 slots per day, half-day precision
        start = startDay * 2 + 1
        end = endDay * 2 + 1
      }

      start = Math.max(0, start)
      end = Math.min(totalSlots, end)
      if (end <= start) continue

      resSlots.push({ res, start, end })
      for (let s = start; s < end; s++) occupied[s] = true
    }

    // Build TD sequence
    const result: Array<{
      type: "empty" | "reservation"
      colSpan: number
      reservation?: Reservation
      slotIndex: number
    }> = []

    let slot = 0
    while (slot < totalSlots) {
      const resHere = resSlots.find(r => r.start === slot)
      if (resHere) {
        result.push({
          type: "reservation",
          colSpan: resHere.end - resHere.start,
          reservation: resHere.res,
          slotIndex: slot,
        })
        slot = resHere.end
      } else {
        // Each empty slot gets its own TD so grid lines show on every day
        result.push({ type: "empty", colSpan: 1, slotIndex: slot })
        slot++
      }
    }

    return result
  }, [sorted, totalSlots, startDate])

  return (
    <tr className="group">
      {/* Sticky room label */}
      <td
        className="bg-card px-2 py-2 border-b border-border/30 border-r-4 group-hover:bg-accent/20 transition-colors sticky right-0 z-20"
        style={{ boxShadow: "-2px 0 6px rgba(0,0,0,0.06)", borderRightColor: getRoomStatusColor(room.status) }}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="text-xs font-bold bg-primary/10 text-primary w-8 h-8 flex items-center justify-center rounded-xl">
              {room.room_number}
            </span>
            {false && isBlocked && (
              <span className="absolute -top-1 -left-1 w-3 h-3 bg-destructive rounded-full border-2 border-card" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{room.room_type_name}</p>
            <p className="text-[12px] text-muted-foreground">{room.floor_name}</p>
          </div>
        </div>
      </td>

      {/* Day/half-day cells */}
      {cells.map((cell, i) => {
        const isDayStart = isMonthView ? true : cell.slotIndex % 2 === 1
        const dayBorderClass = isDayStart ? "border-l border-border/30" : ""
        const dayIndex = Math.floor(cell.slotIndex / slotsPerDay)

        if (cell.type === "reservation" && cell.reservation) {
          const res = cell.reservation
          const cls = ribbonCls(res)
          const isVip = res.is_vip || res.guest_vip

          return (
            <td
              key={i}
              colSpan={cell.colSpan}
              className={`p-0 border-b border-border/30 h-16 ${dayBorderClass}`}
            >
              <DraggableBar
                reservation={res}
                cls={cls}
                isVip={isVip}
                canResize={(() => {
                  const maxDate = getMaxExtendDate(res)
                  // Can resize if there's no next reservation, or if the next one starts after check_out (gap exists)
                  if (!maxDate) return true
                  return maxDate > toStr(toDate(res.check_out))
                })()}
                onDoubleClick={() => onReservationClick(res.id)}
              />
            </td>
          )
        }

        // In month mode: no prices (too cramped). In week/2weeks: show on first half-slot only
        const showPrice = !isMonthView && cell.slotIndex % 2 === 1
        const priceInfo = showPrice ? getPriceForDate(cell.slotIndex) : null

        // Compute date string for this cell
        const cellDate = new Date(startDate)
        cellDate.setDate(cellDate.getDate() + dayIndex)
        const cellDateStr = toStr(cellDate)

        return (
          <DroppableCell
            key={i}
            cellId={`${room.id}-${cellDateStr}`}
            roomId={room.id}
            dateStr={cellDateStr}
            colSpan={cell.colSpan}
            className={`border-b border-border/30 h-16 cursor-pointer transition-colors ${dayBorderClass} ${
              hoveredDay === dayIndex ? "bg-primary/5" : isWeekend(cellDate) ? "bg-amber-50/20 dark:bg-amber-950/5" : ""
            } ${isBlocked ? "bg-red-50/20 dark:bg-red-950/5" : ""} ${priceInfo ? "align-top" : ""}`}
            onMouseEnter={() => setHoveredDay(dayIndex)}
            onMouseLeave={() => setHoveredDay(null)}
            onDoubleClick={() => onEmptyCellDoubleClick(room, cellDateStr)}
          >
            {priceInfo && (
              <div className="px-1 pt-1.5">
                <p className={`text-xs font-bold ${priceInfo.isOverride ? "text-emerald-600" : "text-foreground/70"}`}>
                  {currSym}{priceInfo.price}
                </p>
                {priceInfo.minNights && priceInfo.minNights > 1 && (
                  <p className="text-[8px] text-muted-foreground/60">מינ׳ {priceInfo.minNights}</p>
                )}
              </div>
            )}
          </DroppableCell>
        )
      })}
    </tr>
  )
}

/* ── Drag & Drop Components ── */

function DraggableBar({
  reservation,
  cls,
  isVip,
  canResize,
  onDoubleClick,
}: {
  reservation: Reservation
  cls: string
  isVip: boolean
  canResize: boolean
  onDoubleClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `res-${reservation.id}`,
    data: { reservation, type: "move" },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${cls} h-11 mx-0.5 my-1.5 rounded-xl flex items-center overflow-hidden relative group ${isDragging ? "opacity-40 shadow-md" : ""}`}
      onDoubleClick={onDoubleClick}
    >
      {/* Main drag area */}
      <div
        {...listeners}
        {...attributes}
        className="flex-1 flex items-center gap-1 px-2 cursor-ew-resize h-full min-w-0"
        title={`${reservation.full_name}\nגרור להעברה`}
      >
        <span className="text-[12px] font-bold whitespace-nowrap truncate">
          {reservation.full_name}
        </span>
        {isVip && (
          <Icon name="star" size="sm" className="text-amber-500 flex-shrink-0" />
        )}
      </div>

      {/* Resize handle — left edge in RTL = check-out side. Hidden when next reservation is adjacent. */}
      {canResize && <ResizeHandle reservation={reservation} />}
    </div>
  )
}

function ResizeHandle({ reservation }: { reservation: Reservation }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resize-${reservation.id}`,
    data: { reservation, type: "resize" },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute left-0 top-0 bottom-0 w-5 cursor-ew-resize flex items-center justify-center transition-all z-10 ${
        isDragging
          ? "bg-white/30"
          : "hover:bg-white/30"
      }`}
      style={{ cursor: "ew-resize" }}
      title="גרור לשינוי אורך שהייה"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
        <div className="w-0.5 h-1.5 bg-white rounded-full" />
        <div className="w-0.5 h-1.5 bg-white rounded-full" />
        <div className="w-0.5 h-1.5 bg-white rounded-full" />
      </div>
    </div>
  )
}

function DroppableCell({
  cellId,
  roomId,
  dateStr,
  colSpan,
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
}: {
  cellId: string
  roomId: string
  dateStr: string
  colSpan: number
  className: string
  children: React.ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
  onDoubleClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { roomId, dateStr },
  })

  return (
    <td
      ref={setNodeRef}
      colSpan={colSpan}
      className={`${className} ${isOver ? "!bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </td>
  )
}

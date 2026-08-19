"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useCalendarStore } from "@/lib/stores/calendar-store"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { useLookup } from "@/lib/hooks/use-lookup"
import { moveReservationSegment, resizeReservationSegment } from "@/lib/actions/board-actions"
import { getCalendarKpis, type CalendarKpis } from "@/lib/actions/calendar"
import { BoardHeader } from "./board/BoardHeader"
import { BoardKpis } from "./board/BoardKpis"
import { BoardBody } from "./board/BoardBody"
import { DateChangeConfirmDialog, type PendingDateChange } from "./board/DateChangeConfirmDialog"
import { useBoardData } from "./board/use-board-data"
import { useBoardInteraction } from "./board/use-board-interaction"
import { COL_WIDTH, VIEW_DAYS } from "./board/board-constants"
import { addDays, deriveRoomStatus, todayIso } from "./board/board-rules"
import type { BoardRoom, DerivedRoomStatus } from "./board/board-types"
import { seedDefaultAdults } from "@/lib/utils/room-capacity"

interface CalendarBoardProps {
  tenantId: string
}

function toIso(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function CalendarBoard({ tenantId }: CalendarBoardProps) {
  const { startDate, view, setView, goToday, goForward, goBackward } = useCalendarStore()
  const openNewReservation = useReservationFormStore((s) => s.open)
  const openExistingReservation = useReservationEditStore((s) => s.open)
  /* Refetch the board whenever an edit-panel save bumps savedTick — this
   * keeps payment-status colours, dates, and guest names in sync across
   * EVERY room card that shares the same reservation_id (multi-room
   * reservations must update together). */
  const savedTick = useReservationEditStore((s) => s.savedTick)

  // Single source of truth for reservation bar colour in the board:
  // lookup_items.color keyed by reservations.payment_status.
  const {
    items: paymentStatusItems,
    colorMap: paymentStatusColors,
    labelMap: paymentStatusLabels,
  } = useLookup(tenantId, "payment_status")

  const paymentLegend = useMemo(
    () =>
      paymentStatusItems.map((i) => ({
        value: i.value,
        label: i.label,
        color: i.color ?? null,
      })),
    [paymentStatusItems],
  )

  /* Board KPIs — fetched straight from the DB for TODAY + current month,
   * independent of the visible window. Refreshed on mount, after any edit
   * (savedTick), and on a 60s interval. */
  const [kpiData, setKpiData] = useState<CalendarKpis | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => {
      getCalendarKpis(tenantId, todayIso())
        .then((k) => {
          if (alive) setKpiData(k)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [tenantId, savedTick])

  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null)
  /** Pending date change awaiting user confirmation. */
  const [pendingChange, setPendingChange] = useState<
    | (PendingDateChange & {
        exec: () => Promise<void>
      })
    | null
  >(null)
  const liveRegion = useRef<HTMLDivElement | null>(null)

  const announce = useCallback((msg: string) => {
    if (liveRegion.current) liveRegion.current.textContent = msg
  }, [])

  const days = VIEW_DAYS[view]
  const startDateIso = toIso(startDate)
  const endDateIso = addDays(startDateIso, days) // exclusive

  const { data, loading, error, refetch } = useBoardData({
    tenantId,
    startDate: startDateIso,
    endDate: endDateIso,
  })

  useEffect(() => {
    if (savedTick === 0) return
    refetch()
  }, [savedTick, refetch])

  const roomIds = useMemo(() => data.rooms.map((r) => r.id), [data.rooms])

  /* ── Action handlers for the interaction state machine ───── */

  const handleCreate = useCallback(
    ({
      roomId,
      checkInIso,
      checkOutIso,
    }: {
      roomId: string
      checkInIso: string
      checkOutIso: string
    }) => {
      const room = data.rooms.find((r) => r.id === roomId)
      if (!room) return

      const defaultOcc = seedDefaultAdults(room)
      const basePrice = Number(room.base_price) || 0
      const extraPrice = Number(room.extra_person_price) || 0

      const maxOccupancy = Math.max(1, Number(room.max_occupancy) || 1)
      openNewReservation({
        checkIn: checkInIso,
        checkOut: checkOutIso,
        roomId: room.id,
        roomTypeId: room.room_type_id,
        adults: defaultOcc,
        children: 0,
        infants: 0,
        rooms: [
          {
            id: Date.now().toString(),
            roomId: room.id,
            roomNumber: room.room_number,
            roomTypeId: room.room_type_id,
            roomTypeName: room.room_type_name || "",
            boardType: "room_only",
            ratePerNight: basePrice,
            basePrice,
            defaultOccupancy: defaultOcc,
            extraPersonPrice: extraPrice,
            maxOccupancy,
            maxAdults: Math.max(0, Number(room.max_adults ?? room.max_occupancy) || 0),
            maxChildren: Math.max(0, Number(room.max_children) || 0),
            maxInfants: Math.max(0, Number(room.max_infants) || 0),
            checkIn: checkInIso,
            checkOut: checkOutIso,
            adults: defaultOcc,
            children: 0,
            infants: 0,
            guestFirstName: "",
            guestLastName: "",
            guestPhone: "",
            guestEmail: "",
            guestIdNumber: "",
          },
        ],
      })
    },
    [data.rooms, openNewReservation],
  )

  /**
   * Date-change commits go through a confirmation gate: handlers PROPOSE a
   * change and the server action only runs once the user confirms.
   */
  const guestNameFor = useCallback(
    (reservationId: string): string => {
      const res = data.reservations.find((r) => r.id === reservationId)
      if (!res) return "אורח"
      return (
        res.full_name ||
        [res.first_name, res.last_name].filter(Boolean).join(" ") ||
        "אורח"
      )
    },
    [data.reservations],
  )

  const roomLabelFor = useCallback(
    (roomId: string): string => {
      const room = data.rooms.find((r) => r.id === roomId)
      if (!room) return roomId
      return `${room.room_number}${room.room_type_name ? ` · ${room.room_type_name}` : ""}`
    },
    [data.rooms],
  )

  const handleMove = useCallback(
    ({
      segmentId,
      reservationId,
      roomId,
      checkInIso,
      checkOutIso,
    }: {
      segmentId: string
      reservationId: string
      roomId: string
      checkInIso: string
      checkOutIso: string
    }) => {
      const seg = data.reservations.find((r) => r.segment_id === segmentId)
      if (!seg) return
      setPendingChange({
        kind: "move",
        guestName: guestNameFor(reservationId),
        original: {
          checkIn: seg.segment_check_in,
          checkOut: seg.segment_check_out,
          roomLabel: roomLabelFor(seg.room_id),
        },
        proposed: {
          checkIn: checkInIso,
          checkOut: checkOutIso,
          roomLabel: roomLabelFor(roomId),
        },
        exec: async () => {
          const result = await moveReservationSegment(
            tenantId,
            segmentId,
            roomId,
            checkInIso,
            checkOutIso,
          )
          if (result.success) {
            toast.success("הסגמנט הועבר")
            refetch()
          } else {
            toast.error(result.error || "העברה נכשלה")
          }
        },
      })
    },
    [tenantId, data.reservations, guestNameFor, roomLabelFor, refetch],
  )

  const handleResize = useCallback(
    ({
      segmentId,
      reservationId,
      checkInIso,
      checkOutIso,
    }: {
      segmentId: string
      reservationId: string
      checkInIso: string
      checkOutIso: string
    }) => {
      const seg = data.reservations.find((r) => r.segment_id === segmentId)
      if (!seg) return
      setPendingChange({
        kind: "resize",
        guestName: guestNameFor(reservationId),
        original: {
          checkIn: seg.segment_check_in,
          checkOut: seg.segment_check_out,
          roomLabel: roomLabelFor(seg.room_id),
        },
        proposed: {
          checkIn: checkInIso,
          checkOut: checkOutIso,
          roomLabel: roomLabelFor(seg.room_id),
        },
        exec: async () => {
          const result = await resizeReservationSegment(
            tenantId,
            segmentId,
            checkInIso,
            checkOutIso,
          )
          if (result.success) {
            toast.success("השהות עודכנה")
            refetch()
          } else {
            toast.error(result.error || "שינוי נכשל")
          }
        },
      })
    },
    [tenantId, data.reservations, guestNameFor, roomLabelFor, refetch],
  )

  const handleConfirmPending = useCallback(async () => {
    if (!pendingChange) return
    const exec = pendingChange.exec
    setPendingChange(null)
    await exec()
  }, [pendingChange])

  const handleCancelPending = useCallback(() => {
    setPendingChange(null)
  }, [])

  const { bodyRef, drag, startCreate, startMove, startResize } = useBoardInteraction({
    tenantId,
    data,
    startDateIso,
    totalDays: days,
    roomIds,
    onCreate: handleCreate,
    onMove: handleMove,
    onResize: handleResize,
    announce,
  })

  /* ── Derived room status (live) ──────────────────────────── */

  const statusByRoomId = useMemo(() => {
    const today = todayIso()
    const m: Record<string, DerivedRoomStatus> = {}
    for (const r of data.rooms as BoardRoom[]) {
      m[r.id] = deriveRoomStatus(r, data.reservations, data.blocks, today)
    }
    return m
  }, [data.rooms, data.reservations, data.blocks])

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <BoardHeader
        startDateIso={startDateIso}
        view={view}
        onViewChange={setView}
        onJumpToToday={goToday}
        onPrev={goBackward}
        onNext={goForward}
        unitsCount={data.rooms.length}
      />

      <BoardKpis kpis={kpiData} />

      {error && (
        <div className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-4 text-sm">
          שגיאה: {error}
        </div>
      )}

      {/* Payment-status legend — same hex as the reservation bars in the grid. */}
      {paymentLegend.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-1">
          {paymentLegend.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-semibold"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color ?? "#64748b" }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {loading && data.rooms.length === 0 ? (
        <div className="cal-board tl min-h-[420px] flex items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">טוען לוח תפוסה…</div>
        </div>
      ) : (
        <BoardBody
          ref={bodyRef}
          rooms={data.rooms as BoardRoom[]}
          reservations={data.reservations}
          blocks={data.blocks}
          dailyPricing={data.dailyPricing}
          rateOverrides={data.rateOverrides}
          ratePlans={data.ratePlans}
          currency={data.currency}
          operationalTimes={data.operationalTimes}
          statusByRoomId={statusByRoomId}
          paymentStatusColors={paymentStatusColors}
          paymentStatusLabels={paymentStatusLabels}
          startDateIso={startDateIso}
          totalDays={days}
          colWidth={COL_WIDTH[view]}
          drag={drag}
          selectedSegmentId={focusedSegmentId}
          onOpenReservation={(id) => openExistingReservation(id, tenantId)}
          onStartCreate={startCreate}
          onStartMove={startMove}
          onStartResize={startResize}
          onFocusSegment={setFocusedSegmentId}
        />
      )}

      {/* Live region for screen-reader announcements */}
      <div
        ref={liveRegion}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Confirmation gate before any date-change commit (move / resize). */}
      <DateChangeConfirmDialog
        change={pendingChange}
        onConfirm={handleConfirmPending}
        onCancel={handleCancelPending}
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  BoardData,
  BoardReservation,
  BoardRoom,
  DragState,
} from "./board-types"
import {
  addDays,
  checkAvailability,
  checkLosRules,
  dateAtCol,
  diffDays,
  resolveCheckInTime,
  resolveCheckOutTime,
} from "./board-rules"

interface UseBoardInteractionArgs {
  tenantId: string
  data: BoardData
  startDateIso: string
  totalDays: number
  roomIds: string[] // ordered
  onCreate: (args: {
    roomId: string
    checkInIso: string
    checkOutIso: string
  }) => void
  onMove: (args: {
    segmentId: string
    reservationId: string
    roomId: string
    checkInIso: string
    checkOutIso: string
  }) => void
  onResize: (args: {
    segmentId: string
    reservationId: string
    checkInIso: string
    checkOutIso: string
  }) => void
  announce: (message: string) => void
}

/**
 * Pointer state machine operating at the SEGMENT level (reservation_rooms row).
 * Move/resize affect only the dragged segment — sibling segments of the same
 * parent reservation are left alone (multi-room business rule).
 * Validates every intent against overlap + min-nights; Escape cancels.
 */
export function useBoardInteraction(args: UseBoardInteractionArgs) {
  const {
    data,
    startDateIso,
    totalDays,
    roomIds,
    onCreate,
    onMove,
    onResize,
    announce,
  } = args

  const [drag, setDrag] = useState<DragState>({ type: "idle" })
  const dragRef = useRef<DragState>({ type: "idle" })

  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  const bodyRef = useRef<HTMLDivElement | null>(null)

  /**
   * Resolve pointer → { col, roomId } by probing the DOM at (clientX, clientY).
   * Uses `data-col` / `data-room` attributes on cells to stay immune to RTL
   * scroll quirks across browsers.
   */
  const hitTest = useCallback(
    (clientX: number, clientY: number): { col: number; roomId: string } | null => {
      const body = bodyRef.current
      if (!body) return null

      const hit = document.elementFromPoint(clientX, clientY)
      const cell = hit?.closest?.("[data-cell]") as HTMLElement | null
      if (cell && cell.dataset.col && cell.dataset.room) {
        return { col: parseInt(cell.dataset.col, 10), roomId: cell.dataset.room }
      }

      // Fallback: compute relative to scroll container
      const rect = body.getBoundingClientRect()
      const rowH = parseFloat(getComputedStyle(body).getPropertyValue("--row-h")) || 56
      const headerH = 64
      const rowIdx = Math.max(
        0,
        Math.min(roomIds.length - 1, Math.floor((clientY - rect.top - headerH + body.scrollTop) / rowH)),
      )
      const roomId = roomIds[rowIdx] ?? roomIds[0]

      const anyCell = body.querySelector("[data-cell]") as HTMLElement | null
      if (!anyCell) return roomId ? { col: 0, roomId } : null
      const cellRect = anyCell.getBoundingClientRect()
      const col0Right = cellRect.right
      const offset = col0Right - clientX
      const measuredColWidth = cellRect.width || 1
      const col = Math.max(0, Math.min(totalDays, Math.floor(offset / measuredColWidth)))
      return { col, roomId }
    },
    [totalDays, roomIds],
  )

  const findRoom = useCallback(
    (roomId: string): BoardRoom | undefined => data.rooms.find((r) => r.id === roomId),
    [data.rooms],
  )

  const findSegment = useCallback(
    (segmentId: string): BoardReservation | undefined =>
      data.reservations.find((r) => r.segment_id === segmentId),
    [data.reservations],
  )

  /** Validate a prospective placement against overlap + min-nights.
   *  `excludeReservationId` prevents the reservation being moved/resized from
   *  blocking itself. This excludes ALL segments of that parent reservation —
   *  safe because `reservation_rooms` has UNIQUE(reservation_id, room_id). */
  const validate = useCallback(
    (
      roomId: string,
      checkInIso: string,
      checkOutIso: string,
      excludeReservationId: string | null,
    ): { ok: true } | { ok: false; reason: string } => {
      const room = findRoom(roomId)
      if (!room) return { ok: false, reason: "חדר לא נמצא" }

      const avail = checkAvailability(
        roomId,
        checkInIso,
        checkOutIso,
        excludeReservationId,
        room,
        data.reservations,
        data.blocks,
        data.dailyPricing,
      )
      if (!avail.available) return { ok: false, reason: avail.reason ?? "לא זמין" }

      const los = checkLosRules(
        roomId,
        room.room_type_id,
        Number(room.base_price) || 0,
        checkInIso,
        checkOutIso,
        data.dailyPricing,
        data.rateOverrides,
        data.ratePlans,
      )
      if (!los.valid) return { ok: false, reason: los.reason ?? "טווח לא תקף" }

      return { ok: true }
    },
    [data, findRoom],
  )

  /* ── Public start handlers called by child components ─────── */

  const startCreate = useCallback(
    (roomId: string, col: number) => {
      setDrag({
        type: "create",
        roomId,
        anchorCol: col,
        currentCol: col,
      })
    },
    [],
  )

  const startMove = useCallback(
    (segmentId: string) => {
      const seg = findSegment(segmentId)
      if (!seg) return
      const srcStartCol = diffDays(startDateIso, seg.segment_check_in)
      const nights = diffDays(seg.segment_check_in, seg.segment_check_out)
      // Capture the source bar's fractional geometry so the move overlay
      // renders at the SAME width/offset as the bar the user grabbed — not
      // a rounded-up whole-nights approximation.
      const checkInHours = resolveCheckInTime(seg, seg.segment_check_in, data.operationalTimes)
      const checkOutHours = resolveCheckOutTime(seg, seg.segment_check_out, data.operationalTimes)
      const srcStartFraction = checkInHours / 24
      const endFraction = checkOutHours / 24
      const srcWidthCols = nights + endFraction - srcStartFraction
      setDrag({
        type: "move",
        segmentId,
        srcRoomId: seg.room_id,
        srcStartCol,
        srcNights: nights,
        srcStartFraction,
        srcWidthCols,
        targetRoomId: seg.room_id,
        targetStartCol: srcStartCol,
      })
    },
    [findSegment, startDateIso, data.operationalTimes],
  )

  const startResize = useCallback(
    (segmentId: string, edge: "start" | "end") => {
      // Business rule: the reservation START edge is locked — only the END
      // edge may be resized. Ignore any attempt to start a start-edge drag.
      if (edge !== "end") return
      const seg = findSegment(segmentId)
      if (!seg) return
      const originalStart = diffDays(startDateIso, seg.segment_check_in)
      const originalNights = diffDays(seg.segment_check_in, seg.segment_check_out)
      setDrag({
        type: "resize",
        segmentId,
        edge: "end",
        roomId: seg.room_id,
        originalStartCol: originalStart,
        originalNights,
        newStartCol: originalStart,
        newNights: originalNights,
      })
    },
    [findSegment, startDateIso],
  )

  /* ── Global pointermove / pointerup / keydown ─────────────── */

  useEffect(() => {
    if (drag.type === "idle") return

    const onMoveEvent = (e: PointerEvent) => {
      const cur = dragRef.current
      if (cur.type === "idle") return

      const hit = hitTest(e.clientX, e.clientY)
      if (!hit) return
      const col = hit.col
      const newRoomId = hit.roomId

      if (cur.type === "create") {
        const currentCol = Math.max(0, Math.min(totalDays, col))
        const lo = Math.min(cur.anchorCol, currentCol)
        const hi = Math.max(cur.anchorCol, currentCol) + 1
        const checkIn = dateAtCol(startDateIso, lo)
        const checkOut = dateAtCol(startDateIso, hi)
        const v = validate(cur.roomId, checkIn, checkOut, null)
        setDrag({
          ...cur,
          currentCol,
          invalid: !v.ok,
          reason: v.ok ? undefined : v.reason,
        })
      } else if (cur.type === "move") {
        const seg = findSegment(cur.segmentId)
        const newStart = Math.max(
          0 - cur.srcNights,
          Math.min(totalDays - 1, col - Math.floor(cur.srcNights / 2)),
        )
        const checkIn = dateAtCol(startDateIso, newStart)
        const checkOut = addDays(checkIn, cur.srcNights)
        const v = validate(newRoomId, checkIn, checkOut, seg?.id ?? null)
        setDrag({
          ...cur,
          targetRoomId: newRoomId,
          targetStartCol: newStart,
          invalid: !v.ok,
          reason: v.ok ? undefined : v.reason,
        })
      } else if (cur.type === "resize") {
        const seg = findSegment(cur.segmentId)
        let newStart = cur.originalStartCol
        let newNights = cur.originalNights
        if (cur.edge === "end") {
          const endCol = Math.max(cur.originalStartCol + 1, col + 1)
          newNights = endCol - cur.originalStartCol
        } else {
          newStart = Math.min(
            cur.originalStartCol + cur.originalNights - 1,
            Math.max(0, col),
          )
          newNights = cur.originalStartCol + cur.originalNights - newStart
        }
        const checkIn = dateAtCol(startDateIso, newStart)
        const checkOut = addDays(checkIn, newNights)
        const v = validate(cur.roomId, checkIn, checkOut, seg?.id ?? null)
        setDrag({
          ...cur,
          newStartCol: newStart,
          newNights,
          invalid: !v.ok,
          reason: v.ok ? undefined : v.reason,
        })
      }
    }

    const onUp = () => {
      const cur = dragRef.current
      if (cur.type === "idle") return

      if (cur.type === "create") {
        const lo = Math.min(cur.anchorCol, cur.currentCol)
        const hi = Math.max(cur.anchorCol, cur.currentCol) + 1
        const checkIn = dateAtCol(startDateIso, lo)
        let checkOut = dateAtCol(startDateIso, hi)
        const room = findRoom(cur.roomId)
        if (room) {
          const los = checkLosRules(
            cur.roomId,
            room.room_type_id,
            Number(room.base_price) || 0,
            checkIn,
            checkOut,
            data.dailyPricing,
            data.rateOverrides,
            data.ratePlans,
          )
          // Snap-to-min on release when selection is short; never snap a
          // too-long selection — that's a hard violation to be surfaced.
          if (!los.valid && los.violation === "min") {
            checkOut = addDays(checkIn, los.minNights)
          }
        }
        const v = validate(cur.roomId, checkIn, checkOut, null)
        if (v.ok) {
          onCreate({ roomId: cur.roomId, checkInIso: checkIn, checkOutIso: checkOut })
          announce("נפתחה הזמנה חדשה")
        } else {
          announce(`פעולה נחסמה: ${v.reason}`)
        }
      } else if (cur.type === "move") {
        if (
          cur.targetRoomId === cur.srcRoomId &&
          cur.targetStartCol === cur.srcStartCol
        ) {
          // no-op
        } else {
          const seg = findSegment(cur.segmentId)
          if (seg) {
            const checkIn = dateAtCol(startDateIso, cur.targetStartCol)
            const checkOut = addDays(checkIn, cur.srcNights)
            const v = validate(cur.targetRoomId, checkIn, checkOut, seg.id)
            if (v.ok) {
              onMove({
                segmentId: cur.segmentId,
                reservationId: seg.id,
                roomId: cur.targetRoomId,
                checkInIso: checkIn,
                checkOutIso: checkOut,
              })
              announce("סגמנט הועבר")
            } else {
              announce(`העברה נחסמה: ${v.reason}`)
            }
          }
        }
      } else if (cur.type === "resize") {
        if (cur.newNights === cur.originalNights && cur.newStartCol === cur.originalStartCol) {
          // no-op
        } else {
          const seg = findSegment(cur.segmentId)
          if (seg) {
            const checkIn = dateAtCol(startDateIso, cur.newStartCol)
            const checkOut = addDays(checkIn, cur.newNights)
            const v = validate(cur.roomId, checkIn, checkOut, seg.id)
            if (v.ok) {
              onResize({
                segmentId: cur.segmentId,
                reservationId: seg.id,
                checkInIso: checkIn,
                checkOutIso: checkOut,
              })
              announce("שהות עודכנה")
            } else {
              announce(`שינוי נחסם: ${v.reason}`)
            }
          }
        }
      }

      setDrag({ type: "idle" })
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrag({ type: "idle" })
        announce("פעולה בוטלה")
      }
    }

    window.addEventListener("pointermove", onMoveEvent)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", onMoveEvent)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("keydown", onKey)
    }
  }, [
    drag.type,
    hitTest,
    roomIds,
    totalDays,
    startDateIso,
    validate,
    findRoom,
    findSegment,
    data.dailyPricing,
    data.rateOverrides,
    data.ratePlans,
    onCreate,
    onMove,
    onResize,
    announce,
  ])

  return {
    drag,
    bodyRef,
    startCreate,
    startMove,
    startResize,
    cancel: () => setDrag({ type: "idle" }),
  }
}

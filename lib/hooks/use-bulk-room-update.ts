"use client"

/**
 * useBulkRoomUpdate — client-side state machine for the bulk dialog
 * ──────────────────────────────────────────────────────────────
 * Owns:
 *  - form data (rooms, filters) fetched once on open
 *  - form state (fields, scope)
 *  - filter state (search, room_type, building, floor)
 *  - preview state (computed on demand before apply)
 *  - apply state (loading, result)
 *  - derived live validation warnings
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  BulkUpdateFields,
  BulkUpdateFormData,
  BulkUpdateFormState,
  BulkUpdatePreview,
  BulkUpdateRoomOption,
  BulkUpdateScope,
  BulkUpdateWarning,
  Weekday,
} from "@/lib/types/bulk-room-update"
import {
  ALL_WEEKDAYS,
  emptyBulkUpdateFields,
  emptyBulkUpdateScope,
} from "@/lib/types/bulk-room-update"

import {
  applyBulkRoomUpdate,
  getBulkUpdateFormData,
  previewBulkRoomUpdate,
} from "@/lib/actions/bulk-room-update"
import {
  hasBlockingErrors,
  validateBulkUpdate,
} from "@/lib/utils/bulkRoomUpdateValidation"

interface RoomFilters {
  search: string
  roomTypeId: string | "all"
  buildingId: string | "all"
  floorId: string | "all"
}

const emptyFilters: RoomFilters = {
  search: "",
  roomTypeId: "all",
  buildingId: "all",
  floorId: "all",
}

export interface BulkApplyResult {
  affectedRecords: number
  skippedRecords: number
}

interface UseBulkRoomUpdateArgs {
  isOpen: boolean
  /**
   * Fired ONLY after a successful DB save. The caller is responsible
   * for its own success toast AND (optionally) triggering auto-sync.
   * On DB save failure, the hook shows a single error toast and does
   * not call onApplied.
   */
  onApplied?: (result: BulkApplyResult) => void
  /** Rooms to pre-select when the dialog opens. Empty = no preselection. */
  preselectedRoomIds?: string[]
}

export function useBulkRoomUpdate({
  isOpen,
  onApplied,
  preselectedRoomIds,
}: UseBulkRoomUpdateArgs) {
  // ── data
  const [formData, setFormData] = useState<BulkUpdateFormData | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // ── form state
  const [state, setState] = useState<BulkUpdateFormState>(() => ({
    fields: emptyBulkUpdateFields(),
    scope: emptyBulkUpdateScope(),
  }))

  // ── filters
  const [filters, setFilters] = useState<RoomFilters>(emptyFilters)

  // ── preview / apply
  const [preview, setPreview] = useState<BulkUpdatePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  // Keep the latest preselected ids in a ref so the open-effect reads
  // the freshest value without including it in the dep array (which would
  // cause the dialog to reset mid-use if the parent re-renders).
  const preselectedRef = useRef<string[] | undefined>(preselectedRoomIds)
  useEffect(() => {
    preselectedRef.current = preselectedRoomIds
  }, [preselectedRoomIds])

  // Reset everything when the dialog opens
  useEffect(() => {
    if (!isOpen) return
    const initialScope = emptyBulkUpdateScope()
    const preselected = preselectedRef.current
    if (preselected && preselected.length > 0) {
      initialScope.roomIds = [...preselected]
    }
    setState({ fields: emptyBulkUpdateFields(), scope: initialScope })
    setFilters(emptyFilters)
    setPreview(null)
    setDataError(null)
    setLoadingData(true)
    getBulkUpdateFormData(initialScope.dateFrom).then((res) => {
      if (res.success) {
        setFormData(res.data)
      } else {
        setDataError(res.error)
        toast.error(res.error)
      }
      setLoadingData(false)
    })
  }, [isOpen])

  // Refetch room list whenever the anchor date changes, so the effective
  // price column always reflects the selected day (including any overrides
  // just applied via a previous bulk update).
  useEffect(() => {
    if (!isOpen) return
    const anchor = state.scope.dateFrom
    if (!anchor) return
    let cancelled = false
    getBulkUpdateFormData(anchor).then((res) => {
      if (cancelled || !res.success) return
      setFormData(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, state.scope.dateFrom])

  // ── filtered room list (client-side)
  const filteredRooms = useMemo<BulkUpdateRoomOption[]>(() => {
    if (!formData) return []
    const q = filters.search.trim().toLowerCase()
    return formData.rooms.filter((r) => {
      if (!r.is_active) return false
      if (
        filters.roomTypeId !== "all" &&
        r.room_type_id !== filters.roomTypeId
      ) {
        return false
      }
      if (
        filters.buildingId !== "all" &&
        r.building_id !== filters.buildingId
      ) {
        return false
      }
      if (filters.floorId !== "all" && r.floor_id !== filters.floorId) {
        return false
      }
      if (!q) return true
      const hay = `${r.room_number} ${r.room_name ?? ""} ${
        r.room_type_name ?? ""
      }`.toLowerCase()
      return hay.includes(q)
    })
  }, [formData, filters])

  // ── live validation (no DB)
  const liveWarnings = useMemo<BulkUpdateWarning[]>(
    () => validateBulkUpdate(state.fields, state.scope),
    [state.fields, state.scope],
  )
  const hasBlockingLive = useMemo(
    () => hasBlockingErrors(liveWarnings),
    [liveWarnings],
  )

  // ── setters (typed)
  const setFields = useCallback(
    (updater: (prev: BulkUpdateFields) => BulkUpdateFields) => {
      setState((s) => ({ ...s, fields: updater(s.fields) }))
      setPreview(null)
    },
    [],
  )

  const setScope = useCallback(
    (updater: (prev: BulkUpdateScope) => BulkUpdateScope) => {
      setState((s) => ({ ...s, scope: updater(s.scope) }))
      setPreview(null)
    },
    [],
  )

  const toggleRoom = useCallback((roomId: string) => {
    setState((s) => {
      const has = s.scope.roomIds.includes(roomId)
      const next = has
        ? s.scope.roomIds.filter((id) => id !== roomId)
        : [...s.scope.roomIds, roomId]
      return { ...s, scope: { ...s.scope, roomIds: next } }
    })
    setPreview(null)
  }, [])

  const selectAllFilteredRooms = useCallback(() => {
    const ids = filteredRooms.map((r) => r.id)
    setState((s) => ({
      ...s,
      scope: {
        ...s.scope,
        roomIds: Array.from(new Set([...s.scope.roomIds, ...ids])),
      },
    }))
    setPreview(null)
  }, [filteredRooms])

  const clearRoomSelection = useCallback(() => {
    setState((s) => ({ ...s, scope: { ...s.scope, roomIds: [] } }))
    setPreview(null)
  }, [])

  const toggleWeekday = useCallback((day: Weekday) => {
    setState((s) => {
      const has = s.scope.weekdays.includes(day)
      const next = has
        ? (s.scope.weekdays.filter((d) => d !== day) as Weekday[])
        : ([...s.scope.weekdays, day] as Weekday[])
      next.sort()
      return { ...s, scope: { ...s.scope, weekdays: next } }
    })
    setPreview(null)
  }, [])

  const selectAllWeekdays = useCallback(() => {
    setState((s) => ({ ...s, scope: { ...s.scope, weekdays: [...ALL_WEEKDAYS] } }))
    setPreview(null)
  }, [])

  const clearWeekdays = useCallback(() => {
    setState((s) => ({ ...s, scope: { ...s.scope, weekdays: [] } }))
    setPreview(null)
  }, [])

  // ── actions
  const runPreview = useCallback(async () => {
    if (hasBlockingLive) {
      toast.error(
        liveWarnings.find((w) => w.level === "error")?.message ?? "קלט לא תקין",
      )
      return null
    }
    setPreviewLoading(true)
    const res = await previewBulkRoomUpdate(state)
    setPreviewLoading(false)
    if (!res.success) {
      toast.error(res.error)
      setPreview(null)
      return null
    }
    setPreview(res.preview)
    return res.preview
  }, [hasBlockingLive, liveWarnings, state])

  const apply = useCallback(async () => {
    if (hasBlockingLive) {
      toast.error(
        liveWarnings.find((w) => w.level === "error")?.message ?? "קלט לא תקין",
      )
      return
    }
    setApplying(true)
    const res = await applyBulkRoomUpdate(state)
    setApplying(false)
    // DB save failure: single error toast, do NOT call onApplied — the
    // caller won't try to sync to channels when nothing was saved.
    if (!res.success) {
      toast.error(res.error ?? "העדכון נכשל ולא נשמרו שינויים")
      return
    }
    // DB save succeeded. Surface the preview + hand off to the caller,
    // which will show its own "העדכון נשמר בהצלחה במערכת" toast and
    // decide whether to kick off auto channel sync.
    if (res.preview) setPreview(res.preview)
    onApplied?.({
      affectedRecords: res.affectedRecords ?? 0,
      skippedRecords: res.skippedRecords ?? 0,
    })
  }, [hasBlockingLive, liveWarnings, onApplied, state])

  return {
    // data
    formData,
    loadingData,
    dataError,
    filteredRooms,
    // state
    fields: state.fields,
    scope: state.scope,
    filters,
    liveWarnings,
    hasBlockingLive,
    preview,
    previewLoading,
    applying,
    // setters
    setFields,
    setScope,
    setFilters,
    toggleRoom,
    selectAllFilteredRooms,
    clearRoomSelection,
    toggleWeekday,
    selectAllWeekdays,
    clearWeekdays,
    // actions
    runPreview,
    apply,
  }
}

export type UseBulkRoomUpdateReturn = ReturnType<typeof useBulkRoomUpdate>

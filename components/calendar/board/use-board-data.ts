"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getCalendarData } from "@/lib/actions/calendar"
import { createClientSupabase } from "@/lib/supabase/client"
import type {
  BoardBlock,
  BoardData,
  BoardDailyPricing,
  BoardRateOverride,
  BoardReservation,
} from "./board-types"

/** Postgres DATE columns arrive as JS Date objects via postgres.js — normalise to YYYY-MM-DD. */
function toIsoDate(v: unknown): string {
  if (v instanceof Date) {
    const local = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }
  if (typeof v === "string") return v.slice(0, 10)
  return ""
}

function toHHMM(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === "string") return v.slice(0, 5)
  return String(v).slice(0, 5)
}

function toIsoDateTime(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return typeof v === "string" ? v : null
}

function normalise(raw: BoardData): BoardData {
  return {
    ...raw,
    reservations: raw.reservations.map(
      (r): BoardReservation => ({
        ...r,
        check_in: toIsoDate(r.check_in),
        check_out: toIsoDate(r.check_out),
        segment_check_in: toIsoDate(r.segment_check_in ?? r.check_in),
        segment_check_out: toIsoDate(r.segment_check_out ?? r.check_out),
        estimated_arrival_time: toHHMM(r.estimated_arrival_time),
        estimated_departure_time: toHHMM(r.estimated_departure_time),
        actual_checkin_time: toIsoDateTime(r.actual_checkin_time),
        actual_checkout_time: toIsoDateTime(r.actual_checkout_time),
      }),
    ),
    blocks: raw.blocks.map(
      (b): BoardBlock => ({ ...b, block_date: toIsoDate(b.block_date) }),
    ),
    rateOverrides: raw.rateOverrides.map(
      (o): BoardRateOverride => ({
        ...o,
        date_from: toIsoDate(o.date_from),
        date_to: toIsoDate(o.date_to),
      }),
    ),
    // `getEffectiveRoomDailyPricingBatch` returns camelCase rows
     // (`roomId`, `minNights`, …) but `BoardDailyPricing` + `getCellPricing`
    // expect snake_case. Normalise to snake_case here so the cell renderer
    // can actually read per-room per-date overrides (min_nights, max_nights,
    // closed-on-arrival / closed-on-departure flags written by bulk-update).
    dailyPricing: raw.dailyPricing.map((p): BoardDailyPricing => {
      const r = p as unknown as {
        roomId?: string
        room_id?: string
        date: unknown
        price: number | string | null
        minNights?: number | null
        min_nights?: number | null
        maxNights?: number | null
        max_nights?: number | null
        minNightsOnArrival?: number | null
        min_nights_on_arrival?: number | null
        isClosed?: boolean
        is_closed?: boolean
        closedOnArrival?: boolean
        closed_on_arrival?: boolean
        closedOnDeparture?: boolean
        closed_on_departure?: boolean
      }
      return {
        room_id: r.room_id ?? r.roomId ?? "",
        date: toIsoDate(r.date),
        price: r.price ?? 0,
        min_nights: r.min_nights ?? r.minNights ?? null,
        max_nights: r.max_nights ?? r.maxNights ?? null,
        min_nights_on_arrival:
          r.min_nights_on_arrival ?? r.minNightsOnArrival ?? null,
        is_closed: r.is_closed ?? r.isClosed ?? false,
        closed_on_arrival: r.closed_on_arrival ?? r.closedOnArrival ?? false,
        closed_on_departure:
          r.closed_on_departure ?? r.closedOnDeparture ?? false,
      }
    }),
    operationalTimes: {
      default_checkin_time: toHHMM(raw.operationalTimes?.default_checkin_time),
      default_checkout_time: toHHMM(raw.operationalTimes?.default_checkout_time),
      sabbath_checkin_time: toHHMM(raw.operationalTimes?.sabbath_checkin_time),
      sabbath_checkout_time: toHHMM(raw.operationalTimes?.sabbath_checkout_time),
    },
  }
}

interface UseBoardDataArgs {
  tenantId: string
  startDate: string // inclusive
  endDate: string // exclusive
}

const EMPTY_DATA: BoardData = {
  rooms: [],
  reservations: [],
  rateOverrides: [],
  ratePlans: [],
  blocks: [],
  dailyPricing: [],
  currency: "ILS",
  operationalTimes: {
    default_checkin_time: "15:00",
    default_checkout_time: "11:00",
    sabbath_checkin_time: null,
    sabbath_checkout_time: null,
  },
}

const POLL_INTERVAL_MS = 20_000

/**
 * Loads board data and keeps it fresh via Supabase Realtime + a polling fallback.
 *
 * Realtime channel subscribes to `reservations`, `reservation_rooms`, `room_blocks`,
 * and `rooms` — any event triggers a debounced refetch of the current window.
 * If realtime isn't enabled server-side, the 20s poll keeps the board current.
 */
export function useBoardData({ tenantId, startDate, endDate }: UseBoardDataArgs) {
  const [data, setData] = useState<BoardData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<number>(0)

  const fetchNow = useCallback(async () => {
    const ticket = ++abortRef.current
    try {
      const result = (await getCalendarData(tenantId, startDate, endDate)) as unknown as BoardData
      if (ticket !== abortRef.current) return
      setData(normalise(result))
      setError(null)
    } catch (e) {
      if (ticket !== abortRef.current) return
      setError(e instanceof Error ? e.message : "שגיאה בטעינת הלוח")
    } finally {
      if (ticket === abortRef.current) setLoading(false)
    }
  }, [tenantId, startDate, endDate])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(() => {
      fetchNow()
    }, 300)
  }, [fetchNow])

  useEffect(() => {
    setLoading(true)
    fetchNow()
  }, [fetchNow])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClientSupabase()
    const channel = supabase
      .channel(`board-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `tenant_id=eq.${tenantId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_rooms",
          filter: `tenant_id=eq.${tenantId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_blocks",
          filter: `tenant_id=eq.${tenantId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `tenant_id=eq.${tenantId}` },
        scheduleRefetch,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, scheduleRefetch])

  // Polling fallback
  useEffect(() => {
    const id = setInterval(() => {
      fetchNow()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchNow])

  // Refetch on tab focus
  useEffect(() => {
    const onFocus = () => fetchNow()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [fetchNow])

  return { data, loading, error, refetch: fetchNow }
}

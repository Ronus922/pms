"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"

/* ── Types ─────────────────────────────────────────────────── */

export type DateFilterType = "arrivals" | "departures" | "created" | "cancelled" | ""
export type StatusFilterValue = "confirmed" | "no_show" | "maintenance" | "unpaid" | ""
export type PresetKey =
  | "created_24h"
  | "cancelled_24h"
  | "pending"
  | "unpaid"
  | "in_house"
  | "arrivals_today"
  | "departures_today"

export interface ReservationSearchFilters {
  dateType: DateFilterType
  dateFrom: string
  dateTo: string
  agent: string
  status: StatusFilterValue
  presets: PresetKey[]
}

export interface ReservationSearchRow {
  id: string
  reservation_number: string
  first_name: string
  last_name: string
  check_in: string
  check_out: string
  nights: number
  total_guests: number
  total_price: number
  status: string
  payment_status: string
  agent: string | null
  source: string | null
  created_at: string
  adults: number
  children: number
  infants: number
  guest_id: string
  guest_phone: string | null
  guest_email: string | null
  row_total: number
}

export interface ReservationSearchResult {
  rows: ReservationSearchRow[]
  total: number
}

/* ── Helpers ───────────────────────────────────────────────── */

type Sql = ReturnType<typeof db>

function joinAnd(fragments: Sql[]): Sql {
  if (fragments.length === 0) return db`TRUE`
  return fragments.reduce((acc, f, i) => (i === 0 ? f : db`${acc} AND ${f}`))
}

/* ── Main search ───────────────────────────────────────────── */

export async function searchReservations(
  _tenantId: string,
  filters: ReservationSearchFilters
): Promise<ReservationSearchResult> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const conds: Sql[] = [db`r.tenant_id = ${tenantId}`]

  // ── Date type + range ──
  // SECURITY: NEVER pass user-controlled strings into db.unsafe.
  // Each branch uses a fully-qualified, hardcoded SQL fragment so the
  // dateCol identifier never reaches the SQL builder dynamically.
  if (filters.dateType && (filters.dateFrom || filters.dateTo)) {
    switch (filters.dateType) {
      case "arrivals":
        if (filters.dateFrom) conds.push(db`r.check_in::date >= ${filters.dateFrom}::date`)
        if (filters.dateTo) conds.push(db`r.check_in::date <= ${filters.dateTo}::date`)
        break
      case "departures":
        if (filters.dateFrom) conds.push(db`r.check_out::date >= ${filters.dateFrom}::date`)
        if (filters.dateTo) conds.push(db`r.check_out::date <= ${filters.dateTo}::date`)
        break
      case "created":
        if (filters.dateFrom) conds.push(db`r.created_at::date >= ${filters.dateFrom}::date`)
        if (filters.dateTo) conds.push(db`r.created_at::date <= ${filters.dateTo}::date`)
        break
      case "cancelled":
        conds.push(db`r.status = 'cancelled'`)
        if (filters.dateFrom) conds.push(db`r.updated_at::date >= ${filters.dateFrom}::date`)
        if (filters.dateTo) conds.push(db`r.updated_at::date <= ${filters.dateTo}::date`)
        break
      default:
        // Unknown date type — silently ignore (defense in depth).
        break
    }
  }

  // ── Agent ──
  if (filters.agent) {
    conds.push(db`r.agent = ${filters.agent}`)
  }

  // ── Status ──
  if (filters.status) {
    switch (filters.status) {
      case "confirmed":
        conds.push(db`r.status = 'confirmed'`)
        break
      case "no_show":
        conds.push(db`r.status = 'no_show'`)
        break
      case "maintenance":
        conds.push(db`EXISTS(
          SELECT 1 FROM reservation_rooms rr
          JOIN rooms rm ON rm.id = rr.room_id
          WHERE rr.reservation_id = r.id AND rm.status = 'maintenance'
        )`)
        break
      case "unpaid":
        conds.push(db`r.payment_status = 'unpaid' AND r.status NOT IN ('cancelled')`)
        break
    }
  }

  // ── Presets ──
  for (const preset of filters.presets) {
    switch (preset) {
      case "created_24h":
        conds.push(db`r.created_at >= NOW() - INTERVAL '24 hours'`)
        break
      case "cancelled_24h":
        conds.push(db`r.status = 'cancelled' AND r.updated_at >= NOW() - INTERVAL '24 hours'`)
        break
      case "pending":
        conds.push(db`r.status = 'pending'`)
        break
      case "unpaid":
        conds.push(db`r.payment_status = 'unpaid' AND r.status NOT IN ('cancelled')`)
        break
      case "in_house":
        conds.push(db`r.check_in::date <= CURRENT_DATE AND r.check_out::date >= CURRENT_DATE AND r.status NOT IN ('cancelled','no_show')`)
        break
      case "arrivals_today":
        conds.push(db`r.check_in::date = CURRENT_DATE`)
        break
      case "departures_today":
        conds.push(db`r.check_out::date = CURRENT_DATE`)
        break
    }
  }

  const where = joinAnd(conds)

  const rows = await db`
    SELECT
      r.id,
      r.reservation_number,
      g.first_name,
      g.last_name,
      r.check_in,
      r.check_out,
      (r.check_out::date - r.check_in::date) AS nights,
      (r.adults + COALESCE(r.children, 0) + COALESCE(r.infants, 0)) AS total_guests,
      r.total_price,
      r.status,
      r.payment_status,
      r.agent,
      r.source,
      r.created_at,
      r.adults,
      r.children,
      r.infants,
      g.id   AS guest_id,
      g.phone AS guest_phone,
      g.email AS guest_email,
      COUNT(*) OVER() AS row_total
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE ${where}
    ORDER BY r.check_in DESC
    LIMIT 200
  `

  const total = rows.length > 0 ? Number(rows[0].row_total) : 0

  return {
    rows: rows as unknown as ReservationSearchRow[],
    total,
  }
}

/* ── Agent options ─────────────────────────────────────────── */

export async function getAgentOptions(_tenantId: string): Promise<string[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const result = await db`
    SELECT DISTINCT agent
    FROM reservations
    WHERE tenant_id = ${tenantId} AND agent IS NOT NULL AND agent != ''
    ORDER BY agent
  `
  return result.map((r) => r.agent as string)
}

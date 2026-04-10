"use client"

import { useState, useEffect, useCallback } from "react"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  searchReservations,
  getAgentOptions,
  type ReservationSearchFilters,
  type ReservationSearchRow,
} from "@/lib/actions/reservation-search"
import { ReservationFilters } from "@/components/guests/ReservationFilters"
import { ReservationTable } from "@/components/guests/ReservationTable"
import { BookingSidePanel } from "@/components/guests/BookingSidePanel"

/* ── Empty filter state ────────────────────────────────────── */

const EMPTY_FILTERS: ReservationSearchFilters = {
  dateType: "",
  dateFrom: "",
  dateTo: "",
  agent: "",
  status: "",
  presets: [],
}

/* ── Component ─────────────────────────────────────────────── */

export function GuestsPageClient() {
  const { tenantId } = useTenant()

  // Single source of truth: filters
  const [filters, setFilters] = useState<ReservationSearchFilters>(EMPTY_FILTERS)

  // Data
  const [rows, setRows] = useState<ReservationSearchRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Agent options for dropdown
  const [agents, setAgents] = useState<string[]>([])

  // Selected reservation for side panel
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)

  // Load agent options once
  useEffect(() => {
    if (tenantId) {
      getAgentOptions(tenantId).then(setAgents)
    }
  }, [tenantId])

  // Fetch data when filters change
  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const result = await searchReservations(tenantId, filters)
    setRows(result.rows)
    setTotal(result.total)
    setLoading(false)
  }, [tenantId, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handlers
  function handleFilterChange(next: ReservationSearchFilters) {
    setFilters(next)
  }

  function handleClearAll() {
    setFilters(EMPTY_FILTERS)
  }

  function handleRowClick(row: ReservationSearchRow) {
    setSelectedReservationId(row.id)
  }

  function handlePanelClose() {
    setSelectedReservationId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-3xl font-extrabold font-headline">אורחים</h1>

      {/* Filters */}
      <ReservationFilters
        filters={filters}
        onChange={handleFilterChange}
        onClearAll={handleClearAll}
        agents={agents}
        total={total}
      />

      {/* Table or loading */}
      {loading ? (
        <div className="bg-card rounded-[20px] border border-border/20 shadow-sm">
          <div className="animate-pulse space-y-0">
            <div className="h-12 bg-accent/50 rounded-t-[20px]" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-border/10 flex items-center gap-4 px-4">
                <div className="h-4 w-24 bg-accent rounded" />
                <div className="h-4 w-20 bg-accent rounded" />
                <div className="h-4 w-16 bg-accent rounded" />
                <div className="h-4 w-16 bg-accent rounded" />
                <div className="h-4 w-10 bg-accent rounded" />
                <div className="h-4 w-10 bg-accent rounded" />
                <div className="h-4 w-16 bg-accent rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ReservationTable
          rows={rows}
          onRowClick={handleRowClick}
          selectedId={selectedReservationId}
        />
      )}

      {/* Loading overlay for subsequent fetches */}
      {loading && rows.length > 0 && (
        <div className="fixed inset-0 z-30 pointer-events-none flex items-start justify-center pt-32">
          <div className="bg-card/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-border/20">
            <span className="text-sm font-bold text-muted-foreground">טוען...</span>
          </div>
        </div>
      )}

      {/* Booking side panel */}
      <BookingSidePanel
        reservationId={selectedReservationId}
        tenantId={tenantId}
        onClose={handlePanelClose}
        onUpdate={fetchData}
      />
    </div>
  )
}

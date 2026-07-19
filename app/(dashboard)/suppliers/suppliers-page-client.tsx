"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import { getSupplierList } from "@/lib/actions/suppliers"
import { SupplierCard } from "@/components/suppliers/SupplierCard"
import { SupplierTable } from "@/components/suppliers/SupplierTable"
import { SupplierFilters } from "@/components/suppliers/SupplierFilters"
import { CreateSupplierPanel } from "@/components/suppliers/CreateSupplierPanel"
import { SupplierDetailPanel } from "@/components/suppliers/SupplierDetailPanel"
import { SupplierCategoriesPanel } from "@/components/suppliers/SupplierCategoriesPanel"
import type { Supplier, SupplierFilters as SupplierFiltersType, SupplierStatus } from "@/lib/types/suppliers"

/* ── View Mode ─────────────────────────────────────────────── */

type ViewMode = "table" | "cards"

/* ── Component ─────────────────────────────────────────────── */

export function SuppliersPageClient() {
  const { tenantId } = useTenant()
  const { can } = usePermissions()
  const canEdit = can("suppliers", "edit")

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [filters, setFilters] = useState<SupplierFiltersType>({
    search: "",
    status: "all",
    type: "all",
  })

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    const data = await getSupplierList(tenantId, filters)
    setSuppliers(data)
    setLoading(false)
  }, [tenantId, filters])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  function handleSearchChange(search: string) {
    setFilters((prev) => ({ ...prev, search }))
  }

  function handleStatusChange(status: SupplierStatus | "all") {
    setFilters((prev) => ({ ...prev, status }))
  }

  function handleTypeChange(type: string | "all") {
    setFilters((prev) => ({ ...prev, type }))
  }

  function handleCreated() {
    loadSuppliers()
  }

  function handleUpdated() {
    loadSuppliers()
    setSelectedSupplierId(null)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline">ספקים</h1>
          <p className="text-sm text-muted-foreground mt-1">ניהול ספקים וקבלנים</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full tabular-nums">
            {suppliers.length} ספקים
          </span>

          {/* View Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("table")}
              className={`pill-filter ${viewMode === "table" ? "pill-filter-active" : ""}`}
            >
              <Icon name="table_rows" size="sm" />
              טבלה
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`pill-filter ${viewMode === "cards" ? "pill-filter-active" : ""}`}
            >
              <Icon name="grid_view" size="sm" />
              כרטיסים
            </button>
          </div>

          {canEdit && (
            <>
              <button
                onClick={() => setShowCategories(true)}
                className="flex items-center gap-2 bg-muted border border-border text-foreground font-bold text-sm rounded-xl hover:bg-border transition-colors min-h-[44px] px-5 py-2.5"
              >
                <Icon name="category" size="sm" />
                הוסף תחום
              </button>

              <button
                onClick={() => setShowCreate(true)}
                className="btn btn-primary"
              >
                <Icon name="add" size="sm" className="text-primary-foreground" />
                ספק חדש
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <SupplierFilters
        filters={filters}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
      />

      {/* ── Supplier List ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען ספקים...</p>
        </div>
      ) : viewMode === "table" ? (
        <SupplierTable
          suppliers={suppliers}
          onSupplierClick={(s) => setSelectedSupplierId(s.id)}
        />
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="local_shipping" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">לא נמצאו ספקים</p>
          <p className="text-sm">נסו לשנות את מסנני החיפוש או להוסיף ספק חדש</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onClick={() => setSelectedSupplierId(s.id)}
            />
          ))}
        </div>
      )}

      {/* ── Panels ─────────────────────────────────────────── */}
      <CreateSupplierPanel
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      <SupplierDetailPanel
        supplierId={selectedSupplierId}
        onClose={() => setSelectedSupplierId(null)}
        onUpdated={handleUpdated}
      />

      <SupplierCategoriesPanel
        isOpen={showCategories}
        onClose={() => setShowCategories(false)}
      />
    </div>
  )
}

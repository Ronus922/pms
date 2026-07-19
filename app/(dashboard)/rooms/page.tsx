"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { RoomFormDialog } from "@/components/rooms/RoomFormDialog"
import { RoomTypesDialog } from "@/components/rooms/RoomTypesDialog"
import { AddTargetDialog } from "@/components/rooms/AddTargetDialog"
import { AreaFormPanel } from "@/components/rooms/AreaFormPanel"
import { useRoomFormStore } from "@/lib/stores/room-form-store"
import { useRoomTypesStore } from "@/lib/stores/room-types-store"
import { useAreaFormStore } from "@/lib/stores/area-form-store"
import { getRoomsWithDerivedStatus, type RoomWithDerivedStatus } from "@/lib/actions/rooms-status"
import { getAreas } from "@/lib/actions/areas"
import { useTenant } from "@/lib/hooks/use-tenant"
import { ROOM_STATE_DISPLAY, type RoomDisplayState } from "@/lib/constants/room-display"
import { AREA_CARD_STYLE, ROOM_CARD_BADGE, TARGET_TYPE_FILTERS, type TargetTypeFilter } from "@/lib/constants/area-display"
import type { Area } from "@/lib/types/area"

/* ── Unified grid item ────────────────────────────────────── */

interface GridItem {
  id: string
  targetType: "room" | "area"
  label: string
  sublabel: string
  floorName: string
  buildingName: string | null
  borderClass: string
  statusIcon: string
  statusLabel: string
  maxOccupancy?: number | null
  /** Only for rooms */
  roomData?: RoomWithDerivedStatus
  /** Only for areas */
  areaData?: Area
}

function roomToGridItem(r: RoomWithDerivedStatus): GridItem {
  const st = ROOM_STATE_DISPLAY[r.display_state] || ROOM_STATE_DISPLAY.available
  return {
    id: r.id,
    targetType: "room",
    label: r.room_number,
    sublabel: r.room_type_name ?? "",
    floorName: r.floor_name || "ללא קומה",
    buildingName: r.building_name,
    borderClass: st.border,
    statusIcon: st.icon,
    statusLabel: st.label,
    maxOccupancy: r.max_occupancy,
    roomData: r,
  }
}

function areaToGridItem(a: Area): GridItem {
  return {
    id: a.id,
    targetType: "area",
    label: a.name,
    sublabel: a.area_type_label ?? a.area_type,
    floorName: a.floor_name || "ללא קומה",
    buildingName: a.building_name ?? null,
    borderClass: AREA_CARD_STYLE.border,
    statusIcon: a.is_active ? "check_circle" : "cancel",
    statusLabel: a.is_active ? "פעיל" : "לא פעיל",
    areaData: a,
  }
}

/* ── Page Component ───────────────────────────────────────── */

export default function RoomsPage() {
  const { tenantId } = useTenant()
  const roomTypesStore = useRoomTypesStore()
  const roomFormStore = useRoomFormStore()
  const areaFormStore = useAreaFormStore()

  const [rooms, setRooms] = useState<RoomWithDerivedStatus[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | RoomDisplayState>("all")
  const [targetFilter, setTargetFilter] = useState<TargetTypeFilter>("all")
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    const [roomData, areaData] = await Promise.all([
      getRoomsWithDerivedStatus(tenantId),
      getAreas(tenantId, true),
    ])
    setRooms(roomData)
    setAreas(areaData)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter rooms by status
  const filteredRooms = statusFilter === "all"
    ? rooms
    : rooms.filter((r) => r.display_state === statusFilter)

  // Build unified grid items based on target filter
  const gridItems: GridItem[] = []
  if (targetFilter !== "areas") {
    gridItems.push(...filteredRooms.map(roomToGridItem))
  }
  if (targetFilter !== "rooms") {
    gridItems.push(...areas.map(areaToGridItem))
  }

  // Group by floor
  const grouped = new Map<string, GridItem[]>()
  for (const item of gridItems) {
    const key = item.floorName
    const list = grouped.get(key) || []
    list.push(item)
    grouped.set(key, list)
  }

  // Counts
  const roomCount = targetFilter !== "areas" ? filteredRooms.length : 0
  const areaCount = targetFilter !== "rooms" ? areas.length : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold font-headline">חדרים ואזורים</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full">
            {targetFilter === "areas"
              ? `${areaCount} אזורים`
              : targetFilter === "rooms"
                ? `${roomCount} חדרים`
                : `${roomCount} חדרים · ${areaCount} אזורים`}
          </span>
          <button
            onClick={() => roomTypesStore.open()}
            className="btn btn-outline"
          >
            <Icon name="layers" size="sm" />
            סוגי חדרים
          </button>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="btn btn-primary"
          >
            <Icon name="add" size="sm" />
            הוסף חדר / אזור
          </button>
        </div>
      </div>

      {/* Target type filter */}
      <div className="flex gap-2 flex-wrap">
        {TARGET_TYPE_FILTERS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTargetFilter(key)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 ${
              targetFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border/20 text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon name={icon} size="sm" />
            {label}
          </button>
        ))}
      </div>

      {/* Room status filter — only visible when rooms are shown */}
      {targetFilter !== "areas" && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border/20 text-muted-foreground hover:bg-accent"
            }`}
          >
            הכל
          </button>
          {(Object.entries(ROOM_STATE_DISPLAY) as [RoomDisplayState, typeof ROOM_STATE_DISPLAY[RoomDisplayState]][]).map(
            ([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 ${
                  statusFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border/20 text-muted-foreground hover:bg-accent"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </button>
            ),
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="hourglass_empty" size="xl" className="mx-auto mb-2 opacity-30" />
          <p>טוען...</p>
        </div>
      ) : gridItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="search_off" size="xl" className="mx-auto mb-2 opacity-30" />
          <p>לא נמצאו תוצאות</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([floor, items]) => (
          <div key={floor}>
            <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <Icon name="layers" size="sm" />
              {floor}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {items.map((item) =>
                item.targetType === "room" ? (
                  <RoomCard key={item.id} item={item} onEdit={() => roomFormStore.open(item.id)} showBadge={targetFilter === "all"} />
                ) : (
                  <AreaCard key={item.id} item={item} onEdit={() => areaFormStore.open(item.id)} />
                ),
              )}
            </div>
          </div>
        ))
      )}

      {/* Dialogs */}
      <AddTargetDialog
        isOpen={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSelectRoom={() => roomFormStore.open()}
        onSelectArea={() => areaFormStore.open()}
      />
      <RoomFormDialog onSaved={loadData} />
      <RoomTypesDialog onSaved={loadData} />
      <AreaFormPanel onSaved={loadData} />
    </div>
  )
}

/* ── Room Card ────────────────────────────────────────────── */

function RoomCard({ item, onEdit, showBadge }: { item: GridItem; onEdit: () => void; showBadge: boolean }) {
  return (
    <div
      onClick={onEdit}
      className={`bg-card rounded-[20px] p-5 shadow-sm border-r-4 hover:shadow-md transition-all cursor-pointer group ${item.borderClass}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl font-extrabold">{item.label}</span>
        {showBadge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROOM_CARD_BADGE.badgeBg} ${ROOM_CARD_BADGE.badgeText}`}>
            {ROOM_CARD_BADGE.badgeLabel}
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-muted-foreground mb-1">{item.sublabel}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Icon name={item.statusIcon} size="sm" /> {item.statusLabel}
        </span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Icon name="group" size="sm" /> {item.maxOccupancy ?? 0}
        </span>
      </div>
    </div>
  )
}

/* ── Area Card ────────────────────────────────────────────── */

function AreaCard({ item, onEdit }: { item: GridItem; onEdit: () => void }) {
  const area = item.areaData
  return (
    <div
      onClick={onEdit}
      className={`bg-card rounded-[20px] p-5 shadow-sm border-r-4 hover:shadow-md transition-all cursor-pointer group ${AREA_CARD_STYLE.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-lg font-extrabold">{item.label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${AREA_CARD_STYLE.badgeBg} ${AREA_CARD_STYLE.badgeText}`}>
          {AREA_CARD_STYLE.badgeLabel}
        </span>
      </div>
      <p className="text-xs font-bold text-muted-foreground mb-1">{item.sublabel}</p>
      <div className="flex items-center gap-2">
        {area?.cleaning_relevant && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5" title="רלוונטי לניקיון">
            <Icon name="cleaning_services" size="sm" />
          </span>
        )}
        {area?.maintenance_relevant && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5" title="רלוונטי לתחזוקה">
            <Icon name="build" size="sm" />
          </span>
        )}
        {area?.code && (
          <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{area.code}</span>
        )}
      </div>
    </div>
  )
}

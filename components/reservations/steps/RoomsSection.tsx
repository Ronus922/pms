"use client"

import { useState, useEffect, useMemo } from "react"
import { Icon } from "@/components/shared/Icon"
import { useReservationFormStore, type ReservationRoom } from "@/lib/stores/reservation-form-store"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { RoomBlock, type RoomTypeOption } from "./RoomBlock"

/* ── Helpers ────────────────────────────────────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon name={icon} size="md" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  if (!iso) return ""
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Build a fresh ReservationRoom with defaults. Dates/composition are copied
 *  from the optional seed (first block) so "הוסף חדר נוסף" keeps context. */
export function makeEmptyRoom(seed: {
  checkIn?: string
  checkOut?: string
  adults?: number
  children?: number
  infants?: number
  firstName?: string
  lastName?: string
} = {}): ReservationRoom {
  const ci = seed.checkIn || todayIso()
  const co = seed.checkOut || addDaysIso(ci, 1)
  return {
    // eslint-disable-next-line react-hooks/purity -- event-handler time-based id
    id: `rb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: "",
    roomNumber: "",
    roomTypeId: "",
    roomTypeName: "",
    boardType: "room_only",
    ratePerNight: 0,
    basePrice: 0,
    defaultOccupancy: 1,
    extraPersonPrice: 0,
    maxOccupancy: 0,
    maxAdults: 0,
    maxChildren: 0,
    maxInfants: 0,
    checkIn: ci,
    checkOut: co,
    adults: seed.adults ?? 1,
    children: seed.children ?? 0,
    infants: seed.infants ?? 0,
    guestFirstName: seed.firstName ?? "",
    guestLastName: seed.lastName ?? "",
    guestPhone: "",
    guestEmail: "",
    guestIdNumber: "",
  }
}

/* ── Main ───────────────────────────────────────────────────── */

export function RoomsSection() {
  const { tenantId } = useTenant()
  const store = useReservationFormStore()

  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])

  /* Load room types (shared across all blocks). */
  useEffect(() => {
    let cancelled = false
    async function load() {
      const opts = await getFormOptions(tenantId)
      if (cancelled) return
      setRoomTypes(opts.roomTypes as unknown as RoomTypeOption[])
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  /* Auto-seed first block when the panel opens empty — gives the user inputs
     immediately without having to click "add" first. */
  useEffect(() => {
    if (store.rooms.length === 0) {
      store.addRoom(makeEmptyRoom({
        checkIn: store.checkIn,
        checkOut: store.checkOut,
        adults: store.adults,
        children: store.children,
        infants: store.infants,
        firstName: store.firstName,
        lastName: store.lastName,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seed
  }, [])

  const selectedRoomIds = useMemo(
    () => new Set(store.rooms.map((r) => r.roomId).filter(Boolean)),
    [store.rooms],
  )

  function addAnotherBlock() {
    const first = store.rooms[0]
    store.addRoom(makeEmptyRoom({
      checkIn: first?.checkIn || store.checkIn,
      checkOut: first?.checkOut || store.checkOut,
      adults: first?.adults ?? 1,
      children: first?.children ?? 0,
      infants: first?.infants ?? 0,
      firstName: store.firstName,
      lastName: store.lastName,
    }))
  }

  return (
    <SectionCard title="חדרים" icon="bed">
      <div className="space-y-4">
        {store.rooms.map((block, idx) => (
          <RoomBlock
            key={block.id}
            block={block}
            index={idx}
            canRemove={store.rooms.length > 1}
            roomTypes={roomTypes}
            selectedRoomIds={selectedRoomIds}
            tenantId={tenantId}
            minCheckInDate="today"
            mainFirstNamePlaceholder={store.firstName}
            mainLastNamePlaceholder={store.lastName}
            /* First room inherits the main guest from the top of the form —
             * duplicate fields hidden per product requirement. */
            hideGuestOverride={idx === 0}
            onChange={(partial) => store.updateRoom(block.id, partial)}
            onRemove={() => store.removeRoom(block.id)}
          />
        ))}

        <button
          type="button"
          onClick={addAnotherBlock}
          className="w-full border-2 border-dashed border-border/30 rounded-xl py-4 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[44px] flex items-center justify-center gap-2"
        >
          <Icon name="add" size="sm" />
          הוסף חדר נוסף
        </button>

        {store.errors.roomId && (
          <p className="text-[11px] text-destructive mt-2 flex items-center gap-1">
            <Icon name="error" size="sm" />
            {store.errors.roomId}
          </p>
        )}
      </div>
    </SectionCard>
  )
}

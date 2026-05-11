"use client"

import { useState, useEffect, useMemo } from "react"
import { Icon } from "@/components/shared/Icon"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { getFormOptions } from "@/lib/actions/create-reservation"
import { useTenant } from "@/lib/hooks/use-tenant"
import { RoomBlock, type RoomTypeOption } from "@/components/reservations/steps/RoomBlock"
import { makeEmptyRoom } from "@/components/reservations/steps/RoomsSection"

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

/* ── Edit flow wrapper ──────────────────────────────────────── */

export function EditRoomsSection() {
  const { tenantId } = useTenant()
  const store = useReservationEditStore()

  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])

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

  const selectedRoomIds = useMemo(
    () => new Set(store.editableRooms.map((r) => r.roomId).filter(Boolean)),
    [store.editableRooms],
  )

  function addAnotherBlock() {
    const first = store.editableRooms[0]
    store.addEditableRoom(makeEmptyRoom({
      checkIn: first?.checkIn || store.data.checkIn,
      checkOut: first?.checkOut || store.data.checkOut,
      adults: first?.adults ?? 1,
      children: first?.children ?? 0,
      infants: first?.infants ?? 0,
      firstName: store.data.firstName,
      lastName: store.data.lastName,
    }))
  }

  return (
    <SectionCard title="חדרים" icon="bed">
      <div className="space-y-4">
        {store.editableRooms.length === 0 && (
          <div className="text-center py-6 bg-accent/30 rounded-xl border border-dashed border-border/30">
            <p className="text-sm text-muted-foreground">לא שויכו חדרים — הוסף חדר כדי להמשיך.</p>
          </div>
        )}

        {store.editableRooms.map((block, idx) => (
          <RoomBlock
            key={block.id}
            block={block}
            index={idx}
            canRemove={store.editableRooms.length > 1}
            roomTypes={roomTypes}
            selectedRoomIds={selectedRoomIds}
            tenantId={tenantId}
            /* Edit flow must exclude the reservation being edited from
             * availability checks — its own rows are NOT conflicts. */
            excludeReservationId={store.reservationId}
            /* Allow historical dates in edit mode (past reservations). */
            minCheckInDate=""
            mainFirstNamePlaceholder={store.data.firstName}
            mainLastNamePlaceholder={store.data.lastName}
            hideGuestOverride={idx === 0}
            onChange={(partial) => store.updateEditableRoom(block.id, partial)}
            onRemove={() => store.removeEditableRoom(block.id)}
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

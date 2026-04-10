"use client"

import { useEffect } from "react"
import { ExistingReservationPanel } from "@/components/reservations/ExistingReservationPanel"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"

interface Props {
  reservationId: string | null
  tenantId: string
  onClose: () => void
  onUpdate?: () => void
}

export function BookingSidePanel({ reservationId, tenantId, onClose, onUpdate }: Props) {
  const editStore = useReservationEditStore()

  // Open the edit panel when reservationId changes
  useEffect(() => {
    if (reservationId && tenantId) {
      editStore.open(reservationId, tenantId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, tenantId])

  // Sync close from parent
  useEffect(() => {
    if (!editStore.isOpen && reservationId) {
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editStore.isOpen])

  return <ExistingReservationPanel onSaved={onUpdate} />
}

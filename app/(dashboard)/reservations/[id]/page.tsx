"use client"

import { useParams } from "next/navigation"
import { ReservationDetailView } from "@/components/reservations/ReservationDetailView"
import { useTenant } from "@/lib/hooks/use-tenant"

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = useTenant()

  return <ReservationDetailView reservationId={id} tenantId={tenantId} />
}

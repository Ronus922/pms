"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { getReservationFull } from "@/lib/actions/reservation-detail"

export interface ReservationExportData {
  reservation: Awaited<ReturnType<typeof getReservationFull>>
  tenant: { name: string; notification_email: string | null } | null
}

export async function getReservationForExport(reservationId: string): Promise<ReservationExportData | null> {
  const actor = await requireActor()
  const reservation = await getReservationFull(reservationId)
  if (!reservation) return null

  const tenantId = actor.tenantId
  const [tenant] = await db`
    SELECT name, notification_email FROM tenants WHERE id = ${tenantId}
  ` as unknown as Array<{ name: string; notification_email: string | null }>

  return { reservation, tenant: tenant ?? null }
}

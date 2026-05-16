import { getReservationFull } from "@/lib/actions/reservation-detail"
import { db } from "@/lib/db"
import { ReservationPrintView } from "@/components/reservations/print/ReservationPrintView"
import { PrintTrigger } from "@/components/reservations/print/PrintTrigger"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ preview?: string }>
}

export default async function ReservationPrintPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const isPreview = sp?.preview === "true"

  const reservation = await getReservationFull(id)
  if (!reservation) {
    return <div style={{ padding: "48px", textAlign: "center", direction: "rtl" }}>הזמנה לא נמצאה</div>
  }

  const tenantId = (reservation as unknown as { tenant_id: string }).tenant_id
  const [tenant] = await db`
    SELECT name, notification_email FROM tenants WHERE id = ${tenantId}
  ` as unknown as Array<{ name: string; notification_email: string | null }>

  return (
    <>
      <ReservationPrintView reservation={reservation as never} tenant={tenant ?? null} />
      {!isPreview && <PrintTrigger />}
    </>
  )
}

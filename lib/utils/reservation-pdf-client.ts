"use client"

import { pdf } from "@react-pdf/renderer"
import { createElement } from "react"
import { ReservationPdfDocument, type PdfReservation } from "@/components/reservations/pdf/ReservationPdfDocument"
import { getReservationForExport } from "@/lib/actions/reservation-export-data"
import { downloadBlob } from "@/lib/utils/reservation-export-client"

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "reservation"
}

export async function downloadReservationPdf(reservationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await getReservationForExport(reservationId)
    if (!data || !data.reservation) return { success: false, error: "הזמנה לא נמצאה" }
    const r = data.reservation as unknown as Record<string, unknown>

    const pdfRes: PdfReservation = {
      reservation_number: String(r.reservation_number || ""),
      status: String(r.status || ""),
      payment_status: String(r.payment_status || ""),
      source: String(r.source || ""),
      check_in: String(r.check_in || ""),
      check_out: String(r.check_out || ""),
      adults: Number(r.adults || 0),
      children: Number(r.children || 0),
      infants: Number(r.infants || 0),
      guest_name: String(r.guest_name || ""),
      guest_email: String(r.guest_email || ""),
      guest_phone: String(r.guest_phone || ""),
      guest_country: (r.guest_country as string | null) ?? null,
      guest_id_number: (r.guest_id_number as string | null) ?? null,
      total_price: Number(r.total_price || 0),
      total_paid: Number(r.total_paid || 0),
      balance_due: Number(r.balance_due || 0),
      subtotal: Number(r.subtotal || 0),
      tax_amount: Number(r.tax_amount || 0),
      discount_percent: Number(r.discount_percent || 0),
      currency: "ILS",
      special_requests: (r.special_requests as string | null) ?? null,
      general_notes: (r.general_notes as string | null) ?? null,
      rooms: (r.rooms as PdfReservation["rooms"]) || [],
      charges: (r.charges as PdfReservation["charges"]) || [],
      payments: (r.payments as PdfReservation["payments"]) || [],
    }

    const businessName = data.tenant?.name || "GuestHub"
    const businessEmail = data.tenant?.notification_email || null

    const doc = createElement(ReservationPdfDocument, {
      reservation: pdfRes,
      businessName,
      businessEmail,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob()

    const filename = `${sanitizeFilename(`הזמנה-${pdfRes.reservation_number}`)}.pdf`
    downloadBlob(blob, filename)
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת PDF"
    return { success: false, error: msg }
  }
}

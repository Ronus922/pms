"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { getReservationFull } from "@/lib/actions/reservation-detail"
import { interpolate } from "@/lib/utils/interpolate-template"
import type { AutomationTemplate } from "@/lib/types/automations"

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDateHeb(v: unknown): string {
  if (!v) return ""
  const d = v instanceof Date ? v : new Date(String(v))
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function diffDays(a: unknown, b: unknown): number {
  if (!a || !b) return 0
  const x = new Date(String(a)).getTime()
  const y = new Date(String(b)).getTime()
  return Math.max(0, Math.round((y - x) / 86400000))
}

function fmtMoney(n: unknown, c = "ILS"): string {
  const sym = c === "USD" ? "$" : c === "EUR" ? "€" : "₪"
  return `${sym}${Number(n || 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function renderReservationTemplate(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  reservationId: string,
  templateId: string,
): Promise<{ success: boolean; subject?: string; body?: string; error?: string }> {
  try {
    const actor = await requireActor()
    const tenantId = actor.tenantId
    const [template] = await db`
      SELECT * FROM automation_templates WHERE id = ${templateId} AND tenant_id = ${tenantId}
    ` as unknown as [AutomationTemplate | undefined]
    if (!template) return { success: false, error: "תבנית לא נמצאה" }

    const reservation = await getReservationFull(reservationId)
    if (!reservation) return { success: false, error: "הזמנה לא נמצאה" }
    const r = reservation as unknown as Record<string, unknown>

    const [tenant] = await db`
      SELECT name, notification_email FROM tenants WHERE id = ${tenantId}
    ` as unknown as Array<{ name: string; notification_email: string | null }>

    type Room = { room_number: string }
    const rooms = (r.rooms as Room[]) || []
    const roomNumbers = rooms.map((rm) => rm.room_number).filter(Boolean).join(", ")
    const adults = Number(r.adults || 0)
    const children = Number(r.children || 0)
    const infants = Number(r.infants || 0)

    const vars: Record<string, string> = {
      business_name: tenant?.name || "GuestHub",
      support_email: tenant?.notification_email || "",
      support_phone: "",
      full_name: String(r.guest_name || ""),
      guest_name: String(r.guest_name || ""),
      first_name: String(r.first_name || ""),
      last_name: String(r.last_name || ""),
      email: String(r.guest_email || ""),
      phone: String(r.guest_phone || ""),
      reservation_number: String(r.reservation_number || ""),
      check_in_date: fmtDateHeb(r.check_in),
      check_out_date: fmtDateHeb(r.check_out),
      nights_count: String(diffDays(r.check_in, r.check_out)),
      room_number: roomNumbers,
      total_price: fmtMoney(r.total_price),
      total_paid: fmtMoney(r.total_paid),
      balance_due: fmtMoney(r.balance_due),
      guest_count: String(adults + children + infants),
      adults: String(adults),
      children: String(children),
      infants: String(infants),
    }

    const subject = interpolate(template.subject || "", vars)
    const body = interpolate(template.body || "", vars)

    return { success: true, subject, body }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה בעיבוד תבנית"
    return { success: false, error: msg }
  }
}

"use server"

import ExcelJS from "exceljs"
import { getReservationForExport } from "@/lib/actions/reservation-export-data"
import { SOURCE_LABELS, STATUS_LABELS, PAYMENT_LABELS } from "@/lib/constants/reservation"

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ'ק",
  other: "אחר",
}

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDateHeb(v: string | Date | null | undefined): string {
  if (!v) return ""
  const d = typeof v === "string" ? new Date(v) : v
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "reservation"
}

function applyHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003AA0" } }
  row.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" }
  row.height = 22
}

function applyBodyRow(row: ExcelJS.Row): void {
  row.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl", wrapText: true }
}

export async function exportReservationToExcel(
  reservationId: string,
): Promise<{ success: boolean; base64?: string; filename?: string; error?: string }> {
  try {
    const data = await getReservationForExport(reservationId)
    if (!data || !data.reservation) return { success: false, error: "הזמנה לא נמצאה" }
    const r = data.reservation as unknown as Record<string, unknown>
    const businessName = data.tenant?.name || "GuestHub"
    const reservationNumber = String(r.reservation_number || "")

    const wb = new ExcelJS.Workbook()
    wb.creator = businessName
    wb.created = new Date()
    wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: "visible" }]

    /* ── Sheet 1: פרטי הזמנה ────────────────────────────────── */
    const s1 = wb.addWorksheet("פרטי הזמנה", { views: [{ rightToLeft: true }] })
    s1.columns = [
      { header: "שדה", key: "k", width: 22 },
      { header: "ערך", key: "v", width: 42 },
    ]
    applyHeader(s1.getRow(1))
    const fields: Array<[string, string]> = [
      ["מספר הזמנה", reservationNumber],
      ["שם אורח", String(r.guest_name || "")],
      ["טלפון", String(r.guest_phone || "")],
      ["אימייל", String(r.guest_email || "")],
      ["תעודת זהות", String(r.guest_id_number || "")],
      ["ארץ", String(r.guest_country || "")],
      ["מקור", SOURCE_LABELS[String(r.source || "")] || String(r.source || "")],
      ["סטטוס", STATUS_LABELS[String(r.status || "")] || String(r.status || "")],
      ["סטטוס תשלום", PAYMENT_LABELS[String(r.payment_status || "")] || String(r.payment_status || "")],
      ["תאריך כניסה", fmtDateHeb(String(r.check_in))],
      ["תאריך יציאה", fmtDateHeb(String(r.check_out))],
      ["מבוגרים", String(r.adults ?? 0)],
      ["ילדים", String(r.children ?? 0)],
      ["תינוקות", String(r.infants ?? 0)],
      ["סכום ביניים", Number(r.subtotal || 0).toFixed(2)],
      ["מע\"מ", Number(r.tax_amount || 0).toFixed(2)],
      ["הנחה (%)", String(r.discount_percent ?? 0)],
      ["סה\"כ", Number(r.total_price || 0).toFixed(2)],
      ["שולם", Number(r.total_paid || 0).toFixed(2)],
      ["יתרה", Number(r.balance_due || 0).toFixed(2)],
      ["בקשות מיוחדות", String(r.special_requests || "")],
      ["הערות כלליות", String(r.general_notes || "")],
    ]
    for (const [k, v] of fields) {
      const row = s1.addRow({ k, v })
      applyBodyRow(row)
    }

    /* ── Sheet 2: חדרים ────────────────────────────────────── */
    type RoomRow = {
      room_number: string; room_type_name: string | null;
      check_in: string; check_out: string;
      rate_per_night: number; adults?: number | null; children?: number | null; infants?: number | null;
      guest_first_name?: string | null; guest_last_name?: string | null;
      guest_phone?: string | null; guest_email?: string | null;
    }
    const rooms = (r.rooms as RoomRow[]) || []
    const s2 = wb.addWorksheet("חדרים", { views: [{ rightToLeft: true }] })
    s2.columns = [
      { header: "מספר חדר",    key: "room",    width: 14 },
      { header: "סוג חדר",     key: "type",    width: 22 },
      { header: "כניסה",       key: "ci",      width: 16 },
      { header: "יציאה",       key: "co",      width: 16 },
      { header: "לילות",       key: "n",       width: 10 },
      { header: "מבוגרים",     key: "ad",      width: 10 },
      { header: "ילדים",       key: "ch",      width: 10 },
      { header: "תינוקות",     key: "inf",     width: 10 },
      { header: "מחיר ללילה",  key: "rate",    width: 14 },
      { header: "סה\"כ חדר",   key: "total",   width: 14 },
      { header: "אורח (שם)",   key: "gname",   width: 22 },
      { header: "אורח (טלפון)", key: "gphone", width: 18 },
    ]
    applyHeader(s2.getRow(1))
    for (const rm of rooms) {
      const ci = new Date(rm.check_in)
      const co = new Date(rm.check_out)
      const n = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
      const rate = Number(rm.rate_per_night || 0)
      const total = rate * n
      const row = s2.addRow({
        room: rm.room_number,
        type: rm.room_type_name || "",
        ci: fmtDateHeb(rm.check_in),
        co: fmtDateHeb(rm.check_out),
        n,
        ad: rm.adults ?? 0,
        ch: rm.children ?? 0,
        inf: rm.infants ?? 0,
        rate: rate.toFixed(2),
        total: total.toFixed(2),
        gname: `${rm.guest_first_name || ""} ${rm.guest_last_name || ""}`.trim(),
        gphone: rm.guest_phone || "",
      })
      applyBodyRow(row)
    }

    /* ── Sheet 3: חיובים ────────────────────────────────────── */
    type ChargeRow = { description: string; amount: number; quantity: number; total: number; charge_date: string }
    const charges = (r.charges as ChargeRow[]) || []
    const s3 = wb.addWorksheet("חיובים", { views: [{ rightToLeft: true }] })
    s3.columns = [
      { header: "תיאור",  key: "d",  width: 32 },
      { header: "תאריך",  key: "dt", width: 16 },
      { header: "כמות",   key: "q",  width: 10 },
      { header: "מחיר",   key: "p",  width: 12 },
      { header: "סה\"כ",  key: "t",  width: 12 },
    ]
    applyHeader(s3.getRow(1))
    for (const c of charges) {
      const row = s3.addRow({
        d: c.description,
        dt: fmtDateHeb(c.charge_date),
        q: c.quantity,
        p: Number(c.amount).toFixed(2),
        t: Number(c.total).toFixed(2),
      })
      applyBodyRow(row)
    }

    /* ── Sheet 4: תשלומים ──────────────────────────────────── */
    type PayRow = { amount: number; method: string; notes: string | null; created_at: string }
    const payments = (r.payments as PayRow[]) || []
    const s4 = wb.addWorksheet("תשלומים", { views: [{ rightToLeft: true }] })
    s4.columns = [
      { header: "תאריך",         key: "dt",     width: 16 },
      { header: "אמצעי תשלום",   key: "m",      width: 18 },
      { header: "סכום",          key: "amt",    width: 12 },
      { header: "הערות",         key: "notes",  width: 32 },
    ]
    applyHeader(s4.getRow(1))
    for (const p of payments) {
      const row = s4.addRow({
        dt: fmtDateHeb(p.created_at),
        m: METHOD_LABELS[p.method] || p.method,
        amt: Number(p.amount).toFixed(2),
        notes: p.notes || "",
      })
      applyBodyRow(row)
    }

    const buffer = await wb.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const filename = `${sanitizeFilename(`הזמנה-${reservationNumber}`)}.xlsx`
    return { success: true, base64, filename }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת קובץ אקסל"
    return { success: false, error: msg }
  }
}

"use client"

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { registerFonts } from "./registerFonts"
import { SOURCE_LABELS, STATUS_LABELS, PAYMENT_LABELS } from "@/lib/constants/reservation"

registerFonts()

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDateHeb(v: string | Date | null | undefined): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  if (isNaN(d.getTime())) return "—"
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function nights(ci: string | Date, co: string | Date): number {
  const a = typeof ci === "string" ? new Date(ci) : ci
  const b = typeof co === "string" ? new Date(co) : co
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function fmtMoney(n: number, c: string): string {
  const sym = c === "USD" ? "$" : c === "EUR" ? "€" : "₪"
  return `${sym}${Number(n || 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ'ק",
  other: "אחר",
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Heebo", fontSize: 10, color: "#1a1b22" },
  header: { backgroundColor: "#003aa0", color: "#ffffff", borderRadius: 10, padding: 16, marginBottom: 18, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { textAlign: "right" },
  hotelName: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  headerSub: { fontSize: 9, opacity: 0.85 },
  resNum: { fontSize: 13, fontWeight: 700, letterSpacing: 1 },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#003aa0", borderBottomWidth: 1.5, borderBottomColor: "#cbd5e1", paddingBottom: 4, marginBottom: 8, textAlign: "right" },

  row: { flexDirection: "row-reverse", flexWrap: "wrap", marginHorizontal: -4 },
  cell: { width: "33.33%", padding: 4 },
  fieldBox: { backgroundColor: "#f1f5f9", borderRadius: 6, padding: 8 },
  fieldLabel: { fontSize: 8, color: "#6b7280", marginBottom: 3, fontWeight: 700, textAlign: "right" },
  fieldValue: { fontSize: 10, fontWeight: 700, color: "#1a1b22", textAlign: "right" },

  table: { marginTop: 4 },
  thead: { flexDirection: "row-reverse", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1.5, borderBottomColor: "#cbd5e1" },
  tbody: { flexDirection: "row-reverse", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  th: { fontSize: 9, fontWeight: 700, color: "#374151", textAlign: "right" },
  td: { fontSize: 9, color: "#1a1b22", textAlign: "right" },

  totalsBox: { marginTop: 12, backgroundColor: "#f1f5f9", borderRadius: 8, padding: 12 },
  totalsRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 4, fontSize: 10 },
  totalsLabel: { color: "#374151" },
  totalsValue: { fontWeight: 700 },
  grandRow: { borderTopWidth: 1.5, borderTopColor: "#cbd5e1", marginTop: 4, paddingTop: 8 },
  grandLabel: { fontSize: 12, fontWeight: 700, color: "#003aa0" },
  grandValue: { fontSize: 12, fontWeight: 700, color: "#003aa0" },
  dueLabel: { color: "#b91c1c", fontWeight: 700 },
  dueValue: { color: "#b91c1c", fontWeight: 700 },

  notesBox: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 8, padding: 10 },
  notesText: { fontSize: 9, color: "#78350f", textAlign: "right" },

  footer: { position: "absolute", bottom: 20, left: 32, right: 32, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", fontSize: 8, color: "#6b7280", textAlign: "center" },
})

export interface PdfRoom {
  id: string
  room_number: string
  room_type_name?: string | null
  check_in: string
  check_out: string
  rate_per_night: number
  adults?: number | null
  children?: number | null
  infants?: number | null
}

export interface PdfCharge {
  id: string
  description: string
  amount: number
  quantity: number
  total: number
  charge_date: string
}

export interface PdfPayment {
  id: string
  amount: number
  method: string
  notes: string | null
  created_at: string
}

export interface PdfReservation {
  reservation_number: string
  status: string
  payment_status: string
  source: string
  check_in: string
  check_out: string
  adults: number
  children: number
  infants: number
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_country: string | null
  guest_id_number: string | null
  total_price: number
  total_paid: number
  balance_due: number
  subtotal: number
  tax_amount: number
  discount_percent: number
  currency: string
  special_requests: string | null
  general_notes: string | null
  rooms: PdfRoom[]
  charges: PdfCharge[]
  payments: PdfPayment[]
}

export function ReservationPdfDocument({
  reservation: r,
  businessName,
  businessEmail,
}: {
  reservation: PdfReservation
  businessName: string
  businessEmail: string | null
}) {
  const currency = r.currency || "ILS"
  const totalNights = nights(r.check_in, r.check_out)
  const guestsLine = [
    `${r.adults} מבוגרים`,
    r.children > 0 ? `${r.children} ילדים` : null,
    r.infants > 0 ? `${r.infants} תינוקות` : null,
  ].filter(Boolean).join(", ")

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.hotelName}>{businessName}</Text>
            <Text style={styles.headerSub}>אישור הזמנה</Text>
          </View>
          <Text style={styles.resNum}>#{r.reservation_number}</Text>
        </View>

        {/* Guest details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי האורח</Text>
          <View style={styles.row}>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>שם מלא</Text><Text style={styles.fieldValue}>{r.guest_name || "—"}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>טלפון</Text><Text style={styles.fieldValue}>{r.guest_phone || "—"}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>אימייל</Text><Text style={styles.fieldValue}>{r.guest_email || "—"}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>תעודת זהות</Text><Text style={styles.fieldValue}>{r.guest_id_number || "—"}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>ארץ</Text><Text style={styles.fieldValue}>{r.guest_country || "—"}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>מקור</Text><Text style={styles.fieldValue}>{SOURCE_LABELS[r.source] || r.source || "—"}</Text></View></View>
          </View>
        </View>

        {/* Stay details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי השהות</Text>
          <View style={styles.row}>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>תאריך כניסה</Text><Text style={styles.fieldValue}>{fmtDateHeb(r.check_in)}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>תאריך יציאה</Text><Text style={styles.fieldValue}>{fmtDateHeb(r.check_out)}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>מספר לילות</Text><Text style={styles.fieldValue}>{totalNights}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>אורחים</Text><Text style={styles.fieldValue}>{guestsLine}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>סטטוס</Text><Text style={styles.fieldValue}>{STATUS_LABELS[r.status] || r.status}</Text></View></View>
            <View style={styles.cell}><View style={styles.fieldBox}><Text style={styles.fieldLabel}>סטטוס תשלום</Text><Text style={styles.fieldValue}>{PAYMENT_LABELS[r.payment_status] || r.payment_status}</Text></View></View>
          </View>
        </View>

        {/* Rooms */}
        {r.rooms && r.rooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>חדרים</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: "12%" }]}>חדר</Text>
                <Text style={[styles.th, { width: "18%" }]}>סוג</Text>
                <Text style={[styles.th, { width: "17%" }]}>כניסה</Text>
                <Text style={[styles.th, { width: "17%" }]}>יציאה</Text>
                <Text style={[styles.th, { width: "8%", textAlign: "left" }]}>לילות</Text>
                <Text style={[styles.th, { width: "14%", textAlign: "left" }]}>מחיר/לילה</Text>
                <Text style={[styles.th, { width: "14%", textAlign: "left" }]}>סה&quot;כ</Text>
              </View>
              {r.rooms.map((rm) => {
                const n = nights(rm.check_in, rm.check_out)
                const total = Number(rm.rate_per_night || 0) * n
                return (
                  <View key={rm.id} style={styles.tbody}>
                    <Text style={[styles.td, { width: "12%" }]}>{rm.room_number}</Text>
                    <Text style={[styles.td, { width: "18%" }]}>{rm.room_type_name || "—"}</Text>
                    <Text style={[styles.td, { width: "17%" }]}>{fmtDateHeb(rm.check_in)}</Text>
                    <Text style={[styles.td, { width: "17%" }]}>{fmtDateHeb(rm.check_out)}</Text>
                    <Text style={[styles.td, { width: "8%", textAlign: "left" }]}>{n}</Text>
                    <Text style={[styles.td, { width: "14%", textAlign: "left" }]}>{fmtMoney(Number(rm.rate_per_night), currency)}</Text>
                    <Text style={[styles.td, { width: "14%", textAlign: "left" }]}>{fmtMoney(total, currency)}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Charges */}
        {r.charges && r.charges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>חיובים נוספים</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: "40%" }]}>תיאור</Text>
                <Text style={[styles.th, { width: "20%" }]}>תאריך</Text>
                <Text style={[styles.th, { width: "10%", textAlign: "left" }]}>כמות</Text>
                <Text style={[styles.th, { width: "15%", textAlign: "left" }]}>מחיר</Text>
                <Text style={[styles.th, { width: "15%", textAlign: "left" }]}>סה&quot;כ</Text>
              </View>
              {r.charges.map((c) => (
                <View key={c.id} style={styles.tbody}>
                  <Text style={[styles.td, { width: "40%" }]}>{c.description}</Text>
                  <Text style={[styles.td, { width: "20%" }]}>{fmtDateHeb(c.charge_date)}</Text>
                  <Text style={[styles.td, { width: "10%", textAlign: "left" }]}>{c.quantity}</Text>
                  <Text style={[styles.td, { width: "15%", textAlign: "left" }]}>{fmtMoney(Number(c.amount), currency)}</Text>
                  <Text style={[styles.td, { width: "15%", textAlign: "left" }]}>{fmtMoney(Number(c.total), currency)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payments */}
        {r.payments && r.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>תשלומים שבוצעו</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: "25%" }]}>תאריך</Text>
                <Text style={[styles.th, { width: "30%" }]}>אמצעי תשלום</Text>
                <Text style={[styles.th, { width: "30%" }]}>הערות</Text>
                <Text style={[styles.th, { width: "15%", textAlign: "left" }]}>סכום</Text>
              </View>
              {r.payments.map((p) => (
                <View key={p.id} style={styles.tbody}>
                  <Text style={[styles.td, { width: "25%" }]}>{fmtDateHeb(p.created_at)}</Text>
                  <Text style={[styles.td, { width: "30%" }]}>{METHOD_LABELS[p.method] || p.method}</Text>
                  <Text style={[styles.td, { width: "30%" }]}>{p.notes || "—"}</Text>
                  <Text style={[styles.td, { width: "15%", textAlign: "left" }]}>{fmtMoney(Number(p.amount), currency)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Totals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>סיכום פיננסי</Text>
          <View style={styles.totalsBox}>
            {r.subtotal != null && Number(r.subtotal) !== Number(r.total_price) && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>סכום ביניים</Text>
                <Text style={styles.totalsValue}>{fmtMoney(Number(r.subtotal), currency)}</Text>
              </View>
            )}
            {r.discount_percent > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>הנחה ({r.discount_percent}%)</Text>
                <Text style={styles.totalsValue}>-{fmtMoney(Number(r.subtotal || 0) * Number(r.discount_percent) / 100, currency)}</Text>
              </View>
            )}
            {r.tax_amount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>מע&quot;מ</Text>
                <Text style={styles.totalsValue}>{fmtMoney(Number(r.tax_amount), currency)}</Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>סה&quot;כ לתשלום</Text>
              <Text style={styles.grandValue}>{fmtMoney(Number(r.total_price), currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>שולם</Text>
              <Text style={styles.totalsValue}>{fmtMoney(Number(r.total_paid), currency)}</Text>
            </View>
            {Number(r.balance_due) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.dueLabel}>יתרה לתשלום</Text>
                <Text style={styles.dueValue}>{fmtMoney(Number(r.balance_due), currency)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {(r.special_requests || r.general_notes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הערות ובקשות מיוחדות</Text>
            <View style={styles.notesBox}>
              {r.special_requests && <Text style={styles.notesText}>בקשות מיוחדות: {r.special_requests}</Text>}
              {r.general_notes && <Text style={[styles.notesText, { marginTop: r.special_requests ? 4 : 0 }]}>הערות כלליות: {r.general_notes}</Text>}
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {businessName}{businessEmail ? ` · ${businessEmail}` : ""} · הופק בתאריך {fmtDateHeb(new Date())}
        </Text>
      </Page>
    </Document>
  )
}

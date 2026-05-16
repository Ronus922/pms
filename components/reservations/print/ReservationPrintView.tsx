import { SOURCE_LABELS, STATUS_LABELS, PAYMENT_LABELS } from "@/lib/constants/reservation"

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDateHeb(v: string | Date | null | undefined): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function nights(ci: string | Date, co: string | Date): number {
  const a = typeof ci === "string" ? new Date(ci) : ci
  const b = typeof co === "string" ? new Date(co) : co
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function currencySym(c: string): string {
  return c === "USD" ? "$" : c === "EUR" ? "€" : "₪"
}

function fmtMoney(n: number, c: string): string {
  return `${currencySym(c)}${Number(n || 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface RoomRow {
  id: string
  room_number: string
  room_type_name: string | null
  check_in: string
  check_out: string
  rate_per_night: number
  adults: number | null
  children: number | null
  infants: number | null
  guest_first_name: string | null
  guest_last_name: string | null
}

interface ChargeRow {
  id: string
  description: string
  amount: number
  quantity: number
  total: number
  charge_date: string
}

interface PaymentRow {
  id: string
  amount: number
  method: string
  status: string
  notes: string | null
  created_at: string
}

interface ReservationRow {
  id: string
  reservation_number: string
  status: string
  check_in: string
  check_out: string
  adults: number
  children: number
  infants: number
  source: string
  total_price: number
  total_paid: number
  balance_due: number
  subtotal: number
  tax_amount: number
  discount_percent: number
  payment_status: string
  payment_method: string | null
  general_notes: string | null
  special_requests: string | null
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_country: string | null
  guest_id_number: string | null
  rooms: RoomRow[]
  charges: ChargeRow[]
  payments: PaymentRow[]
}

interface TenantRow {
  name: string
  notification_email: string | null
}

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ'ק",
  other: "אחר",
}

export function ReservationPrintView({
  reservation: r,
  tenant,
}: {
  reservation: ReservationRow
  tenant: TenantRow | null
}) {
  const currency = "ILS"
  const businessName = tenant?.name || "GuestHub"
  const totalNights = nights(r.check_in, r.check_out)
  const guestsLine = [
    `${r.adults} מבוגרים`,
    r.children > 0 ? `${r.children} ילדים` : null,
    r.infants > 0 ? `${r.infants} תינוקות` : null,
  ].filter(Boolean).join(", ")

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
        body { font-family: "Noto Sans Hebrew", "Heebo", "Segoe UI", Arial, sans-serif; }
        .doc { max-width: 794px; margin: 0 auto; padding: 24px; color: #1a1b22; direction: rtl; }
        .hdr { background: linear-gradient(to left, #003aa0, #3F51B5); color: #fff; border-radius: 14px; padding: 22px 26px; display: flex; justify-content: space-between; align-items: center; }
        .hdr h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .hdr p { margin: 6px 0 0; font-size: 13px; opacity: 0.85; }
        .hdr .num { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
        .section { margin-top: 22px; }
        .section h2 { margin: 0 0 12px; font-size: 14px; font-weight: 800; color: #003aa0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .field { background: #f8fafc; border-radius: 10px; padding: 10px 14px; }
        .field .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; margin-bottom: 4px; }
        .field .val { font-size: 13px; font-weight: 600; color: #1a1b22; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: right; padding: 8px 10px; background: #f1f5f9; font-weight: 700; color: #374151; border-bottom: 2px solid #cbd5e1; }
        td { text-align: right; padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
        td.num, th.num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
        .totals { margin-top: 14px; background: #f8fafc; border-radius: 10px; padding: 14px 18px; }
        .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
        .totals .row.grand { border-top: 2px solid #cbd5e1; margin-top: 6px; padding-top: 12px; font-size: 15px; font-weight: 800; color: #003aa0; }
        .totals .row.due { color: #b91c1c; font-weight: 700; }
        .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #78350f; }
        .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #6b7280; text-align: center; }
      `}</style>

      <div className="doc">
        <div className="hdr">
          <div>
            <h1>{businessName}</h1>
            <p>אישור הזמנה — מסמך הדפסה</p>
          </div>
          <div className="num" dir="ltr">#{r.reservation_number}</div>
        </div>

        <div className="section">
          <h2>פרטי האורח</h2>
          <div className="grid3">
            <div className="field"><div className="lbl">שם מלא</div><div className="val">{r.guest_name || "—"}</div></div>
            <div className="field"><div className="lbl">טלפון</div><div className="val" dir="ltr">{r.guest_phone || "—"}</div></div>
            <div className="field"><div className="lbl">אימייל</div><div className="val" dir="ltr">{r.guest_email || "—"}</div></div>
            <div className="field"><div className="lbl">תעודת זהות</div><div className="val" dir="ltr">{r.guest_id_number || "—"}</div></div>
            <div className="field"><div className="lbl">ארץ</div><div className="val">{r.guest_country || "—"}</div></div>
            <div className="field"><div className="lbl">מקור</div><div className="val">{SOURCE_LABELS[r.source] || r.source || "—"}</div></div>
          </div>
        </div>

        <div className="section">
          <h2>פרטי השהות</h2>
          <div className="grid3">
            <div className="field"><div className="lbl">תאריך כניסה</div><div className="val">{fmtDateHeb(r.check_in)}</div></div>
            <div className="field"><div className="lbl">תאריך יציאה</div><div className="val">{fmtDateHeb(r.check_out)}</div></div>
            <div className="field"><div className="lbl">מספר לילות</div><div className="val">{totalNights}</div></div>
            <div className="field"><div className="lbl">אורחים</div><div className="val">{guestsLine}</div></div>
            <div className="field"><div className="lbl">סטטוס</div><div className="val">{STATUS_LABELS[r.status] || r.status}</div></div>
            <div className="field"><div className="lbl">סטטוס תשלום</div><div className="val">{PAYMENT_LABELS[r.payment_status] || r.payment_status}</div></div>
          </div>
        </div>

        {r.rooms && r.rooms.length > 0 && (
          <div className="section">
            <h2>חדרים</h2>
            <table>
              <thead>
                <tr>
                  <th>חדר</th><th>סוג</th><th>כניסה</th><th>יציאה</th><th>אורחים</th><th className="num">לילות</th><th className="num">מחיר/לילה</th><th className="num">סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {r.rooms.map((rm) => {
                  const n = nights(rm.check_in, rm.check_out)
                  const total = Number(rm.rate_per_night || 0) * n
                  const composition = [
                    `${rm.adults || 0} מבוגרים`,
                    (rm.children ?? 0) > 0 ? `${rm.children} ילדים` : null,
                    (rm.infants ?? 0) > 0 ? `${rm.infants} תינוקות` : null,
                  ].filter(Boolean).join(", ")
                  return (
                    <tr key={rm.id}>
                      <td>{rm.room_number}</td>
                      <td>{rm.room_type_name || "—"}</td>
                      <td>{fmtDateHeb(rm.check_in)}</td>
                      <td>{fmtDateHeb(rm.check_out)}</td>
                      <td>{composition}</td>
                      <td className="num">{n}</td>
                      <td className="num">{fmtMoney(Number(rm.rate_per_night), currency)}</td>
                      <td className="num">{fmtMoney(total, currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {r.charges && r.charges.length > 0 && (
          <div className="section">
            <h2>חיובים נוספים</h2>
            <table>
              <thead>
                <tr>
                  <th>תיאור</th><th>תאריך</th><th className="num">כמות</th><th className="num">מחיר</th><th className="num">סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {r.charges.map((c) => (
                  <tr key={c.id}>
                    <td>{c.description}</td>
                    <td>{fmtDateHeb(c.charge_date)}</td>
                    <td className="num">{c.quantity}</td>
                    <td className="num">{fmtMoney(Number(c.amount), currency)}</td>
                    <td className="num">{fmtMoney(Number(c.total), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {r.payments && r.payments.length > 0 && (
          <div className="section">
            <h2>תשלומים שבוצעו</h2>
            <table>
              <thead>
                <tr>
                  <th>תאריך</th><th>אמצעי תשלום</th><th>הערות</th><th className="num">סכום</th>
                </tr>
              </thead>
              <tbody>
                {r.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDateHeb(p.created_at)}</td>
                    <td>{METHOD_LABELS[p.method] || p.method}</td>
                    <td>{p.notes || "—"}</td>
                    <td className="num">{fmtMoney(Number(p.amount), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="section">
          <h2>סיכום פיננסי</h2>
          <div className="totals">
            {r.subtotal != null && r.subtotal !== r.total_price && (
              <div className="row"><span>סכום ביניים</span><span dir="ltr">{fmtMoney(Number(r.subtotal), currency)}</span></div>
            )}
            {r.discount_percent > 0 && (
              <div className="row"><span>הנחה ({r.discount_percent}%)</span><span dir="ltr">-{fmtMoney(Number(r.subtotal || 0) * Number(r.discount_percent) / 100, currency)}</span></div>
            )}
            {r.tax_amount > 0 && (
              <div className="row"><span>מע"מ</span><span dir="ltr">{fmtMoney(Number(r.tax_amount), currency)}</span></div>
            )}
            <div className="row grand"><span>סה"כ לתשלום</span><span dir="ltr">{fmtMoney(Number(r.total_price), currency)}</span></div>
            <div className="row"><span>שולם</span><span dir="ltr">{fmtMoney(Number(r.total_paid), currency)}</span></div>
            {Number(r.balance_due) > 0 && (
              <div className="row due"><span>יתרה לתשלום</span><span dir="ltr">{fmtMoney(Number(r.balance_due), currency)}</span></div>
            )}
          </div>
        </div>

        {(r.special_requests || r.general_notes) && (
          <div className="section">
            <h2>הערות ובקשות מיוחדות</h2>
            <div className="notes">
              {r.special_requests && <div><strong>בקשות מיוחדות:</strong> {r.special_requests}</div>}
              {r.general_notes && <div style={{ marginTop: r.special_requests ? 8 : 0 }}><strong>הערות כלליות:</strong> {r.general_notes}</div>}
            </div>
          </div>
        )}

        <div className="footer">
          {businessName}
          {tenant?.notification_email ? ` · ${tenant.notification_email}` : ""}
          {" · "}
          הופק בתאריך {fmtDateHeb(new Date())}
        </div>
      </div>
    </>
  )
}

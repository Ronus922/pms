"use client"

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { registerFonts } from "@/components/reservations/pdf/registerFonts"
import type { AttendanceRecord } from "@/lib/types/attendance"

registerFonts()

const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]
const HEB_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
const ENTRY_TYPE_LABEL: Record<string, string> = {
  regular:  "רגיל",
  vacation: "חופשה",
  sick:     "מחלה",
  holiday:  "חג",
  absence:  "היעדרות",
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isoToHHMM(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(d)
}

function minutesBetween(start: string | Date | null, end: string | Date | null): number {
  if (!start || !end) return 0
  const a = typeof start === "string" ? new Date(start) : start
  const b = typeof end === "string" ? new Date(end) : end
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000))
}

function formatHours(total: number): string {
  if (total <= 0) return "00:00"
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${pad2(h)}:${pad2(m)}`
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Heebo", fontSize: 9, color: "#1a1b22" },

  header: {
    backgroundColor: "#003aa0",
    color: "#ffffff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 14, fontWeight: 700, color: "#ffffff", textAlign: "right" },
  headerSub: { fontSize: 9, color: "#ffffff", opacity: 0.85, marginTop: 2, textAlign: "right" },
  headerMonth: { fontSize: 12, fontWeight: 700, color: "#ffffff" },

  kpiRow: {
    flexDirection: "row-reverse",
    marginBottom: 10,
    gap: 6,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    padding: 8,
  },
  kpiLabel: { fontSize: 8, color: "#6b7280", fontWeight: 700, textAlign: "right" },
  kpiValue: { fontSize: 11, color: "#003aa0", fontWeight: 700, textAlign: "right", marginTop: 2 },

  thead: {
    flexDirection: "row-reverse",
    backgroundColor: "#003aa0",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tbody: {
    flexDirection: "row-reverse",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: "#e2e8f0",
  },
  tbodyAlt: {
    backgroundColor: "#eef2ff",
  },
  th: { fontSize: 9, fontWeight: 700, color: "#ffffff", textAlign: "right" },
  td: { fontSize: 9, color: "#1a1b22", textAlign: "right" },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
})

/* ── Column widths per scope (sum to 100) ───────────────────── */

const COLS_SINGLE = {
  date: 12, day: 10, type: 12, in: 12, out: 12, total: 12, notes: 30,
} as const
const COLS_ALL = {
  date: 10, day: 8, employee: 18, type: 12, in: 11, out: 11, total: 10, notes: 20,
} as const

interface AttendancePdfProps {
  tenantName: string
  employeeName: string | null
  year: number
  month: number
  records: AttendanceRecord[]
}

export function AttendancePdfDocument({
  tenantName,
  employeeName,
  year,
  month,
  records,
}: AttendancePdfProps) {
  const isSingle = !!employeeName

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {isSingle ? `דוח נוכחות — ${employeeName}` : "דוח נוכחות — כל העובדים"}
            </Text>
            <Text style={styles.headerSub}>{tenantName}</Text>
          </View>
          <Text style={styles.headerMonth}>{`${HEB_MONTHS[month - 1]} ${year}`}</Text>
        </View>

        {isSingle ? (
          <SingleEmployeeBody year={year} month={month} records={records} />
        ) : (
          <AllEmployeesBody records={records} />
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${tenantName} · עמוד ${pageNumber} מתוך ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

/* ── Single-employee table ──────────────────────────────────── */

function SingleEmployeeBody({
  year,
  month,
  records,
}: {
  year: number
  month: number
  records: AttendanceRecord[]
}) {
  const byDate = new Map<string, AttendanceRecord[]>()
  for (const r of records) {
    const arr = byDate.get(r.work_date) ?? []
    arr.push(r)
    byDate.set(r.work_date, arr)
  }

  const total = daysInMonth(year, month)
  const rows: React.ReactElement[] = []
  let totalMinutes = 0
  const workedDays = new Set<string>()

  for (let d = 1; d <= total; d++) {
    const date = ymd(year, month, d)
    const weekday = HEB_WEEKDAYS[new Date(year, month - 1, d).getDay()]
    const dayRecs = byDate.get(date) ?? []

    if (dayRecs.length === 0) {
      rows.push(
        <View key={date} style={styles.tbody}>
          <Text style={[styles.td, { width: `${COLS_SINGLE.date}%` }]}>{date}</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.day}%` }]}>{weekday}</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.type}%`, color: "#9ca3af" }]}>—</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.in}%` }]}> </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.out}%` }]}> </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.total}%` }]}> </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.notes}%` }]}> </Text>
        </View>,
      )
      continue
    }

    dayRecs.forEach((rec, i) => {
      const nonRegular = rec.entry_type !== "regular"
      const typeLabel = ENTRY_TYPE_LABEL[rec.entry_type] ?? rec.entry_type
      const rowStyle = nonRegular ? [styles.tbody, styles.tbodyAlt] : styles.tbody
      if (!nonRegular && rec.clock_out) {
        totalMinutes += minutesBetween(rec.clock_in, rec.clock_out)
        workedDays.add(date)
      } else if (!nonRegular) {
        workedDays.add(date)
      }

      rows.push(
        <View key={rec.id} style={rowStyle} wrap={false}>
          <Text style={[styles.td, { width: `${COLS_SINGLE.date}%` }]}>{i === 0 ? date : ""}</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.day}%` }]}>{i === 0 ? weekday : ""}</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.type}%`, fontWeight: 700 }]}>{typeLabel}</Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.in}%`, color: nonRegular ? "#9ca3af" : undefined }]}>
            {nonRegular ? "—" : isoToHHMM(rec.clock_in)}
          </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.out}%`, color: nonRegular ? "#9ca3af" : undefined }]}>
            {nonRegular ? "—" : rec.clock_out ? isoToHHMM(rec.clock_out) : "פתוחה"}
          </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.total}%`, fontWeight: nonRegular ? 700 : 400, color: nonRegular ? "#003aa0" : undefined }]}>
            {nonRegular ? typeLabel : rec.clock_out ? formatHours(minutesBetween(rec.clock_in, rec.clock_out)) : ""}
          </Text>
          <Text style={[styles.td, { width: `${COLS_SINGLE.notes}%` }]}>{rec.notes ?? ""}</Text>
        </View>,
      )
    })
  }

  const avg = workedDays.size === 0 ? 0 : Math.round(totalMinutes / workedDays.size)
  const overtime = Math.max(0, totalMinutes - workedDays.size * 9 * 60)

  return (
    <>
      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>ימי עבודה</Text>
          <Text style={styles.kpiValue}>{workedDays.size}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>סה"כ שעות</Text>
          <Text style={styles.kpiValue}>{formatHours(totalMinutes)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>ממוצע ליום</Text>
          <Text style={styles.kpiValue}>{formatHours(avg)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>שעות נוספות</Text>
          <Text style={styles.kpiValue}>{formatHours(overtime)}</Text>
        </View>
      </View>

      {/* Header */}
      <View style={styles.thead} fixed>
        <Text style={[styles.th, { width: `${COLS_SINGLE.date}%` }]}>תאריך</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.day}%` }]}>יום</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.type}%` }]}>סוג</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.in}%` }]}>הגעה</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.out}%` }]}>יציאה</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.total}%` }]}>סה"כ</Text>
        <Text style={[styles.th, { width: `${COLS_SINGLE.notes}%` }]}>הערה</Text>
      </View>
      {rows}
    </>
  )
}

/* ── All-employees table ────────────────────────────────────── */

function AllEmployeesBody({ records }: { records: AttendanceRecord[] }) {
  return (
    <>
      <View style={styles.thead} fixed>
        <Text style={[styles.th, { width: `${COLS_ALL.date}%` }]}>תאריך</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.day}%` }]}>יום</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.employee}%` }]}>עובד</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.type}%` }]}>סוג</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.in}%` }]}>הגעה</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.out}%` }]}>יציאה</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.total}%` }]}>סה"כ</Text>
        <Text style={[styles.th, { width: `${COLS_ALL.notes}%` }]}>הערה</Text>
      </View>
      {records.map((rec) => {
        const date = rec.work_date
        const y = Number(date.slice(0, 4))
        const m = Number(date.slice(5, 7))
        const d = Number(date.slice(8, 10))
        const weekday = HEB_WEEKDAYS[new Date(y, m - 1, d).getDay()]
        const nonRegular = rec.entry_type !== "regular"
        const typeLabel = ENTRY_TYPE_LABEL[rec.entry_type] ?? rec.entry_type
        const rowStyle = nonRegular ? [styles.tbody, styles.tbodyAlt] : styles.tbody

        return (
          <View key={rec.id} style={rowStyle} wrap={false}>
            <Text style={[styles.td, { width: `${COLS_ALL.date}%` }]}>{date}</Text>
            <Text style={[styles.td, { width: `${COLS_ALL.day}%` }]}>{weekday}</Text>
            <Text style={[styles.td, { width: `${COLS_ALL.employee}%`, fontWeight: 700 }]}>
              {rec.user_name ?? ""}
            </Text>
            <Text style={[styles.td, { width: `${COLS_ALL.type}%`, fontWeight: 700 }]}>{typeLabel}</Text>
            <Text style={[styles.td, { width: `${COLS_ALL.in}%`, color: nonRegular ? "#9ca3af" : undefined }]}>
              {nonRegular ? "—" : isoToHHMM(rec.clock_in)}
            </Text>
            <Text style={[styles.td, { width: `${COLS_ALL.out}%`, color: nonRegular ? "#9ca3af" : undefined }]}>
              {nonRegular ? "—" : rec.clock_out ? isoToHHMM(rec.clock_out) : "פתוחה"}
            </Text>
            <Text style={[styles.td, { width: `${COLS_ALL.total}%`, fontWeight: nonRegular ? 700 : 400, color: nonRegular ? "#003aa0" : undefined }]}>
              {nonRegular ? typeLabel : rec.clock_out ? formatHours(minutesBetween(rec.clock_in, rec.clock_out)) : ""}
            </Text>
            <Text style={[styles.td, { width: `${COLS_ALL.notes}%` }]}>{rec.notes ?? ""}</Text>
          </View>
        )
      })}
    </>
  )
}

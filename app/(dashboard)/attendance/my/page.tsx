"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  clockIn,
  clockOut,
  getMyAttendance,
  getOpenShift,
} from "@/lib/actions/attendance"
import { ENTRY_TYPE_META } from "@/components/attendance/AttendanceEntryPanel"
import type { AttendanceEntryType, AttendanceRecord } from "@/lib/types/attendance"

/* ── Helpers ────────────────────────────────────────────── */

/** "HH:mm" in he-IL locale (24h). Returns "—" for null (non-regular rows). */
function fmtHM(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Elapsed ms → "HH:mm:ss" (always positive). */
function fmtElapsed(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSec = Math.floor(safe / 1000)
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const s = String(totalSec % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

/** "יום שבת, 16 במאי 2026" */
function fmtHebrewDate(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** "מאי 2026" */
function fmtHebrewMonth(d: Date): string {
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" })
}

/** Local-tz `YYYY-MM-DD` (avoids UTC drift from `Date#toISOString`). */
function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Hours decimal from a closed shift (clock_out - clock_in).
 *  Returns 0 for non-regular rows (vacation/sick/etc — they have no
 *  clock timestamps and aren't worked time) or for open shifts. */
function shiftHours(rec: AttendanceRecord): number {
  if (rec.entry_type !== "regular") return 0
  if (!rec.clock_in || !rec.clock_out) return 0
  return (
    (new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()) /
    3_600_000
  )
}

/** Best-effort browser geolocation; `null` if unsupported, denied, or timed out. */
async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

/* ── Page ───────────────────────────────────────────────── */

export default function MyAttendancePage() {
  const { tenantId, userId } = useTenant()

  const [openShift, setOpenShift] = useState<AttendanceRecord | null>(null)
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(new Date())

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const fromDate = toISODateLocal(firstOfMonth)
    const toDate = toISODateLocal(lastOfMonth)

    const [shift, month] = await Promise.all([
      getOpenShift(tenantId, userId),
      getMyAttendance(tenantId, userId, fromDate, toDate),
    ])
    setOpenShift(shift)
    setMonthRecords(month)
  }, [tenantId, userId])

  useEffect(() => {
    loadData()
    // Light polling so the screen reflects manager-side edits without a hard
    // refresh; 5s is gentle on the DB and indistinguishable from "live" UX.
    pollRef.current = setInterval(loadData, 5000)
    // Separate ticker for the on-screen clock + open-shift elapsed counter.
    clockRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (clockRef.current) clearInterval(clockRef.current)
    }
  }, [loadData])

  const handleClockIn = useCallback(async () => {
    setBusy(true)
    const coords = await getCurrentCoords()
    const res = await clockIn(tenantId, userId, coords ?? undefined)
    if (!res.success && res.error) {
      alert(res.error)
    }
    await loadData()
    setBusy(false)
  }, [tenantId, userId, loadData])

  const handleClockOut = useCallback(async () => {
    setBusy(true)
    const coords = await getCurrentCoords()
    const res = await clockOut(tenantId, userId, coords ?? undefined)
    if (!res.success && res.error) {
      alert(res.error)
    }
    await loadData()
    setBusy(false)
  }, [tenantId, userId, loadData])

  const isOpen = openShift !== null

  /* ── Monthly aggregates ─────────────────────────────────── */

  const totalMonthHours = monthRecords.reduce(
    (sum, r) => sum + shiftHours(r),
    0,
  )
  // Worked days: distinct work_date for REGULAR shifts only. Vacation
  // and sick days are intentionally excluded — they aren't "worked".
  const workedDays = new Set(
    monthRecords
      .filter((r) => r.entry_type === "regular")
      .map((r) => r.work_date),
  ).size

  const monthDays = useMemo(() => {
    type DayShift = {
      entryType: AttendanceEntryType
      clockIn: string
      clockOut: string | null
      hours: number | null
    }
    type Day = {
      dateISO: string
      dateDisplay: string
      weekday: string
      shifts: DayShift[]
      totalHours: number
    }

    // Group by work_date (returned by the action as YYYY-MM-DD string).
    // Non-regular rows have NULL clock_in and so can only be anchored by
    // work_date; regular rows would land on the same key.
    const byDate = new Map<string, AttendanceRecord[]>()
    for (const r of monthRecords) {
      const arr = byDate.get(r.work_date) ?? []
      arr.push(r)
      byDate.set(r.work_date, arr)
    }

    const days: Day[] = []
    for (const [dateISO, records] of byDate) {
      // Sort: non-regular first (display reads naturally), then by
      // clock_in time. NULL clock_in sorts before any timestamp.
      records.sort((a, b) => {
        if (a.entry_type !== "regular" && b.entry_type === "regular") return -1
        if (a.entry_type === "regular" && b.entry_type !== "regular") return 1
        const aTime = a.clock_in ? new Date(a.clock_in).getTime() : 0
        const bTime = b.clock_in ? new Date(b.clock_in).getTime() : 0
        return aTime - bTime
      })

      // Anchor at midday to dodge DST flips when formatting in IL TZ.
      const date = new Date(`${dateISO}T12:00:00Z`)
      const shifts: DayShift[] = records.map((r) => {
        const hours =
          r.entry_type === "regular" && r.clock_in && r.clock_out
            ? (new Date(r.clock_out).getTime() -
                new Date(r.clock_in).getTime()) /
              3_600_000
            : null
        return {
          entryType: r.entry_type,
          clockIn: fmtHM(r.clock_in),
          clockOut: r.clock_out ? fmtHM(r.clock_out) : null,
          hours,
        }
      })

      const totalHours = shifts.reduce(
        (sum, s) => sum + (s.hours ?? 0),
        0,
      )

      days.push({
        dateISO,
        dateDisplay: date.toLocaleDateString("he-IL", {
          timeZone: "Asia/Jerusalem",
        }),
        weekday: date.toLocaleDateString("he-IL", {
          weekday: "short",
          timeZone: "Asia/Jerusalem",
        }),
        shifts,
        totalHours,
      })
    }

    days.sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    return days
  }, [monthRecords])

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky gradient header */}
      <header className="sticky top-0 z-40 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-3 py-2.5 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white font-headline">
              שעון נוכחות
            </h1>
            <p className="text-[11px] text-white opacity-85">{fmtHebrewDate(now)}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="schedule" size="sm" className="text-white" />
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Standalone circular punch button (no card wrapper) */}
        <div className="flex flex-col items-center gap-2 py-5">
          <button
            type="button"
            onClick={isOpen ? handleClockOut : handleClockIn}
            disabled={busy}
            aria-label={isOpen ? "יצאתי" : "הגעתי"}
            className={cn(
              "w-32 h-32 rounded-full",
              "flex flex-col items-center justify-center gap-1",
              "text-white font-extrabold text-base",
              "shadow-2xl transition-all duration-300",
              "active:scale-95 disabled:opacity-60",
              isOpen
                ? "bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 hover:shadow-rose-300/50"
                : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 hover:shadow-emerald-300/50",
            )}
          >
            {busy ? (
              <>
                <Icon name="my_location" size="lg" className="animate-pulse" />
                <span className="text-xs font-bold">מאתר מיקום...</span>
              </>
            ) : isOpen ? (
              <>
                <Icon name="logout" size="lg" />
                <span>יצאתי</span>
              </>
            ) : (
              <>
                <Icon name="login" size="lg" />
                <span>הגעתי</span>
              </>
            )}
          </button>

          {isOpen && openShift?.clock_in && (
            <div className="text-center space-y-0.5">
              <div className="text-[11px] text-muted-foreground">
                פעיל מ-{fmtHM(openShift.clock_in)}
              </div>
              <div
                className="text-base font-extrabold tabular-nums text-rose-600"
                dir="ltr"
              >
                {fmtElapsed(now.getTime() - new Date(openShift.clock_in).getTime())}
              </div>
            </div>
          )}
        </div>

        {/* Monthly summary card (moved above cycles) */}
        <section className="bg-card rounded-[20px] border border-border/15 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-5 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm">
              {fmtHebrewMonth(now)}
            </span>
            <span className="text-white/80 text-xs">סיכום חודשי</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-1">
                סה״כ שעות
              </div>
              <div
                className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums"
                dir="ltr"
              >
                {totalMonthHours.toFixed(2)}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-700 dark:text-blue-400 font-bold mb-1">
                ימי עבודה
              </div>
              <div
                className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tabular-nums"
                dir="ltr"
              >
                {workedDays}
              </div>
            </div>
          </div>
        </section>

        {/* Monthly attendance report */}
        <section className="bg-card rounded-[20px] border border-border/15 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/10">
            <h3 className="font-bold text-sm">
              דוח נוכחות - {fmtHebrewMonth(now)}
            </h3>
          </div>
          <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-muted/50 border-b border-border/10 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
            <div>תאריך</div>
            <div>יום</div>
            <div className="text-center">הגעה</div>
            <div className="text-center">יציאה</div>
            <div className="text-end">סה״כ</div>
          </div>
          <div className="divide-y divide-border/10">
            {monthDays.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                אין דיווחי נוכחות בחודש זה
              </div>
            ) : (
              monthDays.map((day) => {
                const isMultiShift = day.shifts.length > 1

                return (
                  <div
                    key={day.dateISO}
                    className="border-b border-border/10 last:border-b-0"
                  >
                    {day.shifts.map((shift, idx) => {
                      const isNonRegular = shift.entryType !== "regular"
                      const meta = ENTRY_TYPE_META[shift.entryType]
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "grid grid-cols-5 gap-2 px-4 py-2.5 text-xs items-center",
                            isNonRegular && "bg-primary/5",
                          )}
                        >
                          <div className="font-bold tabular-nums" dir="ltr">
                            {idx === 0 ? day.dateDisplay : ""}
                          </div>
                          <div className="text-muted-foreground">
                            {idx === 0 ? day.weekday : ""}
                          </div>
                          <div className="tabular-nums text-center text-muted-foreground" dir="ltr">
                            {isNonRegular ? "—" : shift.clockIn}
                          </div>
                          <div className="tabular-nums text-center text-muted-foreground" dir="ltr">
                            {isNonRegular ? "—" : (shift.clockOut ?? "-")}
                          </div>
                          <div className="text-end font-bold">
                            {isNonRegular ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold whitespace-nowrap">
                                <span aria-hidden>{meta.emoji}</span>
                                {meta.label}
                              </span>
                            ) : shift.hours !== null ? (
                              <span className="tabular-nums" dir="ltr">{shift.hours.toFixed(2)}</span>
                            ) : (
                              "-"
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {isMultiShift && (
                      <div className="grid grid-cols-5 gap-2 px-4 py-1.5 bg-muted/30 text-[11px] items-center border-t border-border/5">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div className="text-end text-muted-foreground font-bold">
                          סה״כ:
                        </div>
                        <div className="tabular-nums text-end font-extrabold text-primary">
                          {day.totalHours.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

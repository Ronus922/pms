"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  clockIn,
  clockOut,
  getOpenShift,
  getTodayPunches,
} from "@/lib/actions/attendance"
import type { AttendanceRecord } from "@/lib/types/attendance"

/* ── Helpers ────────────────────────────────────────────── */

/** "HH:mm:ss" zero-padded, locale-stable. */
function fmtHMS(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  const s = String(d.getSeconds()).padStart(2, "0")
  return `${h}:${m}:${s}`
}

/** "HH:mm" in he-IL locale (24h). */
function fmtHM(iso: string): string {
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

/** Hours decimal from a closed shift (clock_out - clock_in). */
function shiftHours(rec: AttendanceRecord): number {
  if (!rec.clock_out) return 0
  return (
    (new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()) /
    3_600_000
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function MyAttendancePage() {
  const { tenantId, userId } = useTenant()

  const [openShift, setOpenShift] = useState<AttendanceRecord | null>(null)
  const [todayPunches, setTodayPunches] = useState<AttendanceRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(new Date())

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    const [shift, punches] = await Promise.all([
      getOpenShift(tenantId, userId),
      getTodayPunches(tenantId, userId),
    ])
    setOpenShift(shift)
    setTodayPunches(punches)
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
    const res = await clockIn(tenantId, userId)
    if (!res.success && res.error) {
      alert(res.error)
    }
    await loadData()
    setBusy(false)
  }, [tenantId, userId, loadData])

  const handleClockOut = useCallback(async () => {
    setBusy(true)
    const res = await clockOut(tenantId, userId)
    if (!res.success && res.error) {
      alert(res.error)
    }
    await loadData()
    setBusy(false)
  }, [tenantId, userId, loadData])

  const isOpen = openShift !== null
  const closedTodayCount = todayPunches.filter((p) => p.clock_out).length
  const todayCycles = todayPunches.length
  const totalHoursToday = todayPunches.reduce((sum, p) => sum + shiftHours(p), 0)

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky gradient header */}
      <header className="sticky top-0 z-40 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-4 py-4 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="schedule" size="md" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-white font-headline">
              שעון נוכחות
            </h1>
            <p className="text-xs text-blue-100">{fmtHebrewDate(now)}</p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Hero card */}
        <section className="rounded-[20px] bg-card border border-border/15 p-6 shadow-sm flex flex-col items-center gap-6">
          {/* Live wall clock */}
          <div className="text-5xl font-extrabold tabular-nums text-center" dir="ltr">
            {fmtHMS(now)}
          </div>

          {/* Giant punch button */}
          <button
            type="button"
            onClick={isOpen ? handleClockOut : handleClockIn}
            disabled={busy}
            className={`w-48 h-48 rounded-full shadow-2xl flex flex-col items-center justify-center gap-3 text-white font-extrabold text-2xl transition-all active:scale-95 hover:shadow-3xl disabled:opacity-50 disabled:cursor-not-allowed ${
              isOpen
                ? "bg-gradient-to-br from-rose-400 to-rose-600"
                : "bg-gradient-to-br from-emerald-400 to-emerald-600"
            }`}
            aria-label={isOpen ? "יצאתי" : "הגעתי"}
          >
            <Icon name={isOpen ? "logout" : "login"} size="xl" className="text-white" />
            {isOpen ? "יצאתי" : "הגעתי"}
          </button>

          {/* Active-shift hint + live elapsed timer */}
          {isOpen && openShift && (
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                פעיל מ-{fmtHM(openShift.clock_in)}
              </p>
              <p
                className="text-2xl font-extrabold tabular-nums text-emerald-600"
                dir="ltr"
              >
                {fmtElapsed(now.getTime() - new Date(openShift.clock_in).getTime())}
              </p>
            </div>
          )}
        </section>

        {/* Today's cycles */}
        <section className="rounded-[20px] bg-card border border-border/15 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">מחזורים היום</h2>
            <span className="text-[11px] font-bold tabular-nums bg-accent text-foreground/80 px-2.5 py-1 rounded-full">
              {todayCycles}
            </span>
          </div>

          {todayCycles === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Icon
                name="schedule"
                size="xl"
                className="text-muted-foreground opacity-30"
              />
              <p className="text-sm text-muted-foreground">
                טרם דווחה משמרת היום
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {todayPunches.map((rec, idx) => {
                  const open = rec.clock_out === null
                  const start = fmtHM(rec.clock_in)
                  const end = open ? "פעיל" : fmtHM(rec.clock_out!)
                  const hours = open ? null : shiftHours(rec).toFixed(2)
                  return (
                    <li
                      key={rec.id}
                      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-accent/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">
                          מחזור {idx + 1}:
                        </span>
                        <span className="text-sm font-bold tabular-nums" dir="ltr">
                          {start} - {end}
                        </span>
                        {open && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                            aria-label="פעיל"
                          />
                        )}
                      </div>
                      {hours !== null && (
                        <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
                          ({hours} שע׳)
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {closedTodayCount > 0 && (
                <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between">
                  <span className="text-sm font-bold">סה״כ היום:</span>
                  <span
                    className="text-base font-extrabold tabular-nums"
                    dir="ltr"
                  >
                    {totalHoursToday.toFixed(2)} שעות
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

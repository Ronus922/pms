"use client"

import { Icon } from "@/components/shared/Icon"
import type { CalendarKpis } from "@/lib/actions/calendar"

interface BoardKpisProps {
  /** Real DB-derived KPIs for today + current month. Null while loading. */
  kpis: CalendarKpis | null
}

const CARD =
  "flex items-center justify-between gap-3 bg-card border border-black/[0.06] dark:border-white/[0.06] rounded-2xl px-4 py-3.5 min-w-0 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_22px_rgba(16,24,40,0.05)]"

/** Circular occupancy ring with the % rendered inside — pure SVG, no chart lib. */
function OccupancyRing({ pct }: { pct: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ
  return (
    <span className="relative w-[46px] h-[46px] shrink-0">
      <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
        <circle cx="23" cy="23" r={r} fill="none" stroke="#eaedf6" className="dark:stroke-white/10" strokeWidth="5" />
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[14px] font-extrabold text-primary tabular-nums">
        {pct}
        <i className="not-italic text-[10px] mt-[2px] ms-px">%</i>
      </span>
    </span>
  )
}

function CountCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: string
  tone: string
}) {
  return (
    <div className={CARD}>
      <div className="min-w-0 flex flex-col gap-[3px]">
        <p className="text-[13.5px] font-bold text-muted-foreground truncate">{label}</p>
        <p className="text-[25px] font-extrabold text-foreground tabular-nums leading-[1.05] tracking-[-0.5px] truncate">
          {value}
        </p>
      </div>
      <span className={`w-[46px] h-[46px] rounded-[13px] flex items-center justify-center shrink-0 ${tone}`}>
        <Icon name={icon} />
      </span>
    </div>
  )
}

function RingCard({ label, sub, pct }: { label: string; sub: string; pct: number | null }) {
  return (
    <div className={CARD}>
      <div className="min-w-0 flex flex-col gap-[3px]">
        <p className="text-[13.5px] font-bold text-muted-foreground truncate">{label}</p>
        <p className="text-[13px] font-semibold text-muted-foreground/80 tabular-nums truncate">{sub}</p>
      </div>
      <OccupancyRing pct={pct ?? 0} />
    </div>
  )
}

/**
 * Board KPI row — fixed order:
 *   1. הגעות היום  2. יציאות היום  3. אורחים בבית  4. תפוסה היום  5. תפוסה החודש
 * All values come from `getCalendarKpis` (real DB, today + current month).
 * RTL grid: card 1 renders on the visual right.
 */
export function BoardKpis({ kpis }: BoardKpisProps) {
  const n = (v: number | undefined) => (kpis == null ? "—" : String(v ?? 0))

  return (
    <div dir="rtl" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      <CountCard
        label="הגעות היום"
        value={n(kpis?.arrivalsToday)}
        icon="login"
        tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
      />
      <CountCard
        label="יציאות היום"
        value={n(kpis?.departuresToday)}
        icon="logout"
        tone="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
      />
      <CountCard
        label="אורחים בבית"
        value={n(kpis?.inHouseGuests)}
        icon="group"
        tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
      />
      <RingCard
        label="תפוסה היום"
        sub={kpis == null ? "—" : `${kpis.occupiedToday}/${kpis.sellableRooms} חדרים`}
        pct={kpis?.occupancyTodayPct ?? null}
      />
      <RingCard label="תפוסה החודש" sub="החודש" pct={kpis?.occupancyMonthPct ?? null} />
    </div>
  )
}

"use client"

import { useRef } from "react"
import { inputClass } from "@/components/shared/FormField"
import { Icon } from "@/components/shared/Icon"
import { defaultReservationDateBounds } from "@/lib/utils/date-validation"

interface DateInputProps {
  value: string
  onChange: (val: string) => void
  /** Lower bound. `"today"` → today's date; any other string is passed as-is.
   *  Omit to inherit the global plausibility floor (1 year ago). */
  minDate?: string
  /** Upper bound. Omit to inherit the global plausibility ceiling (today + 3y). */
  maxDate?: string
  disabled?: boolean
  error?: boolean
  className?: string
}

/* ── Global bounds — single source of truth ─────────────────── */

// Computed once at module load. If this ever needs to be reactive to the
// clock crossing midnight, move into useMemo with a ticking dep. Fine for
// our reservation use case.
const GLOBAL_BOUNDS = defaultReservationDateBounds()

export function DateInput({ value, onChange, minDate, maxDate, disabled, error, className = "" }: DateInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  // Hard floor: if caller passed a min, honour it — but also clamp against
  // the global plausibility floor so no DateInput in the app can ever let a
  // user pick a date before GLOBAL_BOUNDS.min (prevents the year-2001 class
  // of bug reaching the server).
  let computedMin: string | undefined
  if (minDate === "today") {
    const today = new Date().toISOString().slice(0, 10)
    computedMin = today > GLOBAL_BOUNDS.min ? today : GLOBAL_BOUNDS.min
  } else if (minDate) {
    computedMin = minDate > GLOBAL_BOUNDS.min ? minDate : GLOBAL_BOUNDS.min
  } else {
    computedMin = GLOBAL_BOUNDS.min
  }

  const computedMax = maxDate && maxDate < GLOBAL_BOUNDS.max ? maxDate : GLOBAL_BOUNDS.max

  function handleChange(raw: string) {
    // Defensive belt-and-suspenders — a native date input ALWAYS sends
    // YYYY-MM-DD or empty, but log + refuse any malformed payload we
    // encounter so the next 2001-style corruption leaves a trail.
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      // eslint-disable-next-line no-console -- operational log, not UI noise
      console.error("[DateInput] rejected non-ISO value", { raw })
      return
    }
    if (raw) {
      const year = Number(raw.slice(0, 4))
      if (year < 2020 || year > 2099) {
        // eslint-disable-next-line no-console
        console.error("[DateInput] rejected out-of-window year", { raw, year })
        return
      }
    }
    onChange(raw)
  }

  return (
    <div
      className="relative cursor-pointer"
      onClick={() => {
        if (!disabled && ref.current) {
          ref.current.showPicker?.()
          ref.current.focus()
        }
      }}
    >
      <input
        ref={ref}
        type="date"
        className={`${inputClass} cursor-pointer picker-no-icon ${error ? "border-destructive/60 ring-1 ring-destructive/20" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        min={computedMin}
        max={computedMax}
        disabled={disabled}
      />
      <Icon
        name="calendar_month"
        size="sm"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  )
}

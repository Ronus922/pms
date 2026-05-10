/**
 * Reservation date plausibility — shared between client and server.
 *
 * Background: a P0 bug let two reservations be saved with `check_in = 2001-04-25`
 * (25 years in the past) — the UI pushed them out of sort order and calendar
 * windows, so the user perceived them as "disappeared". Root cause in the
 * client path could not be conclusively reproduced (most likely a user-input
 * edge case with partial year in an HTML5 date picker, or an external channel
 * import). Adding validation here stops any future occurrence independently
 * of the exact entry point.
 *
 * Policy:
 *   - Lower bound: 1 year before today (past reservations within the last
 *     year are legitimate — late data entry, corrections, etc.).
 *   - Upper bound: 3 years ahead of today (honeymoon bookings, long-lead
 *     group events — still generous; anything further is almost certainly
 *     a typo).
 *   - Hard floor: year 2020 (below this is always rejected, even if the
 *     sliding window above somehow drifts).
 *   - Stay length: max 365 nights (longer stays must be entered as separate
 *     reservations or flagged with an admin override — out of scope here).
 *
 * All error messages are returned in Hebrew, ready for `setSaveError(...)`.
 */

export interface PlausibilityResult {
  ok: boolean
  reason?: string
}

const HARD_FLOOR_YEAR = 2020
const PAST_WINDOW_YEARS = 1
const FUTURE_WINDOW_YEARS = 3
const MAX_STAY_NIGHTS = 365

function toDateOrNull(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null
  // Require strict YYYY-MM-DD. Reject DD/MM/YYYY, "26/04/26", Date objects
  // toString()ed, or empty partials — the only shape our UI + DB should
  // ever send at the boundary is ISO.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(iso + "T00:00:00Z")
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** Assert a single date is plausible as a reservation check-in or check-out. */
export function isPlausibleDate(iso: string): PlausibilityResult {
  const d = toDateOrNull(iso)
  if (!d) {
    return { ok: false, reason: "תאריך לא תקין — פורמט נדרש: YYYY-MM-DD" }
  }
  const year = d.getUTCFullYear()
  if (year < HARD_FLOOR_YEAR) {
    return { ok: false, reason: `שנת ${year} לא נתמכת. השנה המינימלית המותרת היא ${HARD_FLOOR_YEAR}.` }
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const floor = new Date(today)
  floor.setUTCFullYear(floor.getUTCFullYear() - PAST_WINDOW_YEARS)
  const ceil = new Date(today)
  ceil.setUTCFullYear(ceil.getUTCFullYear() + FUTURE_WINDOW_YEARS)

  if (d < floor) {
    return {
      ok: false,
      reason: `התאריך ${iso} ישן ביותר משנה — אנא בדקו את השנה שהוזנה.`,
    }
  }
  if (d > ceil) {
    return {
      ok: false,
      reason: `התאריך ${iso} רחוק ביותר מ-${FUTURE_WINDOW_YEARS} שנים — אנא בדקו את השנה שהוזנה.`,
    }
  }
  return { ok: true }
}

/** Assert a check-in + check-out pair is coherent: both plausible, check-out
 *  strictly after check-in, and total stay within the sanity threshold. */
export function isPlausibleStay(
  checkIn: string,
  checkOut: string,
): PlausibilityResult {
  const ci = isPlausibleDate(checkIn)
  if (!ci.ok) return ci
  const co = isPlausibleDate(checkOut)
  if (!co.ok) return co

  if (checkOut <= checkIn) {
    return { ok: false, reason: "תאריך יציאה חייב להיות אחרי תאריך כניסה." }
  }
  const ciDate = toDateOrNull(checkIn)!
  const coDate = toDateOrNull(checkOut)!
  const nights = Math.round((coDate.getTime() - ciDate.getTime()) / 86400000)
  if (nights > MAX_STAY_NIGHTS) {
    return {
      ok: false,
      reason: `אורך שהייה (${nights} לילות) חורג מהמקסימום המותר (${MAX_STAY_NIGHTS}). אנא בדקו את התאריכים.`,
    }
  }
  return { ok: true }
}

/** Sensible HTML5 `min` / `max` attributes for <input type="date"> in the
 *  reservation flow. Consumers may override per-field (e.g. check-out min =
 *  check-in). Returned as ISO strings so they can flow straight into
 *  `min={...}` / `max={...}` props. */
export function defaultReservationDateBounds(): { min: string; max: string } {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const floor = new Date(today)
  floor.setUTCFullYear(floor.getUTCFullYear() - PAST_WINDOW_YEARS)
  const ceil = new Date(today)
  ceil.setUTCFullYear(ceil.getUTCFullYear() + FUTURE_WINDOW_YEARS)
  return {
    min: floor.toISOString().slice(0, 10),
    max: ceil.toISOString().slice(0, 10),
  }
}

/** One-liner used by server actions to log suspicious payloads before
 *  rejecting. Goes to stderr / CloudWatch — never to the user. */
export function logImplausibleDatePayload(
  where: string,
  payload: { checkIn?: string; checkOut?: string; raw?: unknown },
): void {
  // eslint-disable-next-line no-console -- explicit operational log for the audit trail
  console.error(`[date-validation] ${where} rejected implausible payload:`, {
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    raw: payload.raw,
    timestamp: new Date().toISOString(),
  })
}

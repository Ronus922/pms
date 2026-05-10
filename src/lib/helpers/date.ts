// ============================================================
// Date formatting helpers — Hebrew locale
// ============================================================

export const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const

export const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const

// ── Internal parse ─────────────────────────────────────────

function toDate(input: Date | string | null): Date | null {
  if (!input) return null
  if (input instanceof Date) return input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

// ── Public formatters ──────────────────────────────────────

/** Format as DD/MM/YYYY. Returns empty string for invalid/null dates. */
export function formatDate(date: Date | string | null): string {
  const d = toDate(date)
  if (!d) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Format as DD/MM/YYYY HH:mm */
export function formatDateTime(date: Date | string | null): string {
  const d = toDate(date)
  if (!d) return ''
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Relative time in Hebrew — "לפני 5 דקות", "עכשיו", etc. */
export function formatRelativeTime(date: Date | string): string {
  const d = toDate(date)
  if (!d) return ''

  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'עכשיו'
  if (diffMin < 60) return `לפני ${diffMin} דקות`
  if (diffHr < 24) return `לפני ${diffHr} שעות`
  if (diffDay === 1) return 'אתמול'
  if (diffDay < 7) return `לפני ${diffDay} ימים`
  if (diffDay < 30) return `לפני ${Math.floor(diffDay / 7)} שבועות`
  if (diffDay < 365) return `לפני ${Math.floor(diffDay / 30)} חודשים`
  return `לפני ${Math.floor(diffDay / 365)} שנים`
}

/** Format a date range: "01/01/2025 – 07/01/2025" */
export function formatDateRange(
  from: Date | null,
  to: Date | null,
): string {
  const f = formatDate(from)
  const t = formatDate(to)
  if (f && t) return `${f} – ${t}`
  if (f) return `מ-${f}`
  if (t) return `עד ${t}`
  return ''
}

// ── Comparisons ────────────────────────────────────────────

export function isToday(date: Date | string): boolean {
  const d = toDate(date)
  if (!d) return false
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

export function isFuture(date: Date | string): boolean {
  const d = toDate(date)
  if (!d) return false
  return d.getTime() > Date.now()
}

export function isPast(date: Date | string): boolean {
  const d = toDate(date)
  if (!d) return false
  return d.getTime() < Date.now()
}

// ── Arithmetic ─────────────────────────────────────────────

/** Number of calendar days between two dates (absolute). */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  const fromStart = startOfDay(from).getTime()
  const toStart = startOfDay(to).getTime()
  return Math.round(Math.abs(toStart - fromStart) / msPerDay)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

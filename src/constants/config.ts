// ============================================================
// App configuration constants
// ============================================================

// ── Pagination ──────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 25

// ── File Upload ─────────────────────────────────────────────

export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const

// ── Formatting ──────────────────────────────────────────────

export const DATE_FORMAT = 'DD/MM/YYYY'
export const DATETIME_FORMAT = 'DD/MM/YYYY HH:mm'
export const TIME_FORMAT = 'HH:mm'

export const CURRENCY = 'ILS'
export const CURRENCY_SYMBOL = '\u20AA' // ₪

// ── Locale ──────────────────────────────────────────────────

export const DEFAULT_LANGUAGE = 'he'
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem'

// ── UX Timing ───────────────────────────────────────────────

export const DEBOUNCE_MS = 300
export const TOAST_DURATION_MS = 4000

// ── Layout ──────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 288
export const SIDEBAR_COLLAPSED_WIDTH = 80
export const SIDEPANEL_WIDTH = '55%'
export const MIN_TOUCH_TARGET = 44

// ── Breakpoints ─────────────────────────────────────────────

export const BREAKPOINTS = {
  xs: 320,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  '2xl': 1280,
  '3xl': 1440,
  '4xl': 1920,
  '5xl': 2560,
} as const

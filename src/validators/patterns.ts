// ============================================================
// Common validation regex patterns and helper functions
// ============================================================

export const PATTERNS = {
  ISRAELI_PHONE: /^0\d{1,2}-?\d{7}$/,
  ISRAELI_MOBILE: /^05\d-?\d{7}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  HEBREW_TEXT: /[\u0590-\u05FF]/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  URL: /^https?:\/\/.+/,
  ISRAELI_ID: /^\d{9}$/,
} as const

// ── Validation helpers ─────────────────────────────────────

/**
 * Validate Israeli phone number (landline or mobile).
 * Accepts optional dash separator: 052-1234567 or 0521234567
 */
export function isValidIsraeliPhone(phone: string): boolean {
  return PATTERNS.ISRAELI_PHONE.test(phone.trim())
}

/**
 * Validate Israeli mobile phone (05X prefix).
 */
export function isValidIsraeliMobile(phone: string): boolean {
  return PATTERNS.ISRAELI_MOBILE.test(phone.trim())
}

/**
 * Basic email format validation.
 */
export function isValidEmail(email: string): boolean {
  return PATTERNS.EMAIL.test(email.trim().toLowerCase())
}

/**
 * Validate UUID v4 format.
 */
export function isValidUUID(id: string): boolean {
  return PATTERNS.UUID.test(id.trim())
}

/**
 * Check if text contains Hebrew characters.
 */
export function containsHebrew(text: string): boolean {
  return PATTERNS.HEBREW_TEXT.test(text)
}

/**
 * Validate Israeli ID number (9 digits + Luhn-like check digit).
 */
export function isValidIsraeliId(id: string): boolean {
  const trimmed = id.trim()
  if (!PATTERNS.ISRAELI_ID.test(trimmed)) return false

  const padded = trimmed.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let digit = Number(padded[i]) * ((i % 2) + 1)
    if (digit > 9) digit -= 9
    sum += digit
  }
  return sum % 10 === 0
}

/**
 * Validate URL-safe slug.
 */
export function isValidSlug(slug: string): boolean {
  return PATTERNS.SLUG.test(slug)
}

/**
 * Validate hex color string (#FFF or #FFFFFF).
 */
export function isValidHexColor(color: string): boolean {
  return PATTERNS.HEX_COLOR.test(color.trim())
}

// ── Sanitization ───────────────────────────────────────────

/** Dangerous characters to strip from general user input */
const DANGEROUS_CHARS = /[<>"'`;(){}[\]\\]/g

/**
 * Trim whitespace, collapse multiple spaces, strip dangerous characters.
 * Use for plain-text inputs (names, notes, etc.).
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(DANGEROUS_CHARS, '')
}

/** HTML tag pattern including self-closing and with attributes */
const HTML_TAG_PATTERN = /<\/?[^>]+(>|$)/g

/**
 * Strip all HTML tags from a string.
 * Does NOT decode entities — use a dedicated library for untrusted rich HTML.
 */
export function sanitizeHtml(html: string): string {
  return html.replace(HTML_TAG_PATTERN, '').trim()
}

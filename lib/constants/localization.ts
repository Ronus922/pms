/* ── Languages & Countries — SINGLE SOURCE OF TRUTH ───────── */

export const LANGUAGES = [
  { value: "he", label: "עברית" },
  { value: "en", label: "English" },
  { value: "ar", label: "عربية" },
  { value: "ru", label: "Русский" },
  { value: "fr", label: "Français" },
] as const

export const COUNTRIES = [
  { value: "IL", label: "ישראל" },
  { value: "US", label: 'ארה"ב' },
  { value: "GB", label: "בריטניה" },
  { value: "FR", label: "צרפת" },
  { value: "DE", label: "גרמניה" },
  { value: "RU", label: "רוסיה" },
  { value: "OTHER", label: "אחר" },
] as const

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.value, l.label])
)

export const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.value, c.label])
)

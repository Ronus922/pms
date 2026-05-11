// ============================================================
// Mobile / responsive helpers
// ============================================================

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS

/**
 * Detect touch-capable device via pointer media or touch points.
 * Safe for SSR — returns false on server.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  )
}

/**
 * Map a viewport width to the largest matching breakpoint key.
 */
export function getBreakpoint(width: number): BreakpointKey {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  return 'sm'
}

/**
 * Detect iOS via user-agent (Safari, Chrome-on-iOS, etc.).
 * Safe for SSR.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Detect Android via user-agent. Safe for SSR.
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Read CSS env() safe-area insets.
 * Falls back to 0 on server or unsupported browsers.
 */
export function getSafeAreaInsets(): {
  top: number
  bottom: number
  left: number
  right: number
} {
  if (typeof document === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }

  const style = getComputedStyle(document.documentElement)
  const parse = (prop: string): number =>
    parseInt(style.getPropertyValue(prop), 10) || 0

  return {
    top: parse('env(safe-area-inset-top)'),
    bottom: parse('env(safe-area-inset-bottom)'),
    left: parse('env(safe-area-inset-left)'),
    right: parse('env(safe-area-inset-right)'),
  }
}

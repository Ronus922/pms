'use client'

import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * SSR-safe: returns false on the server, hydrates on mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Mobile: viewport width < 768px */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/** Tablet: viewport width 768px - 1023px */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}

/** Desktop: viewport width >= 1024px */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const DEFAULT_DELAY = 300

/**
 * Debounce a value — returns the latest value only after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay = DEFAULT_DELAY): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * Debounce a callback — the returned function will only fire after `delay` ms
 * of inactivity. Useful for search inputs, resize handlers, etc.
 */
export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay = DEFAULT_DELAY,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Keep the callback ref fresh without re-creating the debounced function
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay],
  )

  return debounced as T
}

'use client'

import { useEffect, useRef } from 'react'

type KeyboardOptions = {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  enabled?: boolean
  /** Prevent default browser behaviour for this key combo */
  preventDefault?: boolean
}

/**
 * Listen for a keyboard shortcut and fire a callback.
 *
 * @param key - The `event.key` value to match (case-insensitive), e.g. "Escape", "k", "Enter"
 * @param callback - Function to call when the shortcut fires
 * @param options - Modifier keys and enable/disable toggle
 *
 * @example
 * ```tsx
 * // Close panel on Escape
 * useKeyboard('Escape', () => setOpen(false))
 *
 * // Ctrl+K to open search
 * useKeyboard('k', openSearch, { ctrl: true, preventDefault: true })
 * ```
 */
export function useKeyboard(
  key: string,
  callback: () => void,
  options: KeyboardOptions = {},
): void {
  const {
    ctrl = false,
    shift = false,
    alt = false,
    meta = false,
    enabled = true,
    preventDefault = false,
  } = options

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/contentEditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape even in inputs
        if (key.toLowerCase() !== 'escape') return
      }

      const keyMatch = e.key.toLowerCase() === key.toLowerCase()
      const ctrlMatch = ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
      const shiftMatch = shift ? e.shiftKey : !e.shiftKey
      const altMatch = alt ? e.altKey : !e.altKey
      const metaMatch = meta ? e.metaKey : true // meta is checked via ctrl on non-Mac

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        if (preventDefault) e.preventDefault()
        callbackRef.current()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [key, ctrl, shift, alt, meta, enabled, preventDefault])
}

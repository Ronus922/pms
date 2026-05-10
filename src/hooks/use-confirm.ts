'use client'

import {
  useCallback,
  useRef,
  useState,
  createElement,
  type FC,
} from 'react'

// ── Types ──────────────────────────────────────────────────

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmState = ConfirmOptions & { open: boolean }

const INITIAL_STATE: ConfirmState = {
  open: false,
  title: '',
  message: '',
}

/**
 * Imperative confirmation dialog hook.
 *
 * Usage:
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirm()
 *
 * // Mount once in your layout:
 * <ConfirmDialog />
 *
 * // Call imperatively:
 * const ok = await confirm({ title: 'Delete?', message: 'This cannot be undone', destructive: true })
 * if (ok) { ... }
 * ```
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ ...options, open: true })
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handleClose = useCallback((result: boolean) => {
    setState(INITIAL_STATE)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const ConfirmDialog: FC = useCallback(() => {
    if (!state.open) return null

    // Minimal accessible dialog using native HTML + Tailwind
    // Replace with your design system's Dialog/Modal component
    return createElement(
      'div',
      {
        className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'confirm-title',
        'aria-describedby': 'confirm-message',
        onClick: () => handleClose(false),
      },
      createElement(
        'div',
        {
          className: 'mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl',
          dir: 'rtl',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        createElement('h2', { id: 'confirm-title', className: 'text-lg font-semibold text-gray-900' }, state.title),
        createElement('p', { id: 'confirm-message', className: 'mt-2 text-sm text-gray-600' }, state.message),
        createElement(
          'div',
          { className: 'mt-6 flex gap-3 flex-row-reverse' },
          createElement(
            'button',
            {
              type: 'button',
              className: `min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-white ${
                state.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`,
              onClick: () => handleClose(true),
            },
            state.confirmLabel ?? 'אישור',
          ),
          createElement(
            'button',
            {
              type: 'button',
              className: 'min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
              onClick: () => handleClose(false),
            },
            state.cancelLabel ?? 'ביטול',
          ),
        ),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, handleClose])

  return { confirm, ConfirmDialog }
}

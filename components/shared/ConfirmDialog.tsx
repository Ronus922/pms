"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Icon } from "@/components/shared/Icon"

interface ConfirmOptions {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * תחליף מעוצב ל-window.confirm — RTL, טוקנים, נגיש.
 * שימוש:
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ message: "למחוק?", danger: true }))) return
 *   ... ולרנדר {confirmDialog} פעם אחת בקומפוננטה.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const close = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok)
        return null
      })
    },
    []
  )

  const confirmDialog = pending ? (
    <ConfirmDialogView pending={pending} onClose={close} />
  ) : null

  return { confirm, confirmDialog }
}

function ConfirmDialogView({
  pending,
  onClose,
}: {
  pending: PendingConfirm
  onClose: (ok: boolean) => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={pending.title ?? pending.message}
    >
      <button
        type="button"
        aria-label="ביטול"
        onClick={() => onClose(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default"
      />
      <div className="relative bg-card rounded-[20px] shadow-2xl border border-border/40 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              pending.danger
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            <Icon name={pending.danger ? "warning" : "help"} size="md" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            {pending.title && (
              <h3 className="text-base font-bold text-foreground mb-1">{pending.title}</h3>
            )}
            <p className="text-sm text-foreground/90 whitespace-pre-line">{pending.message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {pending.cancelLabel ?? "ביטול"}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              pending.danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {pending.confirmLabel ?? "אישור"}
          </button>
        </div>
      </div>
    </div>
  )
}

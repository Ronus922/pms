"use client"

interface Props {
  text: string
}

/**
 * Small "i" info icon with a hover/focus tooltip bubble.
 * CSS-only (no JS), works with keyboard focus via peer-focus.
 */
export function InfoTooltip({ text }: Props) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        tabIndex={0}
        aria-label="מידע נוסף"
        className="peer inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold cursor-help hover:bg-primary/20 hover:text-primary focus:bg-primary/20 focus:text-primary outline-none"
      >
        i
      </button>
      <span
        role="tooltip"
        dir="rtl"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 max-w-[14rem] px-3 py-2 rounded-xl bg-foreground text-card text-[11px] leading-snug font-medium shadow-xl opacity-0 invisible peer-hover:opacity-100 peer-hover:visible peer-focus:opacity-100 peer-focus:visible transition-opacity z-[60] text-right"
      >
        {text}
      </span>
    </span>
  )
}

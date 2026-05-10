"use client"

interface Props {
  value: unknown
  maxHeight?: number
}

/** Simple pretty-printed JSON viewer. No external dep. */
export function JsonViewer({ value, maxHeight = 400 }: Props) {
  const text = safeStringify(value)
  return (
    <pre
      dir="ltr"
      className="bg-accent/60 rounded-xl p-4 text-[11px] font-mono overflow-auto whitespace-pre-wrap break-words text-foreground"
      style={{ maxHeight }}
    >
      {text}
    </pre>
  )
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

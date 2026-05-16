export function interpolate(text: string, vars: Record<string, string | number | null | undefined>): string {
  if (!text) return ""
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key]
    if (v === null || v === undefined || v === "") return `{{${key}}}`
    return String(v)
  })
}

"use client"

export function openPrint(reservationId: string): void {
  if (!reservationId) return
  window.open(`/reservations/${reservationId}/print`, "_blank", "noopener,noreferrer")
}

export function openPreview(reservationId: string): void {
  if (!reservationId) return
  window.open(`/reservations/${reservationId}/print?preview=true`, "_blank", "noopener,noreferrer")
}

/**
 * Normalize an Israeli phone number to international form for wa.me.
 * 05X-XXXXXXX → 9725XXXXXXXX. Already-international numbers pass through.
 */
export function normalizePhoneIL(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("972")) return digits
  if (digits.startsWith("0")) return `972${digits.slice(1)}`
  return digits
}

export function openWhatsApp(phone: string, body: string): boolean {
  const normalized = normalizePhoneIL(phone)
  if (!normalized) return false
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(body || "")}`
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

/**
 * Trigger a browser download from a base64-encoded binary blob.
 * Used by Excel + PDF server-generated exports.
 */
export function downloadBase64(base64: string, filename: string, mimeType: string): void {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

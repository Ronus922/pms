// ============================================================
// File validation and utility helpers
// ============================================================

// ── Types ──────────────────────────────────────────────────

export type FileType =
  | 'image'
  | 'document'
  | 'spreadsheet'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'archive'
  | 'unknown'

// ── MIME type mapping ──────────────────────────────────────

const MIME_TYPE_MAP: Record<string, FileType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/avif': 'image',
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'text/csv': 'spreadsheet',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/gzip': 'archive',
}

// ── Validation ─────────────────────────────────────────────

/**
 * Check if the given MIME type is in the allowed list.
 * @param mimeType - The file's MIME type (e.g. "image/png")
 * @param allowedTypes - Array of allowed MIME types or type prefixes (e.g. ["image/", "application/pdf"])
 */
export function validateFileType(mimeType: string, allowedTypes: string[]): boolean {
  const lower = mimeType.toLowerCase()
  return allowedTypes.some((allowed) => {
    const normalised = allowed.toLowerCase()
    // Support prefix matching: "image/" matches "image/png"
    if (normalised.endsWith('/')) {
      return lower.startsWith(normalised)
    }
    return lower === normalised
  })
}

/**
 * Check if file size is within the allowed limit.
 * @param sizeBytes - File size in bytes
 * @param maxMB - Maximum allowed size in megabytes
 */
export function validateFileSize(sizeBytes: number, maxMB: number): boolean {
  const maxBytes = maxMB * 1024 * 1024
  return sizeBytes > 0 && sizeBytes <= maxBytes
}

// ── Utilities ──────────────────────────────────────────────

/**
 * Get the logical file type from a MIME type string.
 */
export function getFileTypeFromMime(mimeType: string): FileType {
  return MIME_TYPE_MAP[mimeType.toLowerCase()] ?? 'unknown'
}

/**
 * Format bytes into a human-readable string (e.g. "2.3 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)

  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Extract file extension from a filename.
 * Returns lowercase extension without the dot, or empty string.
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot < 1) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

/**
 * Sanitize a filename: remove special characters, replace spaces with dashes,
 * and prepend a short random prefix for uniqueness.
 */
export function sanitizeFileName(fileName: string): string {
  const ext = getFileExtension(fileName)
  const nameWithoutExt = ext
    ? fileName.slice(0, fileName.lastIndexOf('.'))
    : fileName

  const clean = nameWithoutExt
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80)

  const prefix = Math.random().toString(36).slice(2, 8)
  return ext ? `${prefix}-${clean}.${ext}` : `${prefix}-${clean}`
}

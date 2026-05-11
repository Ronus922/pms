// ============================================================
// Upload helpers — paths, previews, checksums, validation
// ============================================================

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Generate a deterministic storage path for an uploaded file.
 * @example generateStoragePath('avatars', 'user', 'abc-123', 'photo.jpg')
 *          => 'avatars/user/abc-123/photo.jpg'
 */
export function generateStoragePath(
  bucket: string,
  entityType: string,
  entityId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${bucket}/${entityType}/${entityId}/${safeName}`
}

/**
 * Derive a thumbnail path from an original storage path.
 * @example 'avatars/user/abc/photo.jpg' => 'avatars/user/abc/thumb_photo.jpg'
 */
export function generateThumbnailPath(originalPath: string): string {
  const lastSlash = originalPath.lastIndexOf('/')
  if (lastSlash === -1) return `thumb_${originalPath}`
  const dir = originalPath.slice(0, lastSlash + 1)
  const file = originalPath.slice(lastSlash + 1)
  return `${dir}thumb_${file}`
}

/**
 * Create a data-URL preview for an image File. Non-image files resolve to ''.
 */
export function createFilePreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/**
 * Calculate SHA-256 hex digest for a file.
 */
export async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Human-readable file size: "2.3 MB", "512 B", etc.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const base = 1024
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1,
  )
  const value = bytes / Math.pow(base, exponent)

  return exponent === 0
    ? `${bytes} B`
    : `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent]}`
}

"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

/* ── Upload helpers ─────────────────────────────────────── */

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

function extFromMime(mime: string, fallbackName: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg"
    case "image/png":  return "png"
    case "image/webp": return "webp"
    case "image/gif":  return "gif"
    default: {
      const dot = fallbackName.lastIndexOf(".")
      return dot > -1 ? fallbackName.slice(dot + 1).toLowerCase() : "bin"
    }
  }
}

/**
 * Upload a single image to /public/uploads/housekeeping/{uuid}.{ext}
 * and return the public URL ("/uploads/housekeeping/...").
 *
 * Caller must be a user with housekeeping.edit permission.
 */
export async function uploadCleaningTaskImage(
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    await requirePermission("housekeeping", "edit")

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return { success: false, error: "לא נשלח קובץ" }
    }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return { success: false, error: "סוג קובץ לא נתמך (jpg / png / webp / gif בלבד)" }
    }
    if (file.size > MAX_BYTES) {
      return { success: false, error: "הקובץ גדול מדי (מקסימום 8MB)" }
    }

    const dir = path.join(process.cwd(), "public", "uploads", "housekeeping")
    await mkdir(dir, { recursive: true })

    const ext = extFromMime(file.type, file.name)
    const name = `${randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, name), buf)

    return { success: true, url: `/uploads/housekeeping/${name}` }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ" }
  }
}

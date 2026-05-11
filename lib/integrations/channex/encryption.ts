/**
 * Symmetric encryption for Channex API keys using pgcrypto.
 *
 * The encryption key lives in env var CHANNEX_ENCRYPTION_KEY (32-byte
 * base64). It's never concatenated into SQL — we pass it as a bound
 * parameter so it doesn't appear in query logs.
 */

import "server-only"
import { db } from "@/lib/db"

function getEncryptionKey(): string {
  const key = process.env.CHANNEX_ENCRYPTION_KEY
  if (!key || key.length < 20) {
    throw new Error(
      "CHANNEX_ENCRYPTION_KEY is not set. Cannot store/retrieve Channex API keys.",
    )
  }
  return key
}

/**
 * Encrypt a raw API key. Returns the ciphertext as bytea-compatible Buffer.
 * Callers pass the result directly as `${encrypted}` in a template literal.
 */
export async function encryptApiKey(raw: string): Promise<Buffer> {
  const key = getEncryptionKey()
  const [row] = await db`
    SELECT pgp_sym_encrypt(${raw}::text, ${key}::text) AS ciphertext
  `
  return row.ciphertext as Buffer
}

/**
 * Decrypt a stored ciphertext back into the raw API key.
 * Only called right before an outbound API call; the plaintext
 * never leaves memory.
 */
export async function decryptApiKey(ciphertext: Buffer | Uint8Array): Promise<string> {
  const key = getEncryptionKey()
  const [row] = await db`
    SELECT pgp_sym_decrypt(${ciphertext}::bytea, ${key}::text) AS plaintext
  `
  return row.plaintext as string
}

/** Returns the last 4 characters of the key — safe to display in UI. */
export function fingerprintApiKey(raw: string): string {
  if (!raw || raw.length < 4) return "****"
  return `••••${raw.slice(-4)}`
}

/** Generate a random webhook secret — passed as a custom header to Channex. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

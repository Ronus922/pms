"use server"

import { db } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth/actor"

/**
 * Stamp users.last_login = now() for the current session user.
 * Called immediately after a successful sign-in from the client.
 * Silent on failure — never block the login flow.
 */
export async function recordLastLogin(): Promise<void> {
  const actor = await getCurrentActor()
  if (!actor) return

  try {
    await db`
      UPDATE users
      SET last_login = NOW()
      WHERE id = ${actor.userId}
    `
  } catch {
    // swallow — last_login is informational, not load-bearing
  }
}

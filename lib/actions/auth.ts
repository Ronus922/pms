"use server"

import { db } from "@/lib/db"
import { createServerSupabase } from "@/lib/supabase/server"

/**
 * Resolve a username to an email so the client can call
 * supabase.auth.signInWithPassword({ email, password }).
 *
 * Public — used at the login screen BEFORE the user is authenticated, so it
 * cannot use requirePermission(). To prevent username enumeration, the UI
 * shows the same generic "credentials wrong" error whether the username is
 * unknown or the password is wrong.
 *
 * Returns null when:
 *   - username is empty
 *   - no user matches
 *   - user is inactive
 */
export async function lookupEmailByUsername(
  username: string
): Promise<{ email: string | null }> {
  const cleaned = username.trim().toLowerCase()
  if (!cleaned) return { email: null }

  try {
    const [row] = await db`
      SELECT email
      FROM users
      WHERE lower(username) = ${cleaned}
        AND is_active = true
      LIMIT 1
    `
    return { email: (row?.email as string) ?? null }
  } catch {
    return { email: null }
  }
}

/**
 * Stamp users.last_login = NOW() for the *currently authenticated* session
 * user. Read from cookie session — never trust client-supplied user IDs.
 *
 * Used by:
 *   - /api/auth/record-login (called from login/register page after sign-in)
 *   - app/auth/callback/route.ts (OAuth + recovery flows)
 *
 * Silent on failure: a missing session means the cookies haven't propagated
 * yet. The next page nav will call this again via middleware-friendly paths.
 */
export async function recordLastLogin(): Promise<{ success: boolean }> {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false }

    await db`
      UPDATE users
      SET last_login = NOW()
      WHERE id = ${user.id}
    `
    return { success: true }
  } catch {
    return { success: false }
  }
}

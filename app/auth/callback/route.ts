import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { db } from "@/lib/db"

/**
 * Universal auth callback.
 *
 * Handles all post-redirect flows from Supabase Auth:
 *   - Google (and any other) OAuth provider → ?code=...
 *   - Password recovery email             → ?code=...&type=recovery
 *
 * Exchange the one-time code for a session, then route based on `type`:
 *   recovery → /reset-password (user picks a new password)
 *   anything else (login) → /dashboard
 *
 * Side-effects performed here:
 *   1. UPDATE users.last_login = NOW()
 *      — done on the server, with a guaranteed-fresh session, so no cookie-
 *        timing race like there is when calling from the browser-side login
 *        page.
 *   2. For non-password providers, enforce users.allow_google_auth flag.
 *      If the flag is off, sign the user out and redirect to /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin: derivedOrigin } = new URL(request.url)
  // Behind nginx, request.url's origin is the internal upstream
  // (https://localhost:3004), not the public host. Prefer the build-time
  // public URL when set.
  const origin = process.env.NEXT_PUBLIC_APP_URL || derivedOrigin
  const code = searchParams.get("code")
  const type = searchParams.get("type")
  const next = searchParams.get("next") || "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  // ── Recovery flow: don't stamp last_login (the user is on their way to
  //    set a new password, not a normal login event). Send to reset page.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // ── For OAuth providers, enforce per-user allow flag ──────────────────
  const provider = (data.user.app_metadata as { provider?: string } | undefined)
    ?.provider
  if (provider && provider !== "email") {
    const [row] = await db`
      SELECT allow_google_auth, is_active
      FROM users
      WHERE id = ${data.user.id}
    `
    if (!row || !row.is_active || !row.allow_google_auth) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=google_not_allowed`)
    }
  }

  // ── Stamp last_login (best-effort; never block the login flow) ────────
  try {
    await db`
      UPDATE users
      SET last_login = NOW()
      WHERE id = ${data.user.id}
    `
  } catch {
    // swallow — non-fatal
  }

  return NextResponse.redirect(`${origin}${next}`)
}

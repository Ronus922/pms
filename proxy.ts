import { type NextRequest, NextResponse } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Paths that are allowed even when auth backend is unreachable.
// MUST stay in sync with PUBLIC_PATHS in lib/supabase/middleware.ts.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/auth/callback",
  "/api/register",
  "/api/webhooks",
  "/api/channex",   // Channex.io webhook callback (signed by shared secret header, not Supabase auth)
  "/api/cron",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/demo",
  "/faq",
  "/terms",
  "/privacy",
]

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch {
    // FAIL CLOSED on protected paths.
    // Auth backend (Supabase) is unreachable. Previously this fell
    // through to NextResponse.next() which silently allowed
    // unauthenticated traffic into the dashboard. That is unacceptable.
    const pathname = request.nextUrl.pathname
    if (isPublic(pathname)) {
      // Public surfaces (login, marketing, webhooks, cron) may pass
      // — they have their own validation or no auth requirement.
      return NextResponse.next()
    }
    // Protected surface — redirect to /login with a flag so the UI can
    // show a clean "auth backend unavailable" message instead of an
    // infinite loop. Avoid redirect-loop by NOT redirecting from /login.
    const url = new URL("/login", request.url)
    url.searchParams.set("auth_error", "1")
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

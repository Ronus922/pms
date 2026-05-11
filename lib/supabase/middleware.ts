import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// TODO: Generate proper types with `supabase gen types`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/auth/callback",
  "/api/register",  // tenant + first-user signup endpoint (rate-limited at route level)
  "/api/webhooks",
  "/api/channex",   // Channex.io inbound webhook (verified by IP allowlist + x-pms-webhook-secret header)
  "/api/cron",
  // Marketing pages
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/demo",
  "/faq",
  "/terms",
  "/privacy",
]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: false,
            })
          })
        },
      },
    },
  )

  const pathname = request.nextUrl.pathname
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  const isHomePage = pathname === "/"

  // Marketing homepage is public
  if (isHomePage || isPublicPath) {
    // Still refresh session if user is logged in
    await supabase.auth.getUser()
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Redirect logged-in users away from auth pages
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClientSupabase } from "@/lib/supabase/client"
import { lookupEmailByUsername } from "@/lib/actions/auth"
import { Icon } from "@/components/shared/Icon"

const ERROR_MESSAGES: Record<string, string> = {
  google_not_allowed:
    "כניסה עם Google לא אושרה לחשבונך. פנה למנהל המערכת.",
  exchange_failed: "אירעה שגיאה בכניסה. נסה שוב.",
  missing_code: "קישור הכניסה אינו תקין.",
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialError = ERROR_MESSAGES[searchParams.get("error") || ""] || ""

  // Single field — accepts email OR username. We disambiguate by `@`.
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const supabase = createClientSupabase()

    // Resolve identifier → email
    let email = identifier.trim()
    if (!email) {
      setError("יש להזין אימייל או שם משתמש")
      setLoading(false)
      return
    }

    // No "@" → treat as username and look up the email server-side
    if (!email.includes("@")) {
      const { email: resolved } = await lookupEmailByUsername(email)
      if (!resolved) {
        // Same generic message as wrong password — no enumeration hints
        setError("שם משתמש או סיסמה שגויים")
        setLoading(false)
        return
      }
      email = resolved
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError("אימייל או סיסמה שגויים")
      setLoading(false)
      return
    }

    // Stamp last_login — fire and forget. Cookies are set by signInWithPassword
    // by this point, so the API route's getUser() will see the session.
    fetch("/api/auth/record-login", { method: "POST" }).catch(() => {})

    router.push("/dashboard")
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setError("")
    setGoogleLoading(true)
    const supabase = createClientSupabase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
      },
    })
    if (oauthError) {
      setError("שגיאה בהתחברות עם Google")
      setGoogleLoading(false)
    }
    // On success, the browser is redirected — no further state.
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline tracking-tight">
          כניסה למערכת
        </h2>
        <p className="text-muted-foreground">הזן את פרטי ההתחברות שלך</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="identifier"
            className="text-sm font-medium text-foreground"
          >
            אימייל או שם משתמש
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            placeholder="your@email.com / username"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              סיסמה
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary font-semibold hover:underline"
            >
              שכחת סיסמה?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            placeholder="••••••••"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-primary-foreground py-3 rounded-xl font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/40" />
        <span className="text-xs text-muted-foreground">או</span>
        <div className="h-px flex-1 bg-border/40" />
      </div>

      {/* Google Sign-In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        className="w-full bg-white border border-border/60 text-foreground py-3 rounded-xl font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-3"
      >
        <GoogleIcon />
        {googleLoading ? "מפנה ל-Google..." : "התחבר עם Google"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        אין לך חשבון?{" "}
        <Link
          href="/register"
          className="text-primary font-medium hover:underline"
        >
          התחל ניסיון חינם
        </Link>
      </p>
    </div>
  )
}

/* Google "G" icon — inline SVG (no extra deps) */
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.972 32.91 29.4 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.378 0-9.939-3.066-11.282-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}

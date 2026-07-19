"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClientSupabase } from "@/lib/supabase/client"

/**
 * Where the user lands after clicking the "reset password" link in their
 * email and exchangeCodeForSession (in /auth/callback) installed a recovery
 * session.
 *
 * Verifies the session is present, then lets the user set a new password.
 * On success, redirects to /dashboard (they're now signed in).
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  // Verify a recovery session exists; if not, kick back to /forgot-password
  useEffect(() => {
    const supabase = createClientSupabase()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthed(true)
      } else {
        setAuthed(false)
        router.replace("/forgot-password?expired=1")
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים")
      return
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות")
      return
    }

    setLoading(true)
    const supabase = createClientSupabase()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError("שגיאה בעדכון הסיסמה. נסה שוב.")
      setLoading(false)
      return
    }

    // Stamp last_login — first sign-in with the new password
    fetch("/api/auth/record-login", { method: "POST" }).catch(() => {})

    router.push("/dashboard")
    router.refresh()
  }

  if (authed === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    )
  }

  if (!authed) {
    // Already redirecting — render nothing
    return null
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline tracking-tight">
          איפוס סיסמה
        </h2>
        <p className="text-muted-foreground">בחר סיסמה חדשה לחשבון שלך</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            סיסמה חדשה
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            placeholder="לפחות 6 תווים"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium">
            אישור סיסמה
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            placeholder="הקלד שוב את הסיסמה"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-primary-foreground py-3 rounded-xl font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px]"
        >
          {loading ? "שומר..." : "עדכן סיסמה"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          חזרה לכניסה
        </Link>
      </p>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import Link from "next/link"
import { createClientSupabase } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const supabase = createClientSupabase()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (resetError) {
      setError("שגיאה בשליחת הקישור")
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-emerald-50 flex items-center justify-center mx-auto">
          <Icon name="mail" size="xl" className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold font-headline">נשלח בהצלחה</h2>
        <p className="text-muted-foreground">
          אם הכתובת {email} קיימת במערכת, ישלח אליה קישור לאיפוס סיסמה.
        </p>
        <Link href="/login" className="text-primary font-medium hover:underline">
          חזרה לכניסה
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline tracking-tight">איפוס סיסמה</h2>
        <p className="text-muted-foreground">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">אימייל</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            placeholder="your@email.com"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? "שולח..." : "שלח קישור איפוס"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          חזרה לכניסה
        </Link>
      </p>
    </div>
  )
}

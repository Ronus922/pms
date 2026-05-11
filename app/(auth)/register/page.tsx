"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClientSupabase } from "@/lib/supabase/client"

const BUSINESS_TYPES = [
  { value: "hotel", label: "מלון" },
  { value: "vacation_rental", label: "דירות נופש" },
  { value: "hostel", label: "הוסטל" },
  { value: "boutique", label: "בוטיק" },
  { value: "bnb", label: "צימר / B&B" },
  { value: "other", label: "אחר" },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    password: "",
    roomCount: "",
    businessType: "hotel",
    country: "IL",
  })

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    // All registration handled server-side (admin.createUser skips email confirmation)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        roomCount: parseInt(form.roomCount) || 10,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "שגיאה ביצירת חשבון")
      setLoading(false)
      return
    }

    // Sign in with the new credentials
    const supabase = createClientSupabase()
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

    if (signInError || !signInData.user) {
      setError("החשבון נוצר, אך ההתחברות נכשלה. נסה להתחבר מדף הכניסה.")
      setLoading(false)
      return
    }

    // Stamp last_login — fire and forget. Cookies were just set; the API
    // route reads from the same-origin cookie session.
    fetch("/api/auth/record-login", { method: "POST" }).catch(() => {})

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline tracking-tight">התחל ניסיון חינם</h2>
        <p className="text-muted-foreground">14 ימי ניסיון — ללא כרטיס אשראי</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 flex-row-reverse">
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-border"}`} />
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">שם מלא</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => updateForm("fullName", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="ישראל ישראלי"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">שם העסק / המלון</label>
              <input
                type="text"
                required
                value={form.businessName}
                onChange={(e) => updateForm("businessName", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="מלון הנוף"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">אימייל</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="your@email.com"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">סיסמה</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="לפחות 6 תווים"
                dir="ltr"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (form.fullName && form.businessName && form.email && form.password) {
                  setStep(2)
                }
              }}
              className="btn btn-primary"
            >
              המשך
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">טלפון</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="050-1234567"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">סוג עסק</label>
              <select
                value={form.businessType}
                onChange={(e) => updateForm("businessType", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">מספר חדרים</label>
              <input
                type="number"
                min={1}
                max={999}
                value={form.roomCount}
                onChange={(e) => updateForm("roomCount", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/40 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
                placeholder="10"
                dir="ltr"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-border py-3 rounded-xl font-medium hover:bg-accent transition-colors min-h-[44px]"
              >
                חזור
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "יוצר חשבון..." : "התחל ניסיון"}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        יש לך חשבון?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          כניסה
        </Link>
      </p>
    </div>
  )
}

import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/server"
import { db } from "@/lib/db"

/**
 * In-process per-IP rate limiter.
 * Sliding window: max 5 registration attempts per IP per 15 minutes.
 *
 * NOTE: This is process-local. If you run multiple Node instances behind
 * a load balancer, replace with Redis or an edge-side limiter.
 * This is the minimal hardening required by Phase 1.
 */
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 5
const ipHits = new Map<string, number[]>()

function rateLimitIp(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    const oldest = recent[0]
    const retryAfterSeconds = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000)
    return { allowed: false, retryAfterSeconds }
  }
  recent.push(now)
  ipHits.set(ip, recent)
  // Cheap GC: keep map small.
  if (ipHits.size > 1000) {
    for (const [k, v] of ipHits) {
      const fresh = v.filter((t) => now - t < RATE_WINDOW_MS)
      if (fresh.length === 0) ipHits.delete(k)
      else ipHits.set(k, fresh)
    }
  }
  return { allowed: true }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  // ── Rate limit per client IP (X-Forwarded-For aware) ──
  const xff = request.headers.get("x-forwarded-for") || ""
  const ip = (xff.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim()
  const rl = rateLimitIp(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
      },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 })
  }
  const { fullName, businessName, email, password, phone, roomCount, businessType, country } = body as {
    fullName?: string
    businessName?: string
    email?: string
    password?: string
    phone?: string
    roomCount?: number
    businessType?: string
    country?: string
  }

  if (!fullName || !businessName || !email || !password) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 })
  }

  // Server-side input validation (do not trust the client form).
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 })
  }
  if (typeof fullName !== "string" || fullName.length > 200) {
    return NextResponse.json({ error: "שם מלא לא תקין" }, { status: 400 })
  }
  if (typeof businessName !== "string" || businessName.length > 200) {
    return NextResponse.json({ error: "שם עסק לא תקין" }, { status: 400 })
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "הסיסמה חייבת להכיל לפחות 8 תווים" },
      { status: 400 },
    )
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "סיסמה ארוכה מדי" }, { status: 400 })
  }

  const supabase = createAdminSupabase()

  // 1. Create auth user via admin (auto-confirms, no email needed)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      business_name: businessName,
    },
  })

  if (authError || !authData.user) {
    const msg = authError?.message?.includes("already been registered")
      ? "כתובת אימייל זו כבר רשומה במערכת"
      : authError?.message || "שגיאה ביצירת חשבון"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const userId = authData.user.id

  try {
    // 2. Determine plan based on room count
    const rooms = roomCount || 10
    const planSlug =
      rooms <= 10 ? "starter" :
      rooms <= 30 ? "professional" :
      rooms <= 75 ? "business" :
      rooms <= 150 ? "enterprise" : "enterprise-plus"

    const [plan] = await db`SELECT id, max_rooms, max_users, included_modules FROM plans WHERE slug = ${planSlug}`

    if (!plan) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: "חבילה לא נמצאה" }, { status: 500 })
    }

    // 3. Create tenant
    const [tenant] = await db`
      INSERT INTO tenants (name, brand_name, business_type, plan_id, subscription_status, max_rooms, max_users, active_modules, country, email, phone)
      VALUES (${businessName}, ${businessName}, ${businessType || "hotel"}, ${plan.id}, 'trial', ${plan.max_rooms}, ${plan.max_users}, ${plan.included_modules}, ${country || "IL"}, ${email}, ${phone || null})
      RETURNING id
    `

    // 4. Create user record
    await db`
      INSERT INTO users (id, tenant_id, email, full_name, phone, role)
      VALUES (${userId}, ${tenant.id}, ${email}, ${fullName}, ${phone || null}, 'super_admin')
    `

    // 5. Create default property + building + floor + room type
    const [property] = await db`
      INSERT INTO properties (tenant_id, name, country)
      VALUES (${tenant.id}, ${businessName}, ${country || "IL"})
      RETURNING id
    `

    const [building] = await db`
      INSERT INTO buildings (tenant_id, property_id, name)
      VALUES (${tenant.id}, ${property.id}, 'מבנה ראשי')
      RETURNING id
    `

    await db`
      INSERT INTO floors (tenant_id, building_id, name, sort_order)
      VALUES (${tenant.id}, ${building.id}, 'קומה 1', 1)
    `

    await db`
      INSERT INTO room_types (tenant_id, name, max_occupancy, max_adults, base_price)
      VALUES (${tenant.id}, 'Standard', 2, 2, 400)
    `

    return NextResponse.json({ success: true, tenantId: tenant.id })
  } catch (err) {
    // Rollback: delete auth user on failure
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: "שגיאה ביצירת חשבון: " + (err instanceof Error ? err.message : "unknown") },
      { status: 500 }
    )
  }
}

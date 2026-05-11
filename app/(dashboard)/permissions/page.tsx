"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getStaffList } from "@/lib/actions/permissions"
import { getRoleLabel, ROLE_STYLES } from "@/lib/permissions/constants"

/* ── Types ──────────────────────────────────────────────────── */

interface StaffMember {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
}

/* ── Page ───────────────────────────────────────────────────── */

export default function PermissionsPage() {
  const { tenantId } = useTenant()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const loadStaff = useCallback(async () => {
    setLoading(true)
    const data = await getStaffList(tenantId)
    setStaff(data as unknown as StaffMember[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const filtered = staff.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    )
  })

  function getInitials(name: string): string {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].charAt(0)
    return parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold font-headline">הרשאות</h1>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full tabular-nums">
            {filtered.length} עובדים
          </span>

          <Link
            href="/staff"
            className="btn btn-outline"
          >
            <Icon name="group" size="sm" />
            ניהול עובדים
          </Link>
        </div>
      </div>

      {/* ── Info Banner ─────────────────────────────────────── */}
      <div className="bg-primary/5 rounded-[20px] border border-primary/15 p-5 flex items-start gap-3">
        <Icon name="info" size="md" className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-primary">סקירת הרשאות</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            עמוד זה מציג סקירה מהירה של תפקידים והרשאות.
            לניהול מלא של עובדים, עברו ל<Link href="/staff" className="text-primary font-bold hover:underline">עמוד העובדים</Link>.
          </p>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="relative max-w-lg">
        <Icon
          name="search"
          size="sm"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-accent border border-border/40 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          placeholder="חיפוש לפי שם, אימייל או טלפון..."
        />
      </div>

      {/* ── Staff Cards (read-only overview, click navigates to /staff) ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען צוות...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="person_off" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">לא נמצאו עובדים</p>
          <p className="text-sm">נסו לשנות את מילת החיפוש</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((member) => {
            const style = ROLE_STYLES[member.role]
            return (
              <Link
                key={member.id}
                href={`/staff?employee=${member.id}&tab=permissions`}
                className={`w-full text-right bg-card rounded-[20px] shadow-sm border border-border/20 border-r-4 ${style?.border || "border-gray-300"} p-5 hover:shadow-md transition-all cursor-pointer group block`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {getInitials(member.full_name)}
                  </div>

                  {/* Name + Contact */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {member.full_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {member.email && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1" dir="ltr">
                          <Icon name="email" size="sm" className="text-muted-foreground/60" />
                          {member.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${style?.badge || "bg-slate-100 text-slate-600"}`}
                  >
                    {getRoleLabel(member.role)}
                  </span>

                  {/* Status */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground max-sm:hidden">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        member.is_active ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    />
                    <span>{member.is_active ? "פעיל" : "מושבת"}</span>
                  </div>

                  {/* Chevron */}
                  <Icon
                    name="chevron_left"
                    size="sm"
                    className="text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

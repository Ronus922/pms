"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import { getStaffList } from "@/lib/actions/permissions"
import { PermissionsManager } from "@/components/permissions/PermissionsManager"
import { ROLES, getRoleLabel } from "@/lib/permissions/constants"

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

/* ── Role Styling ───────────────────────────────────────────── */

const ROLE_BORDER: Record<string, string> = {
  super_admin: "border-primary",
  admin: "border-[#3F51B5]",
  receptionist: "border-amber-400",
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-indigo-100 text-indigo-700",
  receptionist: "bg-amber-100 text-amber-700",
}

/* ── Page ───────────────────────────────────────────────────── */

export default function PermissionsPage() {
  const { tenantId } = useTenant()
  const { isAdmin } = usePermissions()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
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

  function formatLastLogin(dateStr: string | null): string {
    if (!dateStr) return "לא התחבר"
    const d = new Date(dateStr)
    return d.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold font-headline">
          הרשאות וצוות
        </h1>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full tabular-nums">
            {filtered.length} עובדים
          </span>

          {isAdmin && (
            <button
              onClick={() => setSelectedUserId("__invite__")}
              className="flex items-center gap-2 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 min-h-[44px] px-6 py-3"
            >
              <Icon name="add" size="sm" className="text-white" />
              הזמן עובד
            </button>
          )}
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

      {/* ── Staff Cards ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען צוות...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="person_off" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">לא נמצאו עובדים</p>
          <p className="text-sm">נסו לשנות את מילת החיפוש או להזמין עובד חדש</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedUserId(member.id)}
              className={`w-full text-right bg-card rounded-[20px] shadow-sm border border-border/20 border-r-4 ${ROLE_BORDER[member.role] || "border-gray-300"} p-5 hover:shadow-md transition-all cursor-pointer group`}
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
                    {member.phone && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1" dir="ltr">
                        <Icon name="phone" size="sm" className="text-muted-foreground/60" />
                        {member.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role Badge */}
                <span
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${ROLE_BADGE[member.role] || "bg-slate-100 text-slate-600"}`}
                >
                  {getRoleLabel(member.role)}
                </span>

                {/* Status + Last Login */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground max-sm:hidden">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      member.is_active ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                  <span>{member.is_active ? "פעיל" : "מושבת"}</span>
                  <span className="text-border">|</span>
                  <span>{formatLastLogin(member.last_login)}</span>
                </div>

                {/* Chevron */}
                <Icon
                  name="chevron_left"
                  size="sm"
                  className="text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Permissions Manager SidePanel ───────────────────── */}
      <PermissionsManager
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onSaved={loadStaff}
      />
    </div>
  )
}
